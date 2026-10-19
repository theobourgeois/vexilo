import 'dotenv/config';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { and, eq, ilike, isNull, sql } from 'drizzle-orm';
import { chromium, type Browser, type Page } from 'playwright-core';
import { db } from '../../src/db';
import { flagParts, flags } from '../../src/db/schema';
import { defaultParams, LAYOUT_VARIANTS, LAYOUTS } from '../../src/components/studio/layouts';
import { MAX_FLAG_IMAGE_BYTES } from '../../src/lib/batch-flags';
import { CLOUD_FRONT_URL } from '../../src/lib/constant';
import type { LayoutId, StudioDesign, StudioLayer } from '../../src/lib/studio-design';
import { studioDesignSchema } from '../../src/lib/studio-design-schema';

/**
 * Splits every SVG flag into its field and objects (see extract-parts.js) and stores the result
 * as a ready-made flag maker design in vexilo_flag_parts, with the cut SVGs on S3. Flags whose
 * image and extractor version haven't changed are skipped. Apply drizzle/0013_add_flag_parts.sql first.
 *   npm run parts:backfill
 *   npm run parts:backfill -- --only 221,1180 --force
 *   npm run parts:backfill -- --failed   # retry flags that failed last time
 *   npm run parts:backfill -- --limit 50 --dry-run
 */

/** Bump when the extractor changes, to cut every flag again. */
const VERSION = 1;
const TIMEOUT_MS = 60_000;
const MAX_LAYERS = 80;

type Part = { kind: 'shapes' | 'hole'; svg: string; box: [number, number, number, number]; palette: string[]; share: number };
type Extracted = { aspect: number; leaves: number; field: { svg: string; palette: string[] }; objects: Part[] };
type Fit = { layout: LayoutId; params: Record<string, number>; medians: number[][]; unexplained: number };
type Flag = { id: string; index: number; name: string; image: string };
type Candidate = ReturnType<typeof layoutCandidates>[number];

/** What extract-parts.js puts on the page's window. */
declare global {
  interface Window {
    extractParts: (svg: string) => Promise<Extracted>;
    fitLayout: (svg: string, aspect: number, candidates: Candidate[]) => Promise<Fit | null>;
  }
}

function parseArgs(argv: string[]) {
  const args = { only: [] as number[], limit: 0, force: false, failed: false, dryRun: false, concurrency: 6 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--only') args.only = argv[++i].split(',').map(Number);
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--force') args.force = true;
    else if (arg === '--failed') args.failed = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const hex = (rgb: number[]) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const toRgb = (color: string) => [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Every layout variant's shapes for a flag of this aspect, for fitLayout in the page. */
function layoutCandidates(aspect: number) {
  return (Object.keys(LAYOUTS) as LayoutId[]).flatMap((layout) =>
    (LAYOUT_VARIANTS[layout] ?? [{}]).map((variant) => ({
      layout,
      params: variant,
      slots: LAYOUTS[layout].slots.length,
      shapes: LAYOUTS[layout].shapes(aspect, { ...defaultParams(layout), ...variant }),
    })),
  );
}

const uid = () => Math.random().toString(36).slice(2, 10);

function buildDesign(result: Extracted, fit: Fit | null, urls: { field: string | null; parts: string[] }): StudioDesign {
  const aspect = result.aspect;
  const ratio: [number, number] = [1, Math.round(aspect * 1000) / 1000];
  const field: StudioDesign['field'] = fit
    ? {
        kind: 'layout',
        layout: fit.layout,
        params: fit.params,
        // The SVG's own colours where the sampled ones are close.
        colors: fit.medians.map((m) => {
          const match = result.field.palette.find((c) => distance(toRgb(c), m) < 30);
          return match ?? hex(m);
        }),
      }
    : { kind: 'image', src: urls.field!, palette: result.field.palette.slice(0, 8), colors: result.field.palette.slice(0, 8) };
  const layers = result.objects.map((part, i): StudioLayer => {
    const [x0, y0, x1, y1] = part.box;
    const palette = part.palette.slice(0, 12);
    return {
      id: uid(),
      emblemId: 'part',
      name: i === 0 ? 'Emblem' : 'Detail',
      src: urls.parts[i],
      aspect: ((x1 - x0) * aspect) / (y1 - y0),
      palette,
      colors: [...palette],
      x: (x0 + x1) / 2,
      y: (y0 + y1) / 2,
      size: y1 - y0,
      rotation: 0,
      flipX: false,
      flipY: false,
      outline: null,
      repeat: null,
    };
  });
  return { version: 1, ratio, field, layers };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pageScript = await readFile(path.join(__dirname, 'extract-parts.js'), 'utf8');

  const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-2',
    credentials: { accessKeyId: requiredEnv('S3_ACCESS_KEY_ID'), secretAccessKey: requiredEnv('S3_SECRET_ACCESS_KEY') },
  });
  const bucket = requiredEnv('S3_BUCKET_NAME');
  const upload = async (key: string, body: string) => {
    if (!args.dryRun) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'image/svg+xml',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    }
    return `${CLOUD_FRONT_URL}/${key}`;
  };

  let rows: Flag[] = await db
    .select({ id: flags.id, index: flags.index, name: flags.name, image: flags.image })
    .from(flags)
    .where(and(ilike(flags.image, '%.svg'), isNull(flags.design)))
    .orderBy(flags.index);
  if (args.only.length) rows = rows.filter((f) => args.only.includes(f.index));
  if (!args.force) {
    const done = await db
      .select({ flagId: flagParts.flagId, image: flagParts.image, version: flagParts.version, status: flagParts.status })
      .from(flagParts);
    const current = new Set(
      done.filter((d) => d.version === VERSION && !(args.failed && d.status === 'failed')).map((d) => `${d.flagId}|${d.image}`),
    );
    rows = rows.filter((f) => !current.has(`${f.id}|${f.image}`));
  }
  if (args.limit) rows = rows.slice(0, args.limit);
  console.log(`[parts] ${rows.length} SVG flags to cut${args.dryRun ? ' (dry run)' : ''}`);

  const browser: Browser = await chromium.launch({ channel: 'chrome', headless: true });
  const newPage = async () => {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: pageScript });
    return page;
  };
  const withTimeout = <T,>(work: Promise<T>) =>
    Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out')), TIMEOUT_MS))]);

  const save = async (flag: Flag, values: Omit<typeof flagParts.$inferInsert, 'flagId' | 'image' | 'version'>) => {
    if (args.dryRun) return;
    const row = { ...values, flagId: flag.id, image: flag.image, version: VERSION };
    await db
      .insert(flagParts)
      .values(row)
      .onConflictDoUpdate({ target: flagParts.flagId, set: { ...row, updatedAt: new Date() } });
  };

  const counts = { ok: 0, empty: 0, failed: 0 };
  let done = 0;
  const queue = [...rows];
  const worker = async () => {
    let page: Page = await newPage();
    for (let flag = queue.shift(); flag; flag = queue.shift()) {
      let sourceHash = '';
      try {
        const response = await fetch(flag.image, { headers: { 'User-Agent': 'VexiloBot/1.0 (https://vexilo.org)' } });
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        const svg = await response.text();
        sourceHash = createHash('sha256').update(svg).digest('hex');
        if (Buffer.byteLength(svg) > MAX_FLAG_IMAGE_BYTES) throw new Error('Image is too large');

        const result = await withTimeout(page.evaluate((text) => window.extractParts(text), svg));
        if (result.objects.length > MAX_LAYERS) throw new Error(`Too many objects (${result.objects.length})`);
        const fit = await withTimeout(
          page.evaluate(
            ([text, aspect, candidates]) => window.fitLayout(text, aspect, candidates),
            [result.field.svg, result.aspect, layoutCandidates(result.aspect)] as const,
          ),
        );
        if (result.objects.length === 0 && !fit) {
          await save(flag, { sourceHash, status: 'empty', error: null, design: null });
          counts.empty++;
        } else {
          const base = `flags/parts/${flag.index}-${slugify(flag.name) || 'flag'}/${sourceHash.slice(0, 12)}`;
          const urls = {
            field: fit ? null : await upload(`${base}/field.svg`, result.field.svg),
            parts: await Promise.all(result.objects.map((part, i) => upload(`${base}/part-${i + 1}.svg`, part.svg))),
          };
          const design = studioDesignSchema.parse(buildDesign(result, fit, urls));
          await save(flag, { sourceHash, status: 'ok', error: null, design });
          counts.ok++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[parts] #${flag.index} ${flag.name}: ${message.split('\n')[0]}`);
        await save(flag, { sourceHash: sourceHash || '-', status: 'failed', error: message.slice(0, 2000), design: null });
        counts.failed++;
        // A hung or crashed page is replaced rather than reused.
        await page.close().catch(() => undefined);
        page = await newPage();
      }
      if (++done % 100 === 0) console.log(`[parts] ${done}/${rows.length} (${counts.ok} ok, ${counts.empty} empty, ${counts.failed} failed)`);
    }
    await page.close().catch(() => undefined);
  };
  await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, worker));
  await browser.close();

  const [{ count }] = args.dryRun
    ? [{ count: 0 }]
    : await db.select({ count: sql<number>`count(*)::int` }).from(flagParts).where(eq(flagParts.status, 'ok'));
  console.log(
    `[parts] done: ${counts.ok} ok, ${counts.empty} empty, ${counts.failed} failed${args.dryRun ? '' : ` (${count} flags with parts in vexilo_flag_parts)`}`,
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
