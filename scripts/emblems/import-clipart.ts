import 'dotenv/config';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import sharp from 'sharp';
import { flagEmblems } from '../../src/db/schema';
import { CLOUD_FRONT_URL } from '../../src/lib/constant';
import { EMBLEM_CATEGORIES } from '../../src/lib/emblem-search';

/** Add (or update) clip-art emblems that don't come from a flag. Never retires other rows.
 * npm run emblems:import-clipart -- --selection ~/code/vexilo-emblem-work/v3/selection.json --dry-run
 * npm run emblems:import-clipart -- --selection … --apply-schema
 * Each selection entry: { sourceKey, collection, file (a black SVG), name, tags, category, rank, credit }.
 */
type Entry = { sourceKey: string; collection: string; file: string; name: string; tags: string[]; category: string; rank: number; credit: string };
type Asset = { png: string; pngKey: string; svgKey: string; width: number; height: number };

function parseArgs(argv: string[]) {
  const args = { selection: '', dryRun: false, applySchema: false, concurrency: 8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--selection') args.selection = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--apply-schema') args.applySchema = true;
    else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.selection) throw new Error('Pass --selection <selection.json>');
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 32) throw new Error('Concurrency must be 1–32');
  return args;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function runWorkers(concurrency: number, worker: () => Promise<void>) {
  const results = await Promise.allSettled(Array.from({ length: concurrency }, worker));
  const failed = results.find((r) => r.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

const CATEGORIES = new Set<string>(EMBLEM_CATEGORIES.map(([key]) => key));
const slug = (key: string) => key.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workDir = path.dirname(path.resolve(args.selection));
  const entries = JSON.parse(await readFile(args.selection, 'utf8')) as Entry[];
  const keys = entries.map((e) => e.sourceKey);
  if (new Set(keys).size !== keys.length) throw new Error('Source keys collide');
  for (const e of entries) {
    if (!/^[a-z]+:/.test(e.sourceKey) || e.sourceKey.length > 64) throw new Error(`Bad source key: ${e.sourceKey}`);
    if (!CATEGORIES.has(e.category)) throw new Error(`Bad category for ${e.sourceKey}: ${e.category}`);
    if (!Number.isInteger(e.rank) || e.rank < 0 || e.rank > 5) throw new Error(`Bad rank for ${e.sourceKey}`);
    if (!e.name.trim() || e.name.length > 160 || (e.credit ?? '').length > 160) throw new Error(`Bad name or credit: ${e.sourceKey}`);
    if (!existsSync(e.file)) throw new Error(`Missing file: ${e.file}`);
  }

  const pool = new Pool({ connectionString: requiredEnv('DATABASE_URL'), max: 4, connectionTimeoutMillis: 15000 });
  try {
    const db = drizzle(pool);
    const collections = [...new Set(entries.map((e) => e.collection))];
    const existing = (await pool.query('select * from vexilo_flag_emblem where collection = any($1) order by source_key', [collections])).rows;
    const clash = (await pool.query<{ source_key: string }>('select source_key from vexilo_flag_emblem where source_key = any($1) and not (collection = any($2))', [keys, collections])).rows;
    if (clash.length) throw new Error(`Source keys already used by flag emblems: ${clash.slice(0, 5).map((r) => r.source_key).join(', ')}`);
    const before = (await pool.query('select count(*)::int as total, count(*) filter (where is_active)::int as active from vexilo_flag_emblem')).rows[0];
    const existingKeys = new Set(existing.map((e) => e.source_key));
    console.log(`[clipart] ${entries.length} entries: ${entries.filter((e) => !existingKeys.has(e.sourceKey)).length} new; library has ${before.active} active of ${before.total}${args.dryRun ? ' (dry run)' : ''}`);

    const runDir = path.join(workDir, 'imports', new Date().toISOString().replace(/[:.]/g, '-'));
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'database-before.json'), JSON.stringify({ before, existing }, null, 1));

    // Render each SVG to a trimmed PNG (≤1024px) for the browser; the SVG goes up as-is for "turn into shapes".
    const assetDir = path.join(workDir, 'import-assets');
    await mkdir(assetDir, { recursive: true });
    const assets = new Map<string, Asset>();
    const todo = [...entries];
    let rendered = 0;
    const prepare = async () => {
      for (let e = todo.shift(); e; e = todo.shift()) {
        const raw = await readFile(e.file);
        const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
        const base = `emblems/clipart/${e.collection}/${slug(e.sourceKey.replace(/^[a-z]+:/, ''))}-${hash}`;
        const png = path.join(assetDir, `${slug(e.sourceKey)}-${hash}.png`);
        if (!existsSync(png)) {
          // librsvg scales pt-sized files (potrace output) by density twice; size them in px to render.
          const svg = Buffer.from(raw.toString('utf8').replace(/<svg\b[^>]*>/, (tag) => tag.replace(/(\s(?:width|height)="[\d.]+)pt"/g, '$1"')));
          const meta = await sharp(svg).metadata();
          if (!meta.width || !meta.height) throw new Error(`Unreadable SVG: ${e.file}`);
          const density = Math.max(1, Math.min(2400, (72 * 1536) / Math.max(meta.width, meta.height)));
          await sharp(svg, { density, limitInputPixels: 2 ** 28 })
            .ensureAlpha()
            .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
            .resize(1024, 1024, { fit: 'inside' })
            .png()
            .toFile(png);
        }
        const meta = await sharp(png).metadata();
        if (!meta.width || !meta.height || !meta.hasAlpha) throw new Error(`Invalid rendered image: ${e.sourceKey}`);
        assets.set(e.sourceKey, { png, pngKey: `${base}.png`, svgKey: `${base}.svg`, width: meta.width, height: meta.height });
        if (++rendered % 500 === 0) console.log(`[clipart] ${rendered}/${entries.length} rendered`);
      }
    };
    await runWorkers(args.concurrency, prepare);

    const now = new Date();
    const values = entries.map((e): typeof flagEmblems.$inferInsert => {
      const a = assets.get(e.sourceKey)!;
      return {
        sourceKey: e.sourceKey, name: e.name.trim(), tags: [...new Set(e.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
        category: e.category, rank: e.rank, isActive: true, flagId: null, credit: e.credit || null,
        image: `${CLOUD_FRONT_URL}/${a.pngKey}`, svg: `${CLOUD_FRONT_URL}/${a.svgKey}`, width: a.width, height: a.height,
        colors: ['#000000'], copies: 1, share: 1, box: [0, 0, 1, 1], collection: e.collection,
        appearsOn: [], fingerprint: [], placements: [], updatedAt: now,
      };
    });
    await writeFile(path.join(runDir, 'rows.json'), JSON.stringify(values, null, 1));
    if (args.dryRun) {
      console.log(`[clipart] validated ${values.length} rows and rendered images: ${assetDir}; no uploads or database changes`);
      return;
    }

    const bucket = requiredEnv('S3_BUCKET_NAME');
    const s3 = new S3Client({ region: process.env.S3_REGION || 'us-east-2', credentials: { accessKeyId: requiredEnv('S3_ACCESS_KEY_ID'), secretAccessKey: requiredEnv('S3_SECRET_ACCESS_KEY') } });
    const checkpointFile = path.join(assetDir, 'uploaded.json');
    const uploaded: Record<string, string> = existsSync(checkpointFile) ? JSON.parse(await readFile(checkpointFile, 'utf8')) : {};
    const uploads = entries.flatMap((e) => {
      const a = assets.get(e.sourceKey)!;
      return [{ key: a.pngKey, file: a.png, type: 'image/png' }, { key: a.svgKey, file: e.file, type: 'image/svg+xml' }];
    });
    const total = uploads.length;
    let done = 0;
    const upload = async () => {
      for (let u = uploads.shift(); u; u = uploads.shift()) {
        if (uploaded[u.key] !== bucket) {
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: u.key, Body: await readFile(u.file), ContentType: u.type, CacheControl: 'public, max-age=31536000, immutable' }));
          uploaded[u.key] = bucket;
        }
        if (++done % 500 === 0) {
          console.log(`[clipart] ${done}/${total} files uploaded`);
          await writeFile(checkpointFile, JSON.stringify(uploaded));
        }
      }
    };
    try { await runWorkers(args.concurrency, upload); }
    finally { await writeFile(checkpointFile, JSON.stringify(uploaded)); s3.destroy(); }

    // Every file is up. Schema and rows commit together or not at all; other emblems are untouched.
    await db.transaction(async (tx) => {
      if (args.applySchema) await tx.execute(sql.raw(await readFile(path.join(__dirname, '../../drizzle/0022_clip_art_emblems.sql'), 'utf8')));
      for (let offset = 0; offset < values.length; offset += 100) {
        await tx.insert(flagEmblems).values(values.slice(offset, offset + 100)).onConflictDoUpdate({
          target: flagEmblems.sourceKey,
          set: {
            name: sql`excluded.name`, tags: sql`excluded.tags`, category: sql`excluded.category`, rank: sql`excluded.rank`,
            isActive: sql`excluded.is_active`, credit: sql`excluded.credit`, image: sql`excluded.image`, svg: sql`excluded.svg`,
            width: sql`excluded.width`, height: sql`excluded.height`, updatedAt: sql`excluded.updated_at`,
          },
        });
      }
    });
    const after = (await pool.query('select count(*)::int as total, count(*) filter (where is_active)::int as active from vexilo_flag_emblem')).rows[0];
    await writeFile(path.join(runDir, 'result.json'), JSON.stringify(after, null, 1));
    console.log(`[clipart] committed: ${after.active} active of ${after.total} (was ${before.active} of ${before.total})`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
