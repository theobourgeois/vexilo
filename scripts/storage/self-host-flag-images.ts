import 'dotenv/config';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { asc, eq } from 'drizzle-orm';

import { db } from '../../src/db';
import { flags } from '../../src/db/schema';
import { CLOUD_FRONT_URL } from '../../src/lib/constant';

type ParsedArgs = {
  dryRun: boolean;
  limit?: number;
  host?: string;
  delayMs: number;
  delayJitterMs: number;
  maxRetries: number;
  maxRetryWaitMs: number;
  strictRetryAfter: boolean;
};

type FlagImageRecord = {
  id: string;
  name: string;
  index: number;
  image: string;
};

const DEFAULT_REGION = process.env.S3_REGION || 'us-east-2';
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_DELAY_JITTER_MS = 2000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MAX_RETRY_WAIT_MS = 120000;
const MAX_ADAPTIVE_COOLDOWN_MS = 120000;
const cloudFrontHost = new URL(CLOUD_FRONT_URL).hostname;

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
  const host = readOption(argv, '--host')?.trim().toLowerCase();
  const delayMsValue = readOption(argv, '--delay-ms');
  const delayJitterMsValue = readOption(argv, '--delay-jitter-ms');
  const maxRetriesValue = readOption(argv, '--max-retries');
  const maxRetryWaitMsValue = readOption(argv, '--max-retry-wait-ms');
  const dryRun = argv.includes('--dry-run');
  const strictRetryAfter = argv.includes('--strict-retry-after');
  const parsedLimit =
    typeof limitValue === 'string' && limitValue.trim()
      ? Number.parseInt(limitValue, 10)
      : undefined;
  const parsedDelayMs =
    typeof delayMsValue === 'string' && delayMsValue.trim()
      ? Number.parseInt(delayMsValue, 10)
      : DEFAULT_DELAY_MS;
  const parsedDelayJitterMs =
    typeof delayJitterMsValue === 'string' && delayJitterMsValue.trim()
      ? Number.parseInt(delayJitterMsValue, 10)
      : DEFAULT_DELAY_JITTER_MS;
  const parsedMaxRetries =
    typeof maxRetriesValue === 'string' && maxRetriesValue.trim()
      ? Number.parseInt(maxRetriesValue, 10)
      : DEFAULT_MAX_RETRIES;
  const parsedMaxRetryWaitMs =
    typeof maxRetryWaitMsValue === 'string' && maxRetryWaitMsValue.trim()
      ? Number.parseInt(maxRetryWaitMsValue, 10)
      : DEFAULT_MAX_RETRY_WAIT_MS;

  let maxRetryWaitMs: number;
  if (strictRetryAfter) {
    maxRetryWaitMs = Number.POSITIVE_INFINITY;
  } else if (Number.isFinite(parsedMaxRetryWaitMs) && parsedMaxRetryWaitMs === -1) {
    maxRetryWaitMs = Number.POSITIVE_INFINITY;
  } else if (Number.isFinite(parsedMaxRetryWaitMs) && parsedMaxRetryWaitMs >= 0) {
    maxRetryWaitMs = parsedMaxRetryWaitMs;
  } else {
    maxRetryWaitMs = DEFAULT_MAX_RETRY_WAIT_MS;
  }

  return {
    dryRun,
    host: host || undefined,
    limit:
      parsedLimit !== undefined && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : undefined,
    delayMs:
      Number.isFinite(parsedDelayMs) && parsedDelayMs >= 0 ? parsedDelayMs : DEFAULT_DELAY_MS,
    delayJitterMs:
      Number.isFinite(parsedDelayJitterMs) && parsedDelayJitterMs >= 0
        ? parsedDelayJitterMs
        : DEFAULT_DELAY_JITTER_MS,
    maxRetries:
      Number.isFinite(parsedMaxRetries) && parsedMaxRetries >= 0
        ? parsedMaxRetries
        : DEFAULT_MAX_RETRIES,
    maxRetryWaitMs,
    strictRetryAfter,
  };
}

function printUsage(): void {
  console.log(
    [
      'Usage:',
      '  npm run images:self-host-flags',
      '  npm run images:self-host-flags -- --dry-run',
      '  npm run images:self-host-flags -- --limit 25',
      '  npm run images:self-host-flags -- --host upload.wikimedia.org',
      '',
      'Optional flags:',
      '  --dry-run              Show which rows would be migrated without uploading or writing',
      '  --limit <number>       Process at most N non-self-hosted flag images',
      '  --host <hostname>      Only process images from a specific external host',
      `  --delay-ms <number>    Wait between downloads (default: ${DEFAULT_DELAY_MS})`,
      `  --delay-jitter-ms <number> Add random delay jitter (default: ${DEFAULT_DELAY_JITTER_MS})`,
      `  --max-retries <number> Retry transient download failures (default: ${DEFAULT_MAX_RETRIES})`,
      `  --max-retry-wait-ms <number> Cap sleeps between retries, including Retry-After (default: ${DEFAULT_MAX_RETRY_WAIT_MS}; use -1 for unlimited)`,
      '  --strict-retry-after     Never cap Retry-After headers (can mean multi-minute waits)',
    ].join('\n'),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function getS3Hosts(bucketName: string, region: string): Set<string> {
  return new Set([
    `${bucketName}.s3.amazonaws.com`,
    `${bucketName}.s3.${region}.amazonaws.com`,
    `s3.amazonaws.com`,
    `s3.${region}.amazonaws.com`,
  ]);
}

function isSelfHostedUrl(url: string, bucketName: string, region: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return true;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return true;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === cloudFrontHost) {
    return true;
  }

  const s3Hosts = getS3Hosts(bucketName, region);
  if (s3Hosts.has(hostname)) {
    return (
      hostname.startsWith(`${bucketName}.`) ||
      parsedUrl.pathname.startsWith(`/${bucketName}/`)
    );
  }

  return false;
}

function extensionFromContentType(contentType: string | null): string | undefined {
  if (!contentType) {
    return undefined;
  }

  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const contentTypeMap: Record<string, string> = {
    'image/svg+xml': 'svg',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
  };

  return contentTypeMap[normalized];
}

function contentTypeFromExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  const extensionMap: Record<string, string> = {
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
  };

  return extensionMap[normalized] || 'application/octet-stream';
}

function extensionFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/);
    if (!match) {
      return undefined;
    }

    const extension = match[1];
    const allowedExtensions = new Set([
      'svg',
      'png',
      'jpg',
      'jpeg',
      'webp',
      'gif',
      'avif',
      'bmp',
      'ico',
    ]);

    return allowedExtensions.has(extension) ? extension : undefined;
  } catch {
    return undefined;
  }
}

function getTargetKey(flag: FlagImageRecord, sourceUrl: string): string {
  const slug = slugify(flag.name) || `flag-${flag.index}`;
  const extension = extensionFromUrl(sourceUrl) || 'svg';
  const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension;
  return `flags/${flag.index}-${slug}.${normalizedExtension}`;
}

function getTargetUrl(key: string): string {
  return `${CLOUD_FRONT_URL}/${key}`;
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const asSeconds = Number.parseFloat(value);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.ceil(asSeconds * 1000);
  }

  const asDate = Date.parse(value);
  if (Number.isNaN(asDate)) {
    return undefined;
  }

  const delayMs = asDate - Date.now();
  return delayMs > 0 ? delayMs : 0;
}

function shouldRetryDownload(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function getRandomInt(maxInclusive: number): number {
  if (maxInclusive <= 0) {
    return 0;
  }

  return Math.floor(Math.random() * (maxInclusive + 1));
}

function getRetryDelayMs(
  attempt: number,
  options: {
    retryAfterMs?: number;
    maxRetryWaitMs: number;
    strictRetryAfter: boolean;
  },
): { delayMs: number; retryHintMs?: number; wasRetryAfterCapped: boolean } {
  const exponentialBackoffMs = Math.min(60000, 2000 * 2 ** attempt);
  const jitterMs = Math.floor(Math.random() * 750);

  if (options.retryAfterMs === undefined) {
    return {
      delayMs: exponentialBackoffMs + jitterMs,
      wasRetryAfterCapped: false,
    };
  }

  if (options.strictRetryAfter || options.maxRetryWaitMs === Number.POSITIVE_INFINITY) {
    return {
      delayMs: options.retryAfterMs,
      retryHintMs: options.retryAfterMs,
      wasRetryAfterCapped: false,
    };
  }

  const cappedDelayMs = Math.min(options.retryAfterMs, options.maxRetryWaitMs);
  const wasRetryAfterCapped = cappedDelayMs < options.retryAfterMs;

  return {
    delayMs: Math.max(cappedDelayMs, exponentialBackoffMs + jitterMs),
    retryHintMs: options.retryAfterMs,
    wasRetryAfterCapped,
  };
}

function getInterRequestDelayMs(
  baseDelayMs: number,
  delayJitterMs: number,
  adaptiveCooldownMs: number,
): number {
  return baseDelayMs + getRandomInt(delayJitterMs) + adaptiveCooldownMs;
}

async function getCandidateFlags(
  bucketName: string,
  region: string,
  args: ParsedArgs,
): Promise<FlagImageRecord[]> {
  const rows = await db
    .select({
      id: flags.id,
      name: flags.name,
      index: flags.index,
      image: flags.image,
    })
    .from(flags)
    .orderBy(asc(flags.index));

  const filtered = rows.filter((flag) => {
    if (isSelfHostedUrl(flag.image, bucketName, region)) {
      return false;
    }

    if (!args.host) {
      return true;
    }

    try {
      return new URL(flag.image).hostname.toLowerCase() === args.host;
    } catch {
      return false;
    }
  });

  return args.limit ? filtered.slice(0, args.limit) : filtered;
}

async function downloadImageWithRetries(
  url: string,
  options: {
    maxRetries: number;
    maxRetryWaitMs: number;
    strictRetryAfter: boolean;
    onRateLimit?: (retryHintMs?: number) => void;
  },
): Promise<{
  bytes: Uint8Array;
  contentType: string;
  finalUrl: string;
  extension: string;
}> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    if (attempt > 0) {
      const attemptLabel =
        options.maxRetries === 1
          ? 'retry'
          : `retry ${attempt}/${options.maxRetries}`;
      console.log(`  Waiting before ${attemptLabel}...`);
    }

    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'vexilo-self-host-flag-images/1.0',
        accept: 'image/*,*/*;q=0.8',
      },
    });

    if (response.ok) {
      const finalUrl = response.url || url;
      const contentTypeHeader = response.headers.get('content-type');
      const extension =
        extensionFromContentType(contentTypeHeader) ||
        extensionFromUrl(finalUrl) ||
        extensionFromUrl(url);

      if (!extension) {
        throw new Error(
          `Could not determine file extension from content-type "${contentTypeHeader}" or URL`,
        );
      }

      const contentType = contentTypeFromExtension(extension);
      const bytes = new Uint8Array(await response.arrayBuffer());

      if (bytes.byteLength === 0) {
        throw new Error('Downloaded image is empty');
      }

      return {
        bytes,
        contentType,
        finalUrl,
        extension,
      };
    }

    if (attempt >= options.maxRetries || !shouldRetryDownload(response.status)) {
      throw new Error(`Download failed with status ${response.status} ${response.statusText}`);
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    const { delayMs, retryHintMs, wasRetryAfterCapped } = getRetryDelayMs(attempt, {
      retryAfterMs,
      maxRetryWaitMs: options.maxRetryWaitMs,
      strictRetryAfter: options.strictRetryAfter,
    });
    if (response.status === 429) {
      options.onRateLimit?.(retryHintMs);
    }
    if (wasRetryAfterCapped && typeof retryHintMs === 'number') {
      console.log(
        `  Download got ${response.status}; server asked for ${retryHintMs}ms via Retry-After but max is ${options.maxRetryWaitMs === Number.POSITIVE_INFINITY ? 'unlimited' : `${options.maxRetryWaitMs}ms`}; retrying in ${delayMs}ms...`,
      );
    } else {
      console.log(`  Download got ${response.status}; retrying in ${delayMs}ms...`);
    }
    await sleep(delayMs);
  }

  throw new Error('Download failed after exhausting retries');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  const bucketName = getRequiredEnv('S3_BUCKET_NAME');
  const accessKeyId = getRequiredEnv('S3_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('S3_SECRET_ACCESS_KEY');

  const s3Client = new S3Client({
    region: DEFAULT_REGION,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const candidates = await getCandidateFlags(bucketName, DEFAULT_REGION, args);

  if (candidates.length === 0) {
    console.log('No non-self-hosted flag images were found.');
    return;
  }

  console.log(
    `Found ${candidates.length} non-self-hosted flag image${candidates.length === 1 ? '' : 's'}.`,
  );
  const maxRetryWaitLabel =
    args.strictRetryAfter || args.maxRetryWaitMs === Number.POSITIVE_INFINITY
      ? 'unlimited'
      : `${args.maxRetryWaitMs}ms`;

  console.log(
    `Using ${args.delayMs}ms base pacing, ${args.delayJitterMs}ms jitter, up to ${args.maxRetries} retr${args.maxRetries === 1 ? 'y' : 'ies'} per image, and a ${maxRetryWaitLabel} cap on retry sleeps${args.strictRetryAfter ? ' (strict Retry-After)' : ''}.`,
  );

  if (args.dryRun) {
    for (const flag of candidates) {
      const targetKey = getTargetKey(flag, flag.image);
      console.log(`[dry-run] ${flag.name} (#${flag.index})`);
      console.log(`  from: ${flag.image}`);
      console.log(`  to:   ${getTargetUrl(targetKey)}`);
    }
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  let adaptiveCooldownMs = 0;

  for (const [candidateIndex, flag] of candidates.entries()) {
    const position = `[${candidateIndex + 1}/${candidates.length}]`;

    try {
      if (
        candidateIndex > 0 &&
        (args.delayMs > 0 || args.delayJitterMs > 0 || adaptiveCooldownMs > 0)
      ) {
        const waitMs = getInterRequestDelayMs(
          args.delayMs,
          args.delayJitterMs,
          adaptiveCooldownMs,
        );
        console.log(
          `${position} Waiting ${waitMs}ms before next download${adaptiveCooldownMs > 0 ? ` (includes ${adaptiveCooldownMs}ms rate-limit cooldown)` : ''}`,
        );
        await sleep(waitMs);
      }

      console.log(`${position} Downloading ${flag.name} (#${flag.index})`);
      const download = await downloadImageWithRetries(flag.image, {
        maxRetries: args.maxRetries,
        maxRetryWaitMs: args.maxRetryWaitMs,
        strictRetryAfter: args.strictRetryAfter,
        onRateLimit: (retryHintMs) => {
          const cappedHint =
            retryHintMs === undefined || args.strictRetryAfter
              ? undefined
              : Math.min(retryHintMs, args.maxRetryWaitMs);
          const suggestedFromServer = cappedHint ?? retryHintMs;
          const nextCooldownMs = Math.min(
            MAX_ADAPTIVE_COOLDOWN_MS,
            Math.max(
              adaptiveCooldownMs + args.delayMs,
              suggestedFromServer !== undefined
                ? Math.min(suggestedFromServer, MAX_ADAPTIVE_COOLDOWN_MS)
                : args.delayMs * 3,
            ),
          );

          if (nextCooldownMs > adaptiveCooldownMs) {
            adaptiveCooldownMs = nextCooldownMs;
            console.log(
              `  Increasing future pacing cooldown to ${adaptiveCooldownMs}ms after rate limiting.`,
            );
          }
        },
      });
      const targetKey = `flags/${flag.index}-${slugify(flag.name) || `flag-${flag.index}`}.${download.extension === 'jpeg' ? 'jpg' : download.extension}`;
      const targetUrl = getTargetUrl(targetKey);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: targetKey,
          Body: Buffer.from(download.bytes),
          ContentType: download.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      await db
        .update(flags)
        .set({
          image: targetUrl,
        })
        .where(eq(flags.id, flag.id));

      successCount += 1;
      if (adaptiveCooldownMs > 0) {
        adaptiveCooldownMs = Math.max(0, Math.floor(adaptiveCooldownMs * 0.85));
      }
      console.log(`${position} Migrated ${flag.name}`);
      console.log(`  source: ${download.finalUrl}`);
      console.log(`  target: ${targetUrl}`);
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${position} Failed for ${flag.name} (#${flag.index}): ${message}`);
      process.exitCode = 1;
    }
  }

  console.log('');
  console.log(`Migrated ${successCount} flag image${successCount === 1 ? '' : 's'}.`);
  if (failureCount > 0) {
    console.log(`Failures: ${failureCount}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Flag image self-hosting failed: ${message}`);
  process.exitCode = 1;
});
