import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpus, setPriority } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { and, isNull, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { flags, flagParts } from '../../src/db/schema';
import { MAX_FLAG_IMAGE_BYTES } from '../../src/lib/batch-flags';
import { CLOUD_FRONT_URL } from '../../src/lib/constant';
import { studioDesignSchema } from '../../src/lib/studio-design-schema';
import {
  extractRaster,
  rasterDesign,
  RASTER_VERSION,
} from './raster-extractor';

/** Bounded pilot by default. --write publishes validated parts; --report is always local. */
function parseArgs(argv: string[]) {
  const args = {
    only: [] as number[],
    limit: 50,
    seed: 42,
    force: false,
    write: false,
    report: '/tmp/vexilo-raster',
    sources: '',
    concurrency: 1,
    shard: -1,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--only') args.only = (argv[++i] ?? '').split(',').map(Number);
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--seed') args.seed = Number(argv[++i]);
    else if (arg === '--report') args.report = argv[++i];
    else if (arg === '--sources') args.sources = argv[++i];
    else if (arg === '--force') args.force = true;
    else if (arg === '--write') args.write = true;
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (arg === '--shard') args.shard = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (
    !Number.isSafeInteger(args.limit) ||
    args.limit <= 0 ||
    !Number.isSafeInteger(args.seed) ||
    args.only.some((n) => !Number.isSafeInteger(n) || n <= 0) ||
    !Number.isSafeInteger(args.concurrency) ||
    args.concurrency < 1 ||
    args.concurrency > cpus().length
  )
    throw new Error(
      'Use a positive integer --limit/--only, integer --seed, and --concurrency up to the CPU count',
    );
  if (!args.report || (args.sources && args.write))
    throw new Error(
      '--sources is for local experiments only; publishing always fetches the current source',
    );
  return args;
}
const escaped = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
type Entry = {
  index: number;
  id: string;
  name: string;
  image: string;
  status: string;
  error?: string;
  parts?: number;
  layout?: string;
  mismatch?: number;
  meanError?: number;
  fieldShare?: number;
};

/** Deterministic, interleaved format strata; the reported seed and indices reproduce the pilot. */
function sample<T extends { id: string; image: string }>(
  rows: T[],
  seed: number,
  limit: number,
) {
  const groups = new Map<string, T[]>();
  const hash = (row: T) =>
    createHash('sha256').update(`${seed}:${row.id}`).digest('hex');
  for (const row of rows) {
    const format =
      new URL(row.image, 'https://vexilo.org').pathname
        .split('.')
        .pop()
        ?.toLowerCase() ?? 'other';
    const key = format === 'jpeg' ? 'jpg' : format;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values())
    group.sort((a, b) => hash(a).localeCompare(hash(b)));
  const out: T[] = [];
  for (let i = 0; out.length < Math.min(limit, rows.length); i++)
    for (const key of [...groups.keys()].sort()) {
      const row = groups.get(key)![i];
      if (row && out.length < limit) out.push(row);
    }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let rows = await db
    .select({
      id: flags.id,
      index: flags.index,
      name: flags.name,
      image: flags.image,
    })
    .from(flags)
    .where(
      and(
        isNull(flags.design),
        sql`${flags.image} ~* ${'\\.(png|jpe?g|gif|webp|avif)($|[?])'}`,
      ),
    )
    .orderBy(flags.index);
  if (args.only.length) rows = rows.filter((r) => args.only.includes(r.index));
  if (!args.force) {
    const done = await db
      .select({
        id: flagParts.flagId,
        image: flagParts.image,
        version: flagParts.version,
      })
      .from(flagParts);
    const current = new Set(
      done
        .filter((d) => d.version === RASTER_VERSION)
        .map((d) => `${d.id}|${d.image}`),
    );
    rows = rows.filter((r) => !current.has(`${r.id}|${r.image}`));
  }
  rows = args.only.length
    ? rows.slice(0, args.limit)
    : sample(rows, args.seed, args.limit);
  await mkdir(args.report, { recursive: true });
  if (args.concurrency > 1 && rows.length > 1) return runWorkers(args, rows);
  if (args.shard >= 0) sharp.concurrency(1);
  const manifestFile = path.join(
    args.report,
    args.shard >= 0 ? `manifest-${args.shard}.json` : 'manifest.json',
  );
  const log = (line: string) =>
    console.log(
      args.shard >= 0 ? `[raster ${args.shard}] ${line}` : `[raster] ${line}`,
    );
  log(
    `${rows.length} sources, version ${RASTER_VERSION}, seed ${args.seed}, ${args.write ? 'publishing validated parts' : 'local review only'}`,
  );
  const required = (name: string) => {
    const v = process.env[name]?.trim();
    if (!v) throw new Error(`Missing ${name}`);
    return v;
  };
  const s3 = args.write
    ? new S3Client({
        region: process.env.S3_REGION || 'us-east-2',
        credentials: {
          accessKeyId: required('S3_ACCESS_KEY_ID'),
          secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
        },
      })
    : null;
  const bucket = args.write ? required('S3_BUCKET_NAME') : '';
  const manifest: Entry[] = [];
  for (const flag of rows) {
    const entry: Entry = { ...flag, status: 'review' };
    const dir = path.join(args.report, String(flag.index));
    await mkdir(dir, { recursive: true });
    let sourceHash = '';
    try {
      let source: Buffer;
      if (args.sources)
        source = await readFile(path.join(args.sources, String(flag.index)));
      else {
        // Some catalogue images are protocol-relative (//upload.wikimedia.org/...).
        const response = await fetch(
          new URL(flag.image, 'https://vexilo.org'),
          {
            signal: AbortSignal.timeout(30_000),
            headers: { 'User-Agent': 'VexiloBot/1.0 (https://vexilo.org)' },
          },
        );
        if (!response.ok)
          throw new Error(`Source request failed (${response.status})`);
        if (
          Number(response.headers.get('content-length')) > MAX_FLAG_IMAGE_BYTES
        )
          throw new Error('Source exceeds 4 MB');
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (!response.body) throw new Error('Empty source response');
        const reader = response.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > MAX_FLAG_IMAGE_BYTES) {
              await reader.cancel();
              throw new Error('Source exceeds 4 MB');
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        source = Buffer.concat(chunks);
      }
      if (source.length > MAX_FLAG_IMAGE_BYTES)
        throw new Error('Source exceeds 4 MB');
      sourceHash = createHash('sha256').update(source).digest('hex');
      await writeFile(path.join(dir, 'source'), source);
      const result = await extractRaster(source);
      const base = `flags/raster-parts/${flag.index}/${sourceHash.slice(0, 12)}-r${RASTER_VERSION}`;
      const urls: string[] = [];
      await writeFile(path.join(dir, 'original.png'), result.original);
      await writeFile(path.join(dir, 'field.png'), result.field);
      await writeFile(path.join(dir, 'rebuilt.png'), result.rebuilt);
      for (const [i, part] of result.parts.entries()) {
        const key = `${base}/part-${i + 1}.png`;
        await writeFile(path.join(dir, `part-${i + 1}.png`), part.png);
        if (s3)
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: part.png,
              ContentType: 'image/png',
              CacheControl: 'public, max-age=31536000, immutable',
            }),
          );
        urls.push(`${CLOUD_FRONT_URL}/${key}`);
      }
      let fieldUrl: string | undefined;
      if (result.fit.kind === 'image') {
        const key = `${base}/field.png`;
        if (s3)
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: result.field,
              ContentType: 'image/png',
              CacheControl: 'public, max-age=31536000, immutable',
            }),
          );
        fieldUrl = `${CLOUD_FRONT_URL}/${key}`;
      }
      const design = studioDesignSchema.parse(
        rasterDesign(result, urls, fieldUrl),
      );
      await writeFile(
        path.join(dir, 'design.json'),
        JSON.stringify(design, null, 2),
      );
      Object.assign(entry, {
        status: 'ok',
        parts: result.parts.length,
        layout: result.fit.kind === 'layout' ? result.fit.layout : 'image',
        mismatch: result.mismatch,
        meanError: result.meanError,
        fieldShare: result.fieldShare,
      });
      if (args.write) {
        const row = {
          flagId: flag.id,
          image: flag.image,
          sourceHash,
          version: RASTER_VERSION,
          status: 'ok' as const,
          error: null,
          design,
          mismatch: result.mismatch,
        };
        await db
          .insert(flagParts)
          .values(row)
          .onConflictDoUpdate({
            target: flagParts.flagId,
            set: { ...row, updatedAt: new Date() },
          });
      }
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      if (args.write) {
        const row = {
          flagId: flag.id,
          image: flag.image,
          sourceHash: sourceHash || '-',
          version: RASTER_VERSION,
          status: 'failed' as const,
          error: entry.error.slice(0, 2000),
          design: null,
          mismatch: null,
        };
        await db
          .insert(flagParts)
          .values(row)
          .onConflictDoUpdate({
            target: flagParts.flagId,
            set: { ...row, updatedAt: new Date() },
          });
      }
    }
    manifest.push(entry);
    await writeManifest(manifestFile, args, manifest);
    log(
      `${manifest.length}/${rows.length} #${flag.index} ${flag.name}: ${entry.error ?? `${entry.parts} objects; ${entry.layout}; ${(entry.mismatch! * 100).toFixed(3)}% mismatch`}`,
    );
  }
  await writeManifest(manifestFile, args, manifest);
  if (args.shard < 0) await writeReport(args, manifest);
}

type Args = ReturnType<typeof parseArgs>;

const writeManifest = (file: string, args: Args, manifest: Entry[]) =>
  writeFile(
    file,
    JSON.stringify(
      {
        version: RASTER_VERSION,
        seed: args.seed,
        published: args.write,
        flags: manifest,
      },
      null,
      2,
    ),
  );

/**
 * Extraction is synchronous pixel work, so parallelism means processes. Each worker takes every
 * Nth source at low priority (the machine stays usable) and the shards are merged into one report.
 */
async function runWorkers(args: Args, rows: { index: number }[]) {
  const n = Math.min(args.concurrency, rows.length);
  console.log(
    `[raster] ${rows.length} sources across ${n} low-priority workers`,
  );
  const codes = await Promise.all(
    Array.from({ length: n }, (_, shard) => {
      const only = rows.filter((_, i) => i % n === shard).map((r) => r.index);
      const child = spawn(
        process.execPath,
        [
          ...process.execArgv,
          process.argv[1],
          '--only',
          only.join(','),
          '--limit',
          String(only.length),
          '--seed',
          String(args.seed),
          '--report',
          args.report,
          '--shard',
          String(shard),
          '--force',
          ...(args.write ? ['--write'] : []),
          ...(args.sources ? ['--sources', args.sources] : []),
        ],
        { stdio: 'inherit' },
      );
      if (child.pid) setPriority(child.pid, 10);
      return new Promise<number>((resolve) =>
        child.on('exit', (code) => resolve(code ?? 1)),
      );
    }),
  );
  const manifest: Entry[] = [];
  for (let shard = 0; shard < n; shard++)
    try {
      const file = path.join(args.report, `manifest-${shard}.json`);
      manifest.push(
        ...(JSON.parse(await readFile(file, 'utf8')) as { flags: Entry[] })
          .flags,
      );
    } catch {
      console.error(`[raster] worker ${shard} left no manifest`);
    }
  manifest.sort((a, b) => a.index - b.index);
  await writeManifest(path.join(args.report, 'manifest.json'), args, manifest);
  await writeReport(args, manifest);
  if (codes.some((code) => code !== 0)) process.exitCode = 1;
}

async function writeReport(args: Args, manifest: Entry[]) {
  const cards = manifest
    .map(
      (f) =>
        `<article data-status="${f.status}"><h3>#${f.index} ${escaped(f.name)}</h3><p>${f.status === 'ok' ? `${f.parts} objects · ${f.layout} · ${(f.mismatch! * 100).toFixed(3)}% mismatch` : escaped(f.error ?? 'Needs review')}</p><div class="comparison"><figure><img loading="lazy" src="${f.status === 'ok' ? `${f.index}/original.png` : escaped(f.image)}"><figcaption>Original</figcaption></figure>${f.status === 'ok' ? `<figure><img loading="lazy" src="${f.index}/rebuilt.png"><figcaption>Reconstructed</figcaption></figure><figure><img loading="lazy" src="${f.index}/field.png"><figcaption>Field with all objects removed</figcaption></figure>` : ''}</div>${f.status === 'ok' ? `<div class="parts">${Array.from({ length: f.parts! }, (_, i) => `<figure><div class="checker"><img loading="lazy" src="${f.index}/part-${i + 1}.png"></div><figcaption>Object ${i + 1}</figcaption></figure>`).join('')}</div>` : ''}<a href="http://localhost:3107/create?remix=${f.id}" target="_blank">Open editor</a></article>`,
    )
    .join('');
  const ok = manifest.filter((f) => f.status === 'ok').length;
  await writeFile(
    path.join(args.report, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Raster parts review</title><style>body{font:14px system-ui;margin:24px;background:#15171b;color:#eee}article{border-top:1px solid #444;padding:20px 0}h3{margin:0}.comparison,.parts{display:flex;flex-wrap:wrap;gap:16px}figure{margin:10px 0}img{width:240px;height:150px;object-fit:contain}figcaption{color:#aaa;font-size:12px}a{color:#8bc6ff}.checker{background:conic-gradient(#ddd 25%,#999 0 50%,#ddd 0 75%,#999 0) 0 0/16px 16px}.parts img{width:180px;height:120px}article[data-status=review] p{color:#ffb56b}</style></head><body><h1>Raster pilot: ${ok}/${manifest.length} passed, ${manifest.length - ok} need review</h1><p>Version ${RASTER_VERSION}. Whole-image reconstruction is checked automatically. Object grouping and interiors still require visual review.</p><p><button onclick="document.querySelectorAll('article[data-status=ok]').forEach(e=>e.hidden=!e.hidden)">Toggle passed flags</button></p>${cards}</body></html>`,
  );
  console.log(
    `[raster] done: ${ok} passed, ${manifest.length - ok} need review. ${path.join(args.report, 'index.html')}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
