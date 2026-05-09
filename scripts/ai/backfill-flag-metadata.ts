import 'dotenv/config';

import { asc, eq } from 'drizzle-orm';

import { upsertFlagMetadataMirror } from '../../src/actions/flag-ai-metadata';
import { db } from '../../src/db';
import { flags } from '../../src/db/schema';

type ParsedArgs = {
  limit?: number;
  offset: number;
  flagId?: string;
  dryRun: boolean;
};

function readOption(args: string[], key: string): string | undefined {
  const exact = args.find((arg) => arg.startsWith(`${key}=`));
  if (exact) {
    return exact.slice(key.length + 1);
  }

  const index = args.indexOf(key);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function parsePositiveInteger(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  return {
    limit: parsePositiveInteger(readOption(argv, '--limit')),
    offset: parsePositiveInteger(readOption(argv, '--offset')) ?? 0,
    flagId: readOption(argv, '--flag-id')?.trim() || undefined,
    dryRun: argv.includes('--dry-run'),
  };
}

function printUsage() {
  console.log(
    [
      'Usage:',
      '  tsx scripts/ai/backfill-flag-metadata.ts',
      '  tsx scripts/ai/backfill-flag-metadata.ts --limit 100 --offset 0',
      '  tsx scripts/ai/backfill-flag-metadata.ts --flag-id <uuid>',
      '',
      'Optional flags:',
      '  --limit <number>   Number of flags to process',
      '  --offset <number>  Number of flags to skip before processing',
      '  --flag-id <uuid>   Backfill a single flag by id',
      '  --dry-run          Show what would be upserted without writing',
    ].join('\n'),
  );
}

async function getFlagsToBackfill(args: ParsedArgs) {
  let query = db
    .select({
      id: flags.id,
      name: flags.name,
      link: flags.link,
      sources: flags.sources,
      tags: flags.tags,
      description: flags.description,
      index: flags.index,
    })
    .from(flags)
    .orderBy(asc(flags.index))
    .$dynamic();

  if (args.flagId) {
    query = query.where(eq(flags.id, args.flagId));
  }

  if (typeof args.limit === 'number') {
    query = query.limit(args.limit);
  }

  if (args.offset > 0) {
    query = query.offset(args.offset);
  }

  return query;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  const rows = await getFlagsToBackfill(args);

  if (rows.length === 0) {
    console.log('No flags matched the requested backfill scope.');
    return;
  }

  console.log(
    `Preparing metadata mirror backfill for ${rows.length} flag${rows.length === 1 ? '' : 's'}...`,
  );

  for (const [index, flag] of rows.entries()) {
    if (args.dryRun) {
      console.log(
        `[${index + 1}/${rows.length}] Would upsert metadata mirror for ${flag.name} (#${flag.index})`,
      );
      continue;
    }

    await upsertFlagMetadataMirror({
      flagId: flag.id,
      name: flag.name,
      link: flag.link,
      sources: flag.sources,
      tags: flag.tags,
      description: flag.description,
    });

    console.log(
      `[${index + 1}/${rows.length}] Upserted metadata mirror for ${flag.name} (#${flag.index})`,
    );
  }

  console.log(
    args.dryRun
      ? 'Dry run complete.'
      : 'Metadata mirror backfill completed successfully.',
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Metadata mirror backfill failed: ${message}`);
  process.exitCode = 1;
});
