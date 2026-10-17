import 'dotenv/config';

import { readFileSync, writeFileSync } from 'fs';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { flagColors, flags } from '../../src/db/schema';
import {
  type ImageCandidate,
  findImageReplacements,
  isImageGone,
  replaceFlagImage,
} from '../../src/lib/storage/flag-image-repair';

/**
 * One-time repair for flags whose Wikimedia image link is dead (the file was renamed or deleted).
 * What's left after this can be fixed one by one in admin → Broken images.
 *
 * Plan (read-only): finds dead links and proposes replacements (see findImageReplacements).
 *     npx tsx scripts/storage/repair-dead-flag-images.ts plan --out repair-plan.json
 *
 * Apply: copies each proposed replacement to CloudFront, points the flag at it and re-reads its colours.
 * Review the plan first and delete any "replacement" you don't want.
 *     npx tsx scripts/storage/repair-dead-flag-images.ts apply --plan repair-plan.json
 */

type PlanEntry = {
  flagId: string;
  name: string;
  oldImage: string;
  method: 'renamed' | 'moved' | 'exact-match' | 'needs-review' | 'not-found';
  replacement?: ImageCandidate;
  candidates: ImageCandidate[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function plan(out: string) {
  // Flags whose colours couldn't be read are the ones with unreadable images; confirm the link is dead.
  const suspects = await db
    .select({ id: flags.id, name: flags.name, image: flags.image })
    .from(flags)
    .innerJoin(flagColors, eq(flagColors.flagId, flags.id))
    .where(and(sql`jsonb_array_length(${flagColors.colors}) = 0`, sql`${flags.image} LIKE '%upload.wikimedia.org%'`));

  console.log(`[repair] checking ${suspects.length} flags with unreadable Wikimedia images`);
  const entries: PlanEntry[] = [];
  for (const flag of suspects) {
    if (!(await isImageGone(flag.image))) continue;
    const lookup = await findImageReplacements(flag, 3);
    const entry: PlanEntry = {
      flagId: flag.id,
      name: flag.name,
      oldImage: flag.image,
      method: lookup.method ?? (lookup.candidates.length > 0 ? 'needs-review' : 'not-found'),
      replacement: lookup.suggestion,
      candidates: lookup.candidates,
    };
    entries.push(entry);
    console.log(`[repair] ${entry.method.padEnd(12)} ${flag.name}${entry.replacement ? ` -> ${entry.replacement.title}` : ''}`);
    await sleep(200);
  }

  writeFileSync(out, JSON.stringify(entries, null, 2));
  const counts = entries.reduce<Record<string, number>>((acc, entry) => ({ ...acc, [entry.method]: (acc[entry.method] ?? 0) + 1 }), {});
  console.log(`[repair] ${entries.length} dead links:`, counts);
  console.log(`[repair] plan written to ${out}`);
}

async function apply(planPath: string) {
  const entries: PlanEntry[] = JSON.parse(readFileSync(planPath, 'utf8'));
  const accepted = entries.filter((entry) => entry.replacement);
  console.log(`[repair] applying ${accepted.length} replacements`);

  const failed: string[] = [];
  for (const entry of accepted) {
    try {
      const result = await replaceFlagImage(entry.flagId, entry.replacement!.url, entry.oldImage);
      if (!result) console.log(`[repair] skipped ${entry.name}: image changed since the plan was made`);
      else console.log(`[repair] ${entry.name} -> ${result.image} (${result.colors.length} colours)`);
    } catch (error) {
      failed.push(entry.name);
      console.error(`[repair] failed ${entry.name}: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(1500);
  }
  console.log(
    `[repair] done: ${accepted.length - failed.length} applied, ${failed.length} failed${failed.length ? ` (re-run to retry: ${failed.join(', ')})` : ''}`,
  );
}

const [command, flag, value] = process.argv.slice(2);
const run =
  command === 'plan' && (!flag || flag === '--out')
    ? plan(value || 'flag-image-repair-plan.json')
    : command === 'apply' && flag === '--plan' && value
      ? apply(value)
      : Promise.reject(new Error('Usage: plan [--out file] | apply --plan file'));

run
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
