import 'dotenv/config';

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db';
import type { StudioDesign } from '../../src/lib/studio-design';
import { features, type Features } from './features';

/**
 * Step 1 of growing the emblem library: collects every object cut out of a flag
 * (vexilo_flag_parts, see scripts/parts) plus the current library, downloads them once,
 * renders a 256px thumbnail of each and measures it (features.ts).
 *   npm run emblems:harvest -- --out ~/code/vexilo-emblem-work/v2
 * Writes <out>/harvest.json, <out>/src/<key>.svg|png and <out>/thumb/<key>.png. Downloads are
 * cached, so a re-run only fetches what's new.
 */

export type Candidate = {
  key: string;
  /** 'part' is a cut flag object; 'library' is already in vexilo_flag_emblem. */
  origin: 'part' | 'library';
  index: number;
  flag: string;
  flagTags: string[];
  src: string;
  svg: boolean;
  /** The object's height as a share of its flag's height, and where its centre sat. */
  size: number;
  x: number;
  y: number;
  aspect: number;
  colors: string[];
  layerName: string;
  /** Pixel size of the source (SVG parts render at any size). */
  w: number;
  h: number;
  features?: Features;
  error?: string;
};

function parseArgs(argv: string[]) {
  const args = { out: '', concurrency: 16, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('Pass --out <work directory>');
  return args;
}

async function fetchBytes(url: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url.startsWith('//') ? `https:${url}` : url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= 2 || String(error).includes('HTTP 404')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

/** Renders an SVG or raster to fit 256px, transparent elsewhere. */
async function thumbnail(bytes: Buffer, svg: boolean) {
  const meta = await sharp(bytes).metadata();
  const longest = Math.max(meta.width ?? 256, meta.height ?? 256);
  const density = svg ? Math.min(2400, Math.max(1, (72 * 512) / longest)) : undefined;
  const image = sharp(bytes, { density, limitInputPixels: 2 ** 28 })
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .resize(256, 256, { fit: 'inside' });
  return { png: await image.png().toBuffer(), w: meta.width ?? 0, h: meta.height ?? 0 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(path.join(args.out, 'src'), { recursive: true });
  await mkdir(path.join(args.out, 'thumb'), { recursive: true });

  const parts = (
    await db.execute(sql`
      select f.index, f.name, f.tags, p.design
      from vexilo_flag_parts p join vexilo_flag f on f.id = p.flag_id
      where p.status = 'ok' and p.image = f.image`)
  ).rows as { index: number; name: string; tags: string[] | null; design: StudioDesign }[];
  const library = (
    await db.execute(sql`
      select e.source_key, e.image, e.svg, e.width, e.height, e.colors, e.box, f.index, f.name, f.tags
      from vexilo_flag_emblem e join vexilo_flag f on f.id = e.flag_id`)
  ).rows as {
    source_key: string;
    image: string;
    svg: string | null;
    width: number;
    height: number;
    colors: string[];
    box: [number, number, number, number];
    index: number;
    name: string;
    tags: string[] | null;
  }[];

  const candidates: Candidate[] = [];
  for (const row of library) {
    candidates.push({
      key: `lib-${row.source_key}`,
      origin: 'library',
      index: row.index,
      flag: row.name,
      flagTags: row.tags ?? [],
      src: row.svg ?? row.image,
      svg: Boolean(row.svg),
      size: row.box[3] - row.box[1],
      x: (row.box[0] + row.box[2]) / 2,
      y: (row.box[1] + row.box[3]) / 2,
      aspect: row.width / row.height,
      colors: row.colors,
      layerName: 'Library',
      w: row.width,
      h: row.height,
    });
  }
  for (const row of parts) {
    for (const layer of row.design.layers) {
      if (!('src' in layer) || typeof layer.src !== 'string') continue;
      const part = layer.src.match(/part-(\d+)\.(svg|png)$/);
      if (!part) continue;
      candidates.push({
        key: `p${row.index}-${part[1]}`,
        origin: 'part',
        index: row.index,
        flag: row.name,
        flagTags: row.tags ?? [],
        src: layer.src,
        svg: part[2] === 'svg',
        size: layer.size,
        x: layer.x,
        y: layer.y,
        aspect: layer.aspect,
        colors: layer.colors ?? [],
        layerName: layer.name ?? '',
        w: 0,
        h: 0,
      });
    }
  }
  const todo = candidates.slice(0, args.limit);
  console.log(`[harvest] ${library.length} library emblems, ${candidates.length - library.length} flag parts from ${parts.length} flags`);

  let done = 0;
  let failed = 0;
  const queue = [...todo];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const file = path.join(args.out, 'src', `${c.key}.${c.svg ? 'svg' : 'png'}`);
        const bytes = existsSync(file) ? await readFile(file) : await fetchBytes(c.src);
        if (!existsSync(file)) await writeFile(file, bytes);
        const { png, w, h } = await thumbnail(bytes, c.svg);
        await writeFile(path.join(args.out, 'thumb', `${c.key}.png`), png);
        if (!c.svg || !c.w) Object.assign(c, { w, h });
        c.features = await features(png);
      } catch (error) {
        c.error = String(error instanceof Error ? error.message : error).slice(0, 200);
        failed++;
      }
      if (++done % 500 === 0) console.log(`[harvest] ${done}/${todo.length} (${failed} failed)`);
    }
  };
  await Promise.all(Array.from({ length: args.concurrency }, worker));
  await writeFile(path.join(args.out, 'harvest.json'), JSON.stringify(todo));
  console.log(`[harvest] done: ${done} measured, ${failed} failed → ${path.join(args.out, 'harvest.json')}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
