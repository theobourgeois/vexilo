import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** A numbered contact sheet of thumbnails on grey, for looking through candidates by eye. */
export async function drawSheet(
  file: string,
  tiles: { thumb: string; label: string }[],
  { cols, tile }: { cols: number; tile: number },
) {
  const rows = Math.ceil(tiles.length / cols);
  const pad = 6;
  const inputs: sharp.OverlayOptions[] = [];
  for (const [i, t] of tiles.entries()) {
    const left = (i % cols) * tile;
    const top = Math.floor(i / cols) * tile;
    const art = await sharp(t.thumb)
      .resize(tile - pad * 2, tile - pad * 2 - 14, { fit: 'inside' })
      .png()
      .toBuffer();
    const meta = await sharp(art).metadata();
    inputs.push({
      input: art,
      left: left + Math.round((tile - (meta.width ?? 0)) / 2),
      top: top + 14 + Math.round((tile - 14 - (meta.height ?? 0)) / 2),
    });
    inputs.push({
      input: Buffer.from(
        `<svg width="${tile}" height="16" xmlns="http://www.w3.org/2000/svg"><text x="3" y="12" font-family="Helvetica" font-size="12" font-weight="bold" fill="#000">${t.label}</text></svg>`,
      ),
      left,
      top,
    });
  }
  const grid = Buffer.from(
    `<svg width="${cols * tile}" height="${rows * tile}" xmlns="http://www.w3.org/2000/svg">` +
      tiles.map((_, i) => `<rect x="${(i % cols) * tile + 0.5}" y="${Math.floor(i / cols) * tile + 0.5}" width="${tile - 1}" height="${tile - 1}" fill="none" stroke="#777"/>`).join('') +
      `</svg>`,
  );
  await sharp({ create: { width: cols * tile, height: rows * tile, channels: 4, background: '#a3a7ab' } })
    .composite([{ input: grid, left: 0, top: 0 }, ...inputs])
    .png()
    .toFile(file);
}

export type TriageResult = { n: number; id: string; score: number; note?: string };

export type TagResult = {
  n: number;
  id: string;
  name: string;
  category: string;
  tags: string[];
  rank: number;
  dup?: number;
  reject?: boolean;
  note?: string;
};

/** Every result-NNN.json written for a set of sheets, concatenated. */
export async function readResults<T>(dir: string) {
  const files = existsSync(dir) ? (await readdir(dir)).filter((f) => /^result-\d+\.json$/.test(f)).sort() : [];
  return (await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')) as T[]))).flat();
}
