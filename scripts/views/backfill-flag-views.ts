import 'dotenv/config';

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { flagViewDaily, flags } from '../../src/db/schema';

/**
 * Backfills flag page views from Vercel Web Analytics into vexilo_flag_view_daily,
 * then recomputes each flag's lifetime `views` total from the daily rows.
 *
 * Daily rows are overwritten, so only backfill days before live tracking started:
 *   npm run views:backfill -- --until 2026-10-18           # pull from Vercel (needs `vercel login`)
 *   npm run views:backfill -- --file scripts/views/x.json  # use a saved export
 *   add --dry-run to see what would be written
 *
 * Vercel's Hobby plan only keeps the last 31 days of Web Analytics data.
 */

type ExportRow = { day: string; path: string; views?: number; visitors?: number };

const VERCEL_SCOPE = process.env.VERCEL_SCOPE || 'theobourgeois-projects';
const VERCEL_PROJECT = process.env.VERCEL_PROJECT || 'vexilo';
const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv: string[]) {
  const args = { since: '', until: '', file: '', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--since') args.since = argv[++i];
    else if (arg === '--until') args.until = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const today = new Date().toISOString().slice(0, 10);
  // Exclusive end; defaults to today so a partial day is never written.
  args.until ||= today;
  args.since ||= new Date(Date.parse(args.until) - 30 * DAY_MS).toISOString().slice(0, 10);
  return args;
}

function addDays(day: string, n: number) {
  return new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
}

function queryVercel(day: string, aggregation: 'count' | 'unique/visitorId') {
  const output = execFileSync(
    'vercel',
    [
      'metrics',
      'vercel.analytics.page_view.count',
      '--scope', VERCEL_SCOPE,
      '--project', VERCEL_PROJECT,
      '--since', `${day}T00:00:00Z`,
      '--until', `${addDays(day, 1)}T00:00:00Z`,
      '-g', '1d',
      '--group-by', 'requestPath',
      '-a', aggregation,
      '--limit', '500',
      '--json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const body = JSON.parse(output.slice(output.indexOf('{'))) as {
    error?: { message: string };
    data?: Array<Record<string, string | number>>;
  };
  if (body.error) throw new Error(`Vercel ${day}: ${body.error.message}`);
  return (body.data ?? []).map((row) => {
    const valueKey = Object.keys(row).find((key) => key.startsWith('vercel_'))!;
    return { path: String(row.requestPath ?? ''), value: Number(row[valueKey]) };
  });
}

function pullFromVercel(since: string, until: string): ExportRow[] {
  const rows = new Map<string, ExportRow>();
  for (let day = since; day < until; day = addDays(day, 1)) {
    for (const [aggregation, field] of [
      ['count', 'views'],
      ['unique/visitorId', 'visitors'],
    ] as const) {
      for (const { path, value } of queryVercel(day, aggregation)) {
        if (!path.startsWith('/flag/')) continue;
        const key = `${day}|${path}`;
        const row = rows.get(key) ?? { day, path };
        row[field] = value;
        rows.set(key, row);
      }
    }
    process.stdout.write(`\rPulled ${day}`);
  }
  process.stdout.write('\n');
  return [...rows.values()];
}

function flagNameFromPath(path: string) {
  const segment = path
    .slice('/flag/'.length)
    .split('?')[0]
    .replace(/\/(edit|experimental)$/, '');
  try {
    return decodeURIComponent(segment.replace(/\+/g, '%20'));
  } catch {
    return segment;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const exported = args.file
    ? (JSON.parse(readFileSync(args.file, 'utf8')) as ExportRow[]).filter(
        (row) => row.day >= args.since && row.day < args.until,
      )
    : pullFromVercel(args.since, args.until);

  const allFlags = await db.select({ id: flags.id, name: flags.name }).from(flags);
  const byName = new Map(allFlags.map((flag) => [flag.name, flag.id]));
  const byLowerName = new Map(allFlags.map((flag) => [flag.name.trim().toLowerCase(), flag.id]));

  const daily = new Map<string, { flagId: string; day: string; views: number; visitors: number }>();
  const unmatched = new Map<string, number>();
  for (const row of exported) {
    const name = flagNameFromPath(row.path);
    const flagId = byName.get(name) ?? byLowerName.get(name.trim().toLowerCase());
    if (!flagId) {
      unmatched.set(name, (unmatched.get(name) ?? 0) + (row.views ?? 0));
      continue;
    }
    // Different URL spellings of the same flag fold into one row.
    const key = `${flagId}|${row.day}`;
    const entry = daily.get(key) ?? { flagId, day: row.day, views: 0, visitors: 0 };
    entry.views += row.views ?? 0;
    entry.visitors += row.visitors ?? 0;
    daily.set(key, entry);
  }

  const rows = [...daily.values()];
  const matchedViews = rows.reduce((sum, row) => sum + row.views, 0);
  const unmatchedViews = [...unmatched.values()].reduce((sum, n) => sum + n, 0);
  console.log(
    `${args.since} → ${args.until} (exclusive): ${rows.length} daily rows, ${matchedViews} views matched, ` +
      `${unmatchedViews} views on ${unmatched.size} renamed or deleted flags skipped`,
  );

  if (args.dryRun) {
    console.log('Dry run, nothing written.');
    return;
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(flagViewDaily)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: [flagViewDaily.flagId, flagViewDaily.day],
        set: { views: sql`excluded.views`, visitors: sql`excluded.visitors` },
      });
  }

  await db.execute(sql`
    update ${flags} as f
    set views = totals.views
    from (
      select flag_id, sum(views)::int as views
      from ${flagViewDaily}
      group by flag_id
    ) as totals
    where f.id = totals.flag_id and f.views <> totals.views
  `);

  console.log('Backfill written and lifetime totals recomputed.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
