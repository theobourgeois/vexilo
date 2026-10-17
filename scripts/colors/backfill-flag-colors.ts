import 'dotenv/config';

import { eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { flagColors, flags } from '../../src/db/schema';
import { storeFlagColors } from '../../src/lib/flag-palette';

/**
 * Reads the colours of every flag image into vexilo_flag_color, for colour search.
 * Only flags with no stored colours (or whose image changed since) are processed, so it
 * can be stopped and re-run. Apply drizzle/0007_add_flag_colors.sql first.
 *   npm run colors:backfill
 *   npm run colors:backfill -- --limit 200 --concurrency 6   # Wikimedia rate-limits above ~3
 *   npm run colors:backfill -- --retry-empty   # also retry images that couldn't be read
 */

function parseArgs(argv: string[]) {
  const args = { limit: Infinity, concurrency: 3, retryEmpty: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (arg === '--retry-empty') args.retryEmpty = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pending = await db
    .select({ id: flags.id, name: flags.name, image: flags.image })
    .from(flags)
    .leftJoin(flagColors, eq(flagColors.flagId, flags.id))
    .where(
      or(
        isNull(flagColors.flagId),
        sql`${flagColors.image} <> ${flags.image}`,
        args.retryEmpty ? sql`jsonb_array_length(${flagColors.colors}) = 0` : sql`false`,
      ),
    )
    .orderBy(sql`${flags.favorites} desc`);

  const queue = pending.slice(0, args.limit);
  console.log(`[colors] ${pending.length} flags need colours; processing ${queue.length}`);

  let done = 0;
  let empty = 0;
  const started = Date.now();
  const worker = async () => {
    for (let flag = queue.shift(); flag; flag = queue.shift()) {
      const palette = await storeFlagColors(flag.id, flag.image).catch((error) => {
        console.error(`[colors] ${flag.name}: ${error instanceof Error ? error.message : error}`);
        return [];
      });
      if (palette.length === 0) empty++;
      if (++done % 100 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`[colors] ${done} done, ${empty} unreadable, ${rate.toFixed(1)}/s`);
      }
    }
  };
  await Promise.all(Array.from({ length: args.concurrency }, worker));
  console.log(`[colors] finished: ${done} processed, ${empty} unreadable`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
