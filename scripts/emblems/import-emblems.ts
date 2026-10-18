import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { inArray, notInArray, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { flagEmblems, flags } from '../../src/db/schema';
import { CLOUD_FRONT_URL } from '../../src/lib/constant';

/**
 * Uploads an extracted emblem library to S3 and upserts it into vexilo_flag_emblem.
 * Reads <dir>/library.json plus <dir>/assets/<id>.png|svg, as written by the emblem
 * extractor. Rows are keyed by source key, so it can be re-run after a new extraction.
 * Apply drizzle/0008_add_flag_emblems.sql first.
 *   npm run emblems:import -- --dir /tmp/vexilo-emblems
 *   npm run emblems:import -- --dir /tmp/vexilo-emblems --dry-run
 *   npm run emblems:import -- --dir /tmp/vexilo-emblems --prune   # also delete emblems no longer in the library
 */

type LibraryEmblem = {
  id: string;
  index: number;
  flag: string;
  group: string;
  svg: boolean;
  w: number;
  h: number;
  colours: string[];
  totalCopies: number;
  share: number;
  box: [number, number, number, number];
  fingerprint: number[];
  onFlags: { index: number }[];
  placements: { index: number; box: [number, number, number, number]; copies: number }[];
};

function parseArgs(argv: string[]) {
  const args = { dir: '', dryRun: false, prune: false, concurrency: 6 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dir') args.dir = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--prune') args.prune = true;
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.dir) throw new Error('Pass --dir <extractor output directory>');
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
    .replace(/^-+|-+$/g, '');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const library = JSON.parse(await readFile(path.join(args.dir, 'library.json'), 'utf8')) as LibraryEmblem[];

  const indexes = [...new Set(library.flatMap((e) => [e.index, ...e.onFlags.map((f) => f.index)]))];
  const rows = await db.select({ id: flags.id, index: flags.index }).from(flags).where(inArray(flags.index, indexes));
  const flagId = new Map(rows.map((row) => [row.index, row.id]));

  const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-2',
    credentials: { accessKeyId: requiredEnv('S3_ACCESS_KEY_ID'), secretAccessKey: requiredEnv('S3_SECRET_ACCESS_KEY') },
  });
  const bucket = requiredEnv('S3_BUCKET_NAME');
  const upload = async (file: string, key: string, contentType: string) => {
    if (!args.dryRun) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: await readFile(file),
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    }
    return `${CLOUD_FRONT_URL}/${key}`;
  };

  console.log(`[emblems] ${library.length} emblems from ${args.dir}${args.dryRun ? ' (dry run)' : ''}`);
  const queue = [...library];
  let done = 0;
  let skipped = 0;
  const worker = async () => {
    for (let emblem = queue.shift(); emblem; emblem = queue.shift()) {
      const source = flagId.get(emblem.index);
      if (!source) {
        console.warn(`[emblems] ${emblem.id}: flag #${emblem.index} not found, skipping`);
        skipped++;
        continue;
      }
      const base = `emblems/${emblem.id}-${slugify(emblem.flag)}`;
      const image = await upload(path.join(args.dir, 'assets', `${emblem.id}.png`), `${base}.png`, 'image/png');
      const svg = emblem.svg
        ? await upload(path.join(args.dir, 'assets', `${emblem.id}.svg`), `${base}.svg`, 'image/svg+xml')
        : null;
      const values = {
        sourceKey: emblem.id,
        flagId: source,
        image,
        svg,
        width: emblem.w,
        height: emblem.h,
        colors: emblem.colours,
        copies: emblem.totalCopies,
        share: emblem.share,
        box: emblem.box,
        collection: emblem.group,
        appearsOn: emblem.onFlags.map((f) => flagId.get(f.index)).filter((id): id is string => Boolean(id)),
        fingerprint: emblem.fingerprint,
        placements: emblem.placements.flatMap((p) => {
          const id = flagId.get(p.index);
          return id ? [{ flagId: id, box: p.box, copies: p.copies }] : [];
        }),
      };
      if (!args.dryRun) {
        await db
          .insert(flagEmblems)
          .values(values)
          .onConflictDoUpdate({ target: flagEmblems.sourceKey, set: { ...values, updatedAt: new Date() } });
      }
      if (++done % 50 === 0) console.log(`[emblems] ${done} imported`);
    }
  };
  await Promise.all(Array.from({ length: args.concurrency }, worker));

  if (args.prune && !args.dryRun) {
    const removed = await db
      .delete(flagEmblems)
      .where(notInArray(flagEmblems.sourceKey, library.map((e) => e.id)))
      .returning({ sourceKey: flagEmblems.sourceKey });
    console.log(`[emblems] pruned ${removed.length}: ${removed.map((r) => r.sourceKey).join(', ')}`);
  }

  const [{ count }] = args.dryRun
    ? [{ count: 0 }]
    : await db.select({ count: sql<number>`count(*)::int` }).from(flagEmblems);
  console.log(`[emblems] done: ${done} imported, ${skipped} skipped${args.dryRun ? '' : `, ${count} rows in vexilo_flag_emblem`}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
