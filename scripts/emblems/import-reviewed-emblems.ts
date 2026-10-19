import 'dotenv/config';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { eq, notInArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import sharp from 'sharp';
import { flagEmblems } from '../../src/db/schema';
import type { EmblemPlacement } from '../../src/lib/studio-design';
import { CLOUD_FRONT_URL } from '../../src/lib/constant';
import type { Cluster } from './cluster-candidates';
import type { Candidate } from './harvest-candidates';
import { emblemSourceKey, partBox, readReview, selectReviewed, type ReviewDecisions } from './review-selection';

/** Import an approved review atomically after all assets are ready. Retired rows are archived.
 * npm run emblems:import-reviewed -- --out ~/code/vexilo-emblem-work/v2 --dry-run
 * npm run emblems:import-reviewed -- --out ~/code/vexilo-emblem-work/v2 --apply-schema
 * Optional --decisions <exported JSON> applies final user cuts, additions and edits.
 */
function parseArgs(argv: string[]) {
  const args = { out: '', decisions: '', dryRun: false, applySchema: false, concurrency: 6 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--decisions') args.decisions = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--apply-schema') args.applySchema = true;
    else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.out) throw new Error('Pass --out <review work directory>');
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 32) throw new Error('Concurrency must be 1–32');
  return args;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

type Existing = {
  id: string; source_key: string; flag_id: string; image: string; svg: string | null;
  width: number; height: number; colors: string[]; copies: number; share: number;
  box: [number, number, number, number]; collection: string; appears_on: string[];
  fingerprint: number[]; placements: EmblemPlacement[];
};
type SourceFlag = { id: string; index: number; ratio: [number, number] | null };
type Asset = { image: string; width: number; height: number; png: string; key: string };

async function runWorkers(concurrency: number, worker: () => Promise<void>) {
  const results = await Promise.allSettled(Array.from({ length: concurrency }, worker));
  const failed = results.find((r) => r.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const review = await readReview(path.join(args.out, 'review', 'data.js'));
  const decisions = args.decisions ? JSON.parse(await readFile(args.decisions, 'utf8')) as ReviewDecisions : undefined;
  const selected = selectReviewed(review, decisions);
  const clusters = new Map((JSON.parse(await readFile(path.join(args.out, 'clusters.json'), 'utf8')) as Cluster[]).map((c) => [c.id, c]));
  const candidates = new Map((JSON.parse(await readFile(path.join(args.out, 'harvest.json'), 'utf8')) as Candidate[]).map((c) => [c.key, c]));
  const keys = selected.map((e) => emblemSourceKey(e.id));
  if (new Set(keys).size !== keys.length) throw new Error('Source keys collide');
  const pool = new Pool({ connectionString: requiredEnv('DATABASE_URL'), max: 4, connectionTimeoutMillis: 15000 });
  try {
    const db = drizzle(pool);
    const existing = (await pool.query<Existing>('select * from vexilo_flag_emblem order by source_key')).rows;
    const byKey = new Map(existing.map((e) => [e.source_key, e]));
    const flags = (await pool.query<SourceFlag>(`
      select f.id, f.index, p.design->'ratio' as ratio
      from vexilo_flag f left join vexilo_flag_parts p on p.flag_id = f.id
    `)).rows;
    const flagByIndex = new Map(flags.map((f) => [f.index, f]));
    const aspect = (index: number) => {
      const ratio = flagByIndex.get(index)?.ratio;
      if (!ratio || !ratio.every((n) => Number.isFinite(n) && n > 0)) throw new Error(`Missing flag ratio: #${index}`);
      return ratio[1] / ratio[0];
    };
    // Validate the whole selection and its geometry before uploading or writing database rows.
    for (const e of selected) {
      const c = clusters.get(e.id);
      const rep = c && candidates.get(c.rep);
      if (!c || !rep || rep.error || !rep.features || !flagByIndex.has(rep.index)) throw new Error(`Missing source for ${e.id}`);
      if (c.flags.some((i) => !flagByIndex.has(i))) throw new Error(`Missing associated flag: ${e.id}`);
      if (!byKey.has(emblemSourceKey(e.id))) {
        if (rep.origin === 'library') throw new Error(`Original library row no longer exists: ${e.id}`);
        for (const key of c.members) {
          const member = candidates.get(key);
          if (!member || !flagByIndex.has(member.index)) throw new Error(`Missing cluster member: ${key}`);
          partBox(member, aspect(member.index));
        }
      }
      if (!existsSync(path.join(args.out, 'src', `${rep.key}.${rep.svg ? 'svg' : 'png'}`))) throw new Error(`Missing asset: ${rep.key}`);
    }
    const selectedKeys = new Set(keys);
    const added = keys.filter((k) => !byKey.has(k)).length;
    const retired = existing.filter((e) => !selectedKeys.has(e.source_key)).length;
    console.log(`[import-review] ${selected.length} approved: ${added} new, ${selected.length - added} existing; ${retired} older rows archived${args.dryRun ? ' (dry run)' : ''}`);

    const runDir = path.join(args.out, 'imports', new Date().toISOString().replace(/[:.]/g, '-'));
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'database-before.json'), JSON.stringify(existing, null, 1));
    await writeFile(path.join(runDir, 'selection.json'), JSON.stringify({ selected, decisions: decisions ?? null }, null, 1));
    console.log(`[import-review] backup and selection: ${runDir}`);

    const assetDir = path.join(args.out, 'import-assets');
    await mkdir(assetDir, { recursive: true });
    const assets = new Map<string, Asset>();
    const todo = selected.filter((e) => !byKey.has(emblemSourceKey(e.id)));
    let rendered = 0;
    const prepare = async () => {
      for (let e = todo.shift(); e; e = todo.shift()) {
        const rep = candidates.get(clusters.get(e.id)!.rep)!;
        const raw = await readFile(path.join(args.out, 'src', `${rep.key}.${rep.svg ? 'svg' : 'png'}`));
        const rawHash = createHash('sha256').update(raw).digest('hex').slice(0, 20);
        const png = path.join(assetDir, `${rep.key}-${rawHash}-r1.png`);
        if (!existsSync(png)) {
          await sharp(raw, { density: rep.svg ? Math.max(1, Math.min(2400, 72 * 1536 / Math.max(rep.w, rep.h))) : undefined, limitInputPixels: 2 ** 28 })
            .ensureAlpha()
            .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: !rep.svg })
            .png()
            .toFile(png);
        }
        const bytes = await readFile(png);
        const meta = await sharp(bytes).metadata();
        if (!meta.width || !meta.height || !meta.hasAlpha) throw new Error(`Invalid prepared image: ${e.id}`);
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 20);
        const key = `emblems/v2/${emblemSourceKey(e.id)}-${hash}.png`;
        assets.set(e.id, { image: `${CLOUD_FRONT_URL}/${key}`, width: meta.width, height: meta.height, png, key });
        if (++rendered % 100 === 0) console.log(`[import-review] ${rendered}/${added} images prepared`);
      }
    };
    await runWorkers(args.concurrency, prepare);

    const values = selected.map((e): typeof flagEmblems.$inferInsert => {
      const key = emblemSourceKey(e.id);
      const old = byKey.get(key);
      const c = clusters.get(e.id)!;
      const rep = candidates.get(c.rep)!;
      const appearsOn = [...new Set([...(old?.appears_on ?? []), ...c.flags.map((i) => flagByIndex.get(i)!.id)])];
      let base: Omit<typeof flagEmblems.$inferInsert, 'sourceKey'>;
      if (old) {
        base = { flagId: old.flag_id, image: old.image, svg: old.svg, width: old.width, height: old.height, colors: old.colors, copies: old.copies, share: old.share, box: old.box, collection: old.collection, fingerprint: old.fingerprint, placements: old.placements };
      } else {
        const asset = assets.get(e.id)!;
        const box = partBox(rep, aspect(rep.index));
        const placed = new Map<string, EmblemPlacement>();
        for (const memberKey of c.members) {
          const member = candidates.get(memberKey)!;
          const flagId = flagByIndex.get(member.index)!.id;
          const b = partBox(member, aspect(member.index));
          const previous = placed.get(flagId);
          placed.set(flagId, previous
            ? { flagId, copies: previous.copies + 1, box: [Math.min(previous.box[0], b[0]), Math.min(previous.box[1], b[1]), Math.max(previous.box[2], b[2]), Math.max(previous.box[3], b[3])] }
            : { flagId, box: b, copies: 1 });
        }
        base = {
          flagId: flagByIndex.get(rep.index)!.id, image: asset.image, svg: rep.svg ? rep.src : null,
          width: asset.width, height: asset.height, colors: rep.colors.length ? rep.colors : rep.features!.palette.map((p) => p.hex),
          copies: c.members.length, share: (box[2] - box[0]) * (box[3] - box[1]), box, collection: 'other',
          fingerprint: rep.features!.mask, placements: [...placed.values()],
        };
      }
      return { ...base, sourceKey: key, appearsOn, name: e.name.trim(), tags: [...new Set(e.tags.map((t) => t.trim().toLowerCase()))], category: e.category, rank: Math.floor(e.rank / 10), isActive: true, updatedAt: new Date() };
    });
    await writeFile(path.join(runDir, 'rows.json'), JSON.stringify(values, null, 1));
    if (args.dryRun) {
      console.log(`[import-review] validated ${values.length} rows and ${assets.size} prepared assets; no uploads or database changes`);
      return;
    }

    const bucket = requiredEnv('S3_BUCKET_NAME');
    const s3 = new S3Client({ region: process.env.S3_REGION || 'us-east-2', credentials: { accessKeyId: requiredEnv('S3_ACCESS_KEY_ID'), secretAccessKey: requiredEnv('S3_SECRET_ACCESS_KEY') } });
    const checkpointFile = path.join(assetDir, 'uploaded.json');
    const uploaded: Record<string, string> = existsSync(checkpointFile) ? JSON.parse(await readFile(checkpointFile, 'utf8')) : {};
    const uploads = [...assets.values()];
    let uploadedCount = 0;
    const upload = async () => {
      for (let asset = uploads.shift(); asset; asset = uploads.shift()) {
        if (uploaded[asset.key] !== bucket) {
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: asset.key, Body: await readFile(asset.png), ContentType: 'image/png', CacheControl: 'public, max-age=31536000, immutable' }));
          uploaded[asset.key] = bucket;
        }
        if (++uploadedCount % 100 === 0) {
          console.log(`[import-review] ${uploadedCount}/${assets.size} assets uploaded`);
        }
      }
    };
    try { await runWorkers(args.concurrency, upload); }
    finally { await writeFile(checkpointFile, JSON.stringify(uploaded, null, 1)); s3.destroy(); }

    // All uploads succeeded. Schema, upserts and archive status commit together or roll back.
    await db.transaction(async (tx) => {
      if (args.applySchema) await tx.execute(sql.raw(await readFile(path.join(__dirname, '../../drizzle/0015_add_emblem_metadata.sql'), 'utf8')));
      for (let offset = 0; offset < values.length; offset += 50) {
        await tx.insert(flagEmblems).values(values.slice(offset, offset + 50)).onConflictDoUpdate({
          target: flagEmblems.sourceKey,
          set: {
            name: sql`excluded.name`, tags: sql`excluded.tags`, category: sql`excluded.category`, rank: sql`excluded.rank`,
            isActive: sql`excluded.is_active`, image: sql`excluded.image`, svg: sql`excluded.svg`, width: sql`excluded.width`, height: sql`excluded.height`,
            colors: sql`excluded.colors`, copies: sql`excluded.copies`, share: sql`excluded.share`, box: sql`excluded.box`,
            collection: sql`excluded.collection`, appearsOn: sql`excluded.appears_on`, fingerprint: sql`excluded.fingerprint`, placements: sql`excluded.placements`, updatedAt: sql`excluded.updated_at`,
          },
        });
      }
      await tx.update(flagEmblems).set({ isActive: false, updatedAt: new Date() }).where(notInArray(flagEmblems.sourceKey, keys));
      const [active] = await tx.select({ count: sql<number>`count(*)::int` }).from(flagEmblems).where(eq(flagEmblems.isActive, true));
      if (active.count !== selected.length) throw new Error(`Active row count mismatch: ${active.count}`);
    });
    const after = (await pool.query('select count(*)::int as total, count(*) filter (where is_active)::int as active, count(*) filter (where not is_active)::int as archived from vexilo_flag_emblem')).rows[0];
    await writeFile(path.join(runDir, 'result.json'), JSON.stringify(after, null, 1));
    console.log(`[import-review] committed: ${after.active} active, ${after.archived} archived, ${after.total} total; existing IDs and artwork retained`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
