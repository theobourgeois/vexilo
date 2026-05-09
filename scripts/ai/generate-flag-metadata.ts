import 'dotenv/config';

import { generateAndStoreFlagAiMetadata } from '../../src/lib/ai/flag-metadata-pipeline';

type ParsedArgs = {
  id?: string;
  name?: string;
  index?: number;
  dryRun: boolean;
  model?: string;
};

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  const prefix =
    level === 'error' ? '[flag-ai:error]' : level === 'warn' ? '[flag-ai:warn]' : '[flag-ai]';

  if (data === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }

  console.log(`${prefix} ${message}`);
  console.log(JSON.stringify(data, null, 2));
}

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
  const id = readOption(argv, '--id');
  const name = readOption(argv, '--name');
  const indexValue = readOption(argv, '--index');
  const model = readOption(argv, '--model');
  const dryRun = argv.includes('--dry-run');

  const parsedIndex =
    typeof indexValue === 'string' && indexValue.trim()
      ? Number.parseInt(indexValue, 10)
      : undefined;

  return {
    id,
    name,
    index: Number.isFinite(parsedIndex) ? parsedIndex : undefined,
    dryRun,
    model,
  };
}

function printUsage(): void {
  console.log(
    [
      'Usage:',
      '  npm run ai:generate-flag -- --id <uuid>',
      '  npm run ai:generate-flag -- --name "Flag Name"',
      '  npm run ai:generate-flag -- --index <number>',
      '',
      'Optional flags:',
      '  --dry-run              Generate metadata without writing to the database',
      '  --model <model-name>   Override the default Gemini model',
    ].join('\n'),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selectors = [args.id, args.name, args.index].filter(
    (value) => value !== undefined,
  );

  if (selectors.length !== 1) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await generateAndStoreFlagAiMetadata(
    args.id
      ? { flagId: args.id, dryRun: args.dryRun, model: args.model, onLog: log }
      : args.name
        ? { flagName: args.name, dryRun: args.dryRun, model: args.model, onLog: log }
        : { flagIndex: args.index!, dryRun: args.dryRun, model: args.model, onLog: log },
  );

  if (!result.persisted && result.persistenceError) {
    console.error('[flag-ai:error] Metadata was generated but could not be stored.');
    console.error(result.persistenceError);
    process.exitCode = 1;
  }

  console.log(
    JSON.stringify(
      {
        flag: {
          id: result.flag.id,
          name: result.flag.name,
          index: result.flag.index,
        },
        model: result.model,
        dryRun: args.dryRun,
        persisted: result.persisted,
        persistenceError: result.persistenceError,
        payload: result.payload,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Flag AI metadata generation failed: ${message}`);
  process.exitCode = 1;
});
