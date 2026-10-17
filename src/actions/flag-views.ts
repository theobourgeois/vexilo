'use server';

import { db } from '@/db';
import { redis } from '@/db/redis';
import { flagViewDaily, flags } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';

const VISITOR_COOKIE = 'vx_vid';
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse/i;

/**
 * Counts one view of a flag page. Every call adds a view; a visitor (anonymous cookie)
 * is counted once per flag per UTC day.
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

  const day = new Date().toISOString().slice(0, 10);
  const firstToday = await redis
    .set(`flag-view:${day}:${flagId}:${visitorId}`, 1, { nx: true, ex: 60 * 60 * 48 })
    .then((result) => result === 'OK')
    // If Redis is down, still count the view but don't guess at visitors.
    .catch(() => false);
  const visitors = firstToday ? 1 : 0;

  try {
    await db
      .insert(flagViewDaily)
      .values({ flagId, day, views: 1, visitors })
      .onConflictDoUpdate({
        target: [flagViewDaily.flagId, flagViewDaily.day],
        set: {
          views: sql`${flagViewDaily.views} + 1`,
          visitors: sql`${flagViewDaily.visitors} + ${visitors}`,
        },
      });
    await db.update(flags).set({ views: sql`${flags.views} + 1` }).where(eq(flags.id, flagId));
  } catch (error) {
    // A missing flag (deleted mid-visit) shouldn't surface as an error to the reader.
    console.error('[flag-views] Failed to record view', flagId, error);
  }
}
