import 'dotenv/config';

import { readFileSync, writeFileSync } from 'node:fs';

import { db } from '../../src/db';
import { flagTimelines, flags } from '../../src/db/schema';
import {
  type CatalogueVersion,
  PIPELINE_VERSION,
  researchFlagTimeline,
  saveFlagTimeline,
  type TimelineResult,
} from '../../src/lib/ai/flag-timeline-pipeline';
import { isHistoricalVersion, parseYearSpan, timelineKey } from '../../src/lib/timeline/flag-names';

/**
 * Researches history timelines for flags and prints them. Pass --write to save them to vexilo_flag_timeline.
 *
 * Usage:
 *   tsx scripts/timeline/fill-timelines.ts --names "Bhutan,France,Libya"
 *   tsx scripts/timeline/fill-timelines.ts --names "Texas" --model gpt-5 --out /tmp/timelines.json
 *   tsx scripts/timeline/fill-timelines.ts --names "Bhutan,France" --write
 *
 * The most viewed candidates (candidates file from find-timeline-candidates.ts --out):
 *   tsx scripts/timeline/fill-timelines.ts --candidates /tmp/timeline-candidates.json --top 50 --list
 *   tsx scripts/timeline/fill-timelines.ts --candidates /tmp/timeline-candidates.json --top 50 --skip-done --write
 *
 * The 50 most populous countries:
 *   tsx scripts/timeline/fill-timelines.ts --preset populous-50 --skip-done --write
 *
 * Optional: --concurrency <n> (default 4), --skip-done skips flags already researched by this pipeline version.
 */

// The 50 most populous countries (UN 2024 estimates), named as they are in the catalogue. Côte d'Ivoire (#50) has no
// flag in the catalogue yet, so Cameroon (#51) stands in.
const PRESETS: Record<string, string[]> = {
  'populous-50': [
    "People's Republic of China", 'India', 'the United States', 'Indonesia', 'Pakistan', 'Nigeria', 'Brazil',
    'Bangladesh', 'Russia', 'Ethiopia', 'Mexico', 'Japan', 'Egypt', 'the Philippines',
    'the Democratic Republic of the Congo', 'Vietnam', 'Iran', 'Turkey', 'Germany', 'Thailand', 'Tanzania',
    'the United Kingdom (1-2)', 'France', 'South Africa', 'Italy', 'Kenya', 'Myanmar', 'Colombia', 'South Korea',
    'Sudan', 'Uganda', 'Spain', 'Algeria', 'Iraq', 'Argentina', 'the Islamic Emirate of Afghanistan', 'Yemen',
    'Canada', 'Angola', 'Ukraine', 'Morocco', 'Poland', 'Uzbekistan', 'Malaysia', 'Mozambique', 'Ghana', 'Peru',
    'Saudi Arabia', 'Madagascar', 'Cameroon',
  ],
};

const args = process.argv.slice(2);
const option = (key: string) => {
  const index = args.indexOf(key);
  return index === -1 ? undefined : args[index + 1];
};
const preset = option('--preset');
if (preset && !PRESETS[preset]) {
  console.log(`Unknown preset "${preset}". Presets: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}
const names = preset
  ? PRESETS[preset]
  : (option('--names') ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
const candidatesPath = option('--candidates');
const top = Number(option('--top') ?? 50);
const concurrency = Math.max(1, Number(option('--concurrency') ?? 4));
const model = option('--model');
const outPath = option('--out');
const write = args.includes('--write');
const listOnly = args.includes('--list');
const skipDone = args.includes('--skip-done');

type FlagRow = { id: string; name: string; views: number };

function print(result: TimelineResult) {
  const cost = result.usage.estimatedCostUsd ? `$${Number(result.usage.estimatedCostUsd).toFixed(3)}` : 'cost unknown';
  console.log(`\n━━ ${result.flag.name} · ${result.status} · ${result.usage.webSearchCalls} searches · ${cost}`);
  for (const event of result.events) {
    const span = event.endYear ? `${event.year}–${event.endYear}` : `${event.year}`;
    const link = event.versionFlagId ? ' [links to version page]' : '';
    console.log(`  ${span.padEnd(10)} ${event.title}${link}  (${event.origin})`);
    if (event.detail) console.log(`             ${event.detail}`);
    for (const source of event.sources) console.log(`             ↳ ${source}`);
  }
  for (const drop of result.dropped) console.log(`  ✕ ${drop.year} ${drop.title} — ${drop.reason}`);
  if (result.notes) console.log(`  notes: ${result.notes}`);
}

/** The flags to research: named ones, or the most viewed current flags in the candidates file. */
function selectFlags(all: FlagRow[]) {
  if (candidatesPath) {
    const candidateIds = new Set(
      (JSON.parse(readFileSync(candidatesPath, 'utf8')) as { id: string }[]).map((candidate) => candidate.id),
    );
    return all
      .filter((row) => candidateIds.has(row.id) && !isHistoricalVersion(row.name))
      .sort((a, b) => b.views - a.views)
      .slice(0, top);
  }
  return names.flatMap((name) => {
    // Exact name first, then the current flag of that lineage: "Afghanistan" finds "the Islamic Emirate of Afghanistan".
    const flag =
      all.find((row) => row.name.toLowerCase() === name.toLowerCase()) ??
      all.find((row) => timelineKey(row.name) === timelineKey(name) && !isHistoricalVersion(row.name));
    if (!flag) console.log(`━━ ${name}: no flag with that name`);
    return flag ? [flag] : [];
  });
}

async function main() {
  if (names.length === 0 && !candidatesPath) {
    console.log('Pass --names "Bhutan,France" or --candidates <file> --top <n>');
    process.exit(1);
  }

  const all: FlagRow[] = await db.select({ id: flags.id, name: flags.name, views: flags.views }).from(flags);
  let selected = selectFlags(all);

  if (skipDone) {
    const done = await db
      .select({ flagId: flagTimelines.flagId, pipelineVersion: flagTimelines.pipelineVersion })
      .from(flagTimelines);
    const doneIds = new Set(done.filter((row) => row.pipelineVersion === PIPELINE_VERSION).map((row) => row.flagId));
    selected = selected.filter((flag) => !doneIds.has(flag.id));
  }

  if (listOnly) {
    selected.forEach((flag, i) => console.log(`${String(i + 1).padStart(3)}. ${flag.name}  (${flag.views.toLocaleString()} views)`));
    process.exit(0);
  }

  const versionsOf = (flag: FlagRow): CatalogueVersion[] => {
    const key = timelineKey(flag.name);
    return all
      .filter((row) => row.id !== flag.id && timelineKey(row.name) === key && isHistoricalVersion(row.name))
      .flatMap((row) => {
        const span = parseYearSpan(row.name);
        return span ? [{ flagId: row.id, name: row.name, ...span }] : [];
      })
      .sort((a, b) => a.start - b.start);
  };

  const results: TimelineResult[] = [];
  const failed: string[] = [];
  let stopReason: string | null = null;
  const queue = [...selected];

  // A few flags at a time; stop everything if the account is out of credits rather than failing each flag in turn.
  async function worker() {
    for (let flag = queue.shift(); flag && !stopReason; flag = queue.shift()) {
      try {
        const result = await researchFlagTimeline(flag, versionsOf(flag), { model });
        results.push(result);
        print(result);
        if (write) {
          await saveFlagTimeline(result);
          console.log(`  saved ${flag.name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push(flag.name);
        console.log(`\n━━ ${flag.name}: failed — ${message}`);
        if (/credits|quota|billing/i.test(message)) stopReason = message;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));

  const total = results.reduce((sum, r) => sum + Number(r.usage.estimatedCostUsd ?? 0), 0);
  const ok = results.filter((r) => r.status === 'ok').length;
  console.log(`\n${results.length} researched (${ok} ok, ${results.length - ok} insufficient) · ${failed.length} failed · estimated $${total.toFixed(3)}`);
  if (stopReason) console.log(`Stopped early: ${stopReason}\n${queue.length} flags not attempted.`);
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`Wrote ${outPath}`);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
