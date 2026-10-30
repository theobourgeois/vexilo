'use server';

import { db } from '@/db';
import { redis } from '@/db/redis';
import { flagViewDaily, flags } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { after } from 'next/server';

const VISITOR_COOKIE = 'vx_vid';
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse/i;

/**
 * Counts one view of a flag page. Every call adds a view; a visitor (anonymous cookie)
 * is counted once per flag per UTC day. Counts are buffered in Redis; see flushFlagViews.
 */
export async function recordFlagView(flagId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(flagId)) return;
  const userAgent = (await headers()).get('user-agent') ?? '';
  if (!userAgent || BOT_PATTERN.test(userAgent)) return;

  const cookieStore = await cookies();
  let visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    cookieStore.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const bucket = viewBucketKey(hourOf(now));
  try {
    const firstToday = await redis
      .set(`flag-view:${day}:${flagId}:${visitorId}`, 1, { nx: true, ex: 60 * 60 * 48 })
      .then((result) => result === 'OK')
      // If the visitor check fails, still count the view but don't guess at visitors.
      .catch(() => false);
    await redis.hincrby(bucket, `${flagId}:v`, 1);
    if (firstToday) await redis.hincrby(bucket, `${flagId}:u`, 1);
    await redis.expire(bucket, VIEW_BUCKET_TTL_SECONDS);
  } catch (error) {
    console.error('[flag-views] Failed to record view', flagId, error);
    return;
  }

  // The first view a few minutes into each hour writes the finished hours to the database.
  if (now.getUTCMinutes() >= FLUSH_DELAY_MINUTES) {
    const claimed = await redis
      .set(`flag-views:flush:${hourOf(now)}`, 1, { nx: true, ex: 60 * 60 * 2 })
      .then((result) => result === 'OK')
      .catch(() => false);
    if (claimed) after(() => flushFlagViews(now));
  }
}

/*
 * Views pile up in an hourly Redis hash (`<flagId>:v` views, `<flagId>:u` new visitors) and reach
 * Postgres once an hour in one statement, so readers don't keep the database awake. Counts lag
 * by up to about an hour.
 */
const VIEW_BUCKET_TTL_SECONDS = 60 * 60 * 24 * 7;
const FLUSHED_THROUGH_KEY = 'flag-views:flushed-through';
const FLUSH_DELAY_MINUTES = 5;
const MAX_HOURS_PER_FLUSH = 48;
const HOUR_MS = 60 * 60 * 1000;

/** `2026-10-29T14`, the UTC hour a view falls in. */
function hourOf(date: Date) {
  return date.toISOString().slice(0, 13);
}

function viewBucketKey(hour: string) {
  return `flag-views:${hour}`;
}

async function flushFlagViews(now: Date) {
  const currentHour = new Date(`${hourOf(now)}:00:00Z`).getTime();
  const flushedThrough = await redis.get<string>(FLUSHED_THROUGH_KEY);
  const oldest = currentHour - MAX_HOURS_PER_FLUSH * HOUR_MS;
  let next = flushedThrough ? new Date(`${flushedThrough}:00:00Z`).getTime() + HOUR_MS : oldest;
  next = Math.max(next, oldest);

  for (let time = next; time < currentHour; time += HOUR_MS) {
    const hour = hourOf(new Date(time));
    const bucket = viewBucketKey(hour);
    try {
      const counts = await redis.hgetall<Record<string, number | string>>(bucket);
      if (counts) await writeHourlyViews(hour.slice(0, 10), counts);
      await redis.set(FLUSHED_THROUGH_KEY, hour);
      if (counts) await redis.del(bucket);
    } catch (error) {
      // Stop here; the next hour's flush picks up from this bucket.
      console.error('[flag-views] Failed to flush views for', hour, error);
      return;
    }
  }
}

async function writeHourlyViews(day: string, counts: Record<string, number | string>) {
  const byFlag = new Map<string, { views: number; visitors: number }>();
  for (const [field, value] of Object.entries(counts)) {
    const [flagId, kind] = field.split(':');
    const entry = byFlag.get(flagId) ?? { views: 0, visitors: 0 };
    if (kind === 'v') entry.views += Number(value) || 0;
    if (kind === 'u') entry.visitors += Number(value) || 0;
    byFlag.set(flagId, entry);
  }

  const rows = [...byFlag].filter(([, entry]) => entry.views > 0);
  for (let i = 0; i < rows.length; i += 1000) {
    const values = sql.join(
      rows
        .slice(i, i + 1000)
        .map(([flagId, entry]) => sql`(${flagId}::uuid, ${entry.views}::int, ${entry.visitors}::int)`),
      sql`, `,
    );
    // One statement, so the daily rows and running totals can't drift apart. The join skips
    // flags deleted since they were viewed.
    await db.execute(sql`
      with counted (flag_id, views, visitors) as (values ${values}),
      daily as (
        insert into ${flagViewDaily} (flag_id, day, views, visitors)
        select counted.flag_id, ${day}::date, counted.views, counted.visitors
        from counted join ${flags} on ${flags.id} = counted.flag_id
        on conflict (flag_id, day) do update set
          views = ${flagViewDaily.views} + excluded.views,
          visitors = ${flagViewDaily.visitors} + excluded.visitors
      )
      update ${flags} set views = ${flags.views} + counted.views
      from counted where ${flags.id} = counted.flag_id
    `);
  }
}
