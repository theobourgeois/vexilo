import 'dotenv/config';

import { db } from '../../src/db';
import { flagAiMetadata, flags } from '../../src/db/schema';
import { generateAndStoreFlagAiMetadata } from '../../src/lib/ai/flag-metadata-pipeline';
import { asc, eq, isNull } from 'drizzle-orm';

type ParsedArgs = {
  limit: number;
  dryRun: boolean;
  model?: string;
};

type MissingFlagRecord = {
  id: string;
  name: string;
  index: number;
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

function parseArgs(argv: string[]): ParsedArgs {
  const limitValue = readOption(argv, '--limit');
  const DEFAULT_LIMIT = 20;
  const model = readOption(argv, '--model');
  const dryRun = argv.includes('--dry-run');
  const parsedLimit =
    typeof limitValue === 'string' && limitValue.trim()
      ? Number.parseInt(limitValue, 10)
      : DEFAULT_LIMIT;

  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
    dryRun,
    model: model?.trim() || undefined,
  };
}

function printUsage(): void {
  console.log(
    [
      'Usage:',
      '  npm run ai:generate-missing-flags',
      '  npm run ai:generate-missing-flags -- --limit 10',
      '',
      'Optional flags:',
      '  --limit <number>       Number of missing flags to process (default: 10)',
      '  --dry-run              Generate metadata without writing to the database',
      '  --model <model-name>   Override the default model',
    ].join('\n'),
  );
}

function formatUsd(value: number): string {
  return value.toFixed(6);
}

function getEstimatedCostUsd(value: unknown): number {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  const estimatedCostUsd = (value as { estimatedCostUsd?: unknown })
    .estimatedCostUsd;
  if (typeof estimatedCostUsd !== 'string') {
    return 0;
  }

  const parsed = Number.parseFloat(estimatedCostUsd);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getMissingFlags(limit: number): Promise<MissingFlagRecord[]> {
  const rows = await db
    .select({
      id: flags.id,
      name: flags.name,
      index: flags.index,
    })
    .from(flags)
    .leftJoin(flagAiMetadata, eq(flagAiMetadata.flagId, flags.id))
    .where(isNull(flagAiMetadata.flagId))
    .orderBy(asc(flags.index))
    .limit(limit);

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  const missingFlags = await getMissingFlags(args.limit);

  if (missingFlags.length === 0) {
    console.log('No flags without metadata were found.');
    return;
  }

  console.log(
    `Processing ${missingFlags.length} flag${missingFlags.length === 1 ? '' : 's'} without metadata...`,
  );

  let totalCostUsd = 0;
  let successCount = 0;
  let failureCount = 0;

  for (const [index, flag] of missingFlags.entries()) {
    try {
      const result = await generateAndStoreFlagAiMetadata({
        flagId: flag.id,
        dryRun: args.dryRun,
        ...(args.model ? { model: args.model } : {}),
      });

      const requestCostUsd = getEstimatedCostUsd(result.requestUsage);
      totalCostUsd += requestCostUsd;
      successCount += 1;

      console.log(
        `[${index + 1}/${missingFlags.length}] Generated metadata for ${flag.name} (#${flag.index}) - $${formatUsd(requestCostUsd)}`,
      );

      if (!result.persisted && result.persistenceError) {
        failureCount += 1;
        console.error(
          `  Persist failed for ${flag.name}: ${result.persistenceError}`,
        );
        process.exitCode = 1;
      }
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[${index + 1}/${missingFlags.length}] Failed for ${flag.name} (#${flag.index}) - ${message}`,
      );
      process.exitCode = 1;
    }
  }

  console.log('');
  console.log(
    `Generated metadata for ${successCount} flag${successCount === 1 ? '' : 's'}.`,
  );
  if (failureCount > 0) {
    console.log(`Failures: ${failureCount}`);
  }
  console.log(`Total estimated cost: $${formatUsd(totalCostUsd)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Batch flag AI metadata generation failed: ${message}`);
  process.exitCode = 1;
});
