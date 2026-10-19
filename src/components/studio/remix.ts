'use client';

import type { LayoutId, StudioDesign } from '@/lib/studio-design';
import { colorDistance, nearest, rgbToHex } from './colors';
import { cutoutPalette, loadImage } from './cutout';
import { proxied } from './images';
import { defaultParams, LAYOUT_VARIANTS, LAYOUTS } from './layouts';
import { newLayer, uid, type RemixSource } from './model';

/** Width the flag is read at; fine enough to find small details. */
const SAMPLE = 240;

/** RGB distance within which a pixel counts as the layout colour it sits on. */
const EXPLAINED = 48;
/** A layout must account for this much of the flag (beyond known emblems) to be used at all. */
const MIN_EXPLAINED = 0.7;
/** Each extra slot has to explain this much more of the flag to be worth it. */
const SLOT_COST = 0.004;
const MAX_CUTOUTS = 8;

type Match = { layout: LayoutId; params: Record<string, number>; medians: number[][]; unexplained: number; score: number };

/**
 * Rebuilds a flag as an editable design: the layout that explains most of it, its known emblems
 * from the library, and everything else (logos, text, odd shapes) cut out of the flag image as
 * layers of their own. Flags no layout fits stay a single recolourable image.
 */
export async function buildRemixDesign(source: RemixSource): Promise<StudioDesign> {
  if (source.design) return source.design;

  const img = await loadImage(proxied(source.image));
  const aspect = img.naturalWidth / img.naturalHeight || 1.5;
  const ratio: [number, number] = [1, Math.round(aspect * 1000) / 1000];
  const fallback: StudioDesign = {
    version: 1,
    ratio,
    field: { kind: 'image', src: source.image, palette: source.palette, colors: [...source.palette] },
    layers: [],
  };
  // Only emblems found once can be put back exactly; repeats would need every position.
  if (source.partsNeedReview || source.palette.length === 0 || source.placements.some((p) => p.copies > 1)) return fallback;

  const w = SAMPLE;
  const h = Math.max(8, Math.round(SAMPLE / aspect));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;

  // Known emblems are accounted for; so is anything see-through.
  const masked = new Uint8Array(w * h);
  for (const { box } of source.placements) {
    const pad = 0.02;
    for (let y = Math.max(0, Math.floor((box[1] - pad) * h)); y < Math.min(h, Math.ceil((box[3] + pad) * h)); y++)
      for (let x = Math.max(0, Math.floor((box[0] - pad) * w)); x < Math.min(w, Math.ceil((box[2] + pad) * w)); x++) masked[y * w + x] = 1;
  }
  for (let p = 0; p < w * h; p++) if (pixels[p * 4 + 3] < 200) masked[p] = 1;

  const labels = document.createElement('canvas');
  labels.width = w;
  labels.height = h;
  const lctx = labels.getContext('2d', { willReadFrequently: true })!;
  const W = aspect;

  /** Each pixel's slot under a layout, or -1 on an anti-aliased boundary. */
  const label = (layout: LayoutId, params: Record<string, number>) => {
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, w, h);
    lctx.setTransform(w / W, 0, 0, h, 0, 0);
    for (const shape of LAYOUTS[layout].shapes(W, params)) {
      lctx.fillStyle = `rgb(${shape.slot * 30 + 10},0,0)`;
      lctx.fill(new Path2D(shape.d));
    }
    const data = lctx.getImageData(0, 0, w, h).data;
    const slots = new Int8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      const slot = Math.round((data[p * 4] - 10) / 30);
      slots[p] = data[p * 4 + 3] < 255 || Math.abs(data[p * 4] - (slot * 30 + 10)) > 3 ? -1 : slot;
    }
    return slots;
  };

  const off = (p: number, median: number[]) =>
    Math.hypot(pixels[p * 4] - median[0], pixels[p * 4 + 1] - median[1], pixels[p * 4 + 2] - median[2]) > EXPLAINED;

  let best: Match | null = null;
  for (const layout of Object.keys(LAYOUTS) as LayoutId[]) {
    const def = LAYOUTS[layout];
    for (const variant of LAYOUT_VARIANTS[layout] ?? [{}]) {
      const params = { ...defaultParams(layout), ...variant };
      const slots = label(layout, params);
      // Median colour per slot, from 256-bin histograms.
      const hist = def.slots.map(() => [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]);
      const counts = new Uint32Array(def.slots.length);
      let total = 0;
      for (let p = 0; p < w * h; p++) {
        const slot = slots[p];
        if (masked[p] || slot < 0 || slot >= def.slots.length) continue;
        for (let c = 0; c < 3; c++) hist[slot][c][pixels[p * 4 + c]]++;
        counts[slot]++;
        total++;
      }
      if (total === 0 || [...counts].some((n) => n < total * 0.01)) continue;
      const medians = hist.map((channels, slot) =>
        channels.map((bins) => {
          let seen = 0;
          for (let v = 0; v < 256; v++) if ((seen += bins[v]) * 2 >= counts[slot]) return v;
          return 0;
        }),
      );
      let unexplained = 0;
      for (let p = 0; p < w * h; p++) {
        const slot = slots[p];
        if (!masked[p] && slot >= 0 && slot < def.slots.length && off(p, medians[slot])) unexplained++;
      }
      const share = unexplained / total;
      const score = share + def.slots.length * SLOT_COST;
      if (!best || score < best.score) best = { layout, params: variant, medians, unexplained: share, score };
    }
  }
  if (!best || best.unexplained > 1 - MIN_EXPLAINED) return fallback;

  // Use the flag's exact colours where the sampled ones are close.
  const colors = best.medians.map((m) => {
    const color = rgbToHex(m as [number, number, number]);
    const match = nearest(color, source.palette);
    return colorDistance(color, match) < 14 ? match : color;
  });
  const params = { ...defaultParams(best.layout), ...best.params };
  const slots = label(best.layout, params);

  /** The flag's own colours inside a box, beyond the field, most used first. */
  const colorsIn = (box: [number, number, number, number]) => {
    const inside: [number, number, number][] = [];
    for (let y = Math.max(0, Math.floor(box[1] * h)); y < Math.min(h, Math.ceil(box[3] * h)); y++)
      for (let x = Math.max(0, Math.floor(box[0] * w)); x < Math.min(w, Math.ceil(box[2] * w)); x++) {
        const p = y * w + x;
        if (pixels[p * 4 + 3] < 200 || (slots[p] >= 0 && !off(p, best.medians[slots[p]]))) continue;
        inside.push([pixels[p * 4], pixels[p * 4 + 1], pixels[p * 4 + 2]]);
      }
    return cutoutPalette(inside, source.palette);
  };

  const layers = source.placements.map(({ emblem, box }) => {
    const layer = newLayer(emblem, { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, size: box[3] - box[1] });
    // Library emblems are shared between flags that use the same shape (Kazakhstan's sun is
    // Bangladesh's disc), so their colours come from what this flag paints where they sit.
    const found = colorsIn(box);
    layer.colors = layer.colors.map((color, i) => {
      const match = nearest(color, source.palette);
      const close = colorDistance(color, match) < 25;
      if (close && (found.length === 0 || found.includes(match))) return match;
      return found[Math.min(i, found.length - 1)] ?? (close ? match : color);
    });
    return layer;
  });

  // Whatever the layout and known emblems don't explain becomes cutouts of the flag image.
  const stray = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const slot = slots[p];
    if (!masked[p] && slot >= 0 && off(p, best.medians[slot])) stray[p] = 1;
  }
  const field = { layout: best.layout, params: best.params, colors };
  for (const { box, seeds, pixels: shape } of strayShapes(stray, w, h)) {
    const inside = shape.map((p) => [pixels[p * 4], pixels[p * 4 + 1], pixels[p * 4 + 2]] as [number, number, number]);
    const palette = cutoutPalette(inside, source.palette);
    layers.push({
      id: uid(),
      emblemId: 'cutout',
      name: layers.some((l) => l.emblemId === 'cutout') ? 'Detail' : 'Emblem',
      src: source.image,
      cutout: { box, field, seeds },
      aspect: ((box[2] - box[0]) * W) / (box[3] - box[1]),
      palette,
      colors: [...palette],
      x: (box[0] + box[2]) / 2,
      y: (box[1] + box[3]) / 2,
      size: box[3] - box[1],
      rotation: 0,
      flipX: false,
      flipY: false,
      outline: null,
      repeat: null,
    });
  }
  return { version: 1, ratio, field: { kind: 'layout', layout: best.layout, colors, params: best.params }, layers };
}

type StrayShape = { box: [number, number, number, number]; seeds: [number, number][]; pixels: number[]; area: number };

/**
 * Groups stray pixels into separate shapes: thin slivers along band edges are dropped and
 * pieces a couple of pixels apart join up, but shapes that are apart stay apart even when one
 * sits inside the other's box (two leaves beside a river that runs across the flag). Each
 * shape gets a padded box and seed points on its pieces, so its cutout keeps only itself.
 */
function strayShapes(stray: Uint8Array, w: number, h: number): StrayShape[] {
  const at = (mask: Uint8Array, x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const morph = (mask: Uint8Array, grow: boolean) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const around = [at(mask, x, y), at(mask, x - 1, y), at(mask, x + 1, y), at(mask, x, y - 1), at(mask, x, y + 1)];
        out[y * w + x] = (grow ? around.some(Boolean) : around.every(Boolean)) ? 1 : 0;
      }
    return out;
  };
  // Open (drop one-pixel slivers), then grow so the pieces of one shape (letters, a stem) join.
  const opened = morph(morph(stray, false), true);
  const mask = morph(morph(morph(opened, true), true), true);

  /** Connected pixels from a start, within a mask. */
  const flood = (start: number, inside: (p: number) => boolean, seen: Uint8Array, diagonal: boolean) => {
    const found = [start];
    seen[start] = 1;
    for (let i = 0; i < found.length; i++) {
      const p = found[i];
      const [x, y] = [p % w, Math.floor(p / w)];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!diagonal && dx && dy)) continue;
          const [nx, ny] = [x + dx, y + dy];
          const q = ny * w + nx;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[q] && inside(q)) {
            seen[q] = 1;
            found.push(q);
          }
        }
    }
    return found;
  };

  const seen = new Uint8Array(w * h);
  const shapes: StrayShape[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    const region = flood(start, (q) => mask[q] === 1, seen, true);
    if (region.length < w * h * 0.002) continue;
    const pixels = region.filter((p) => stray[p] && opened[p]);
    if (pixels.length === 0) continue;

    // A seed on each separate piece, biggest first.
    const member = new Uint8Array(w * h);
    for (const p of pixels) member[p] = 1;
    const pieceSeen = new Uint8Array(w * h);
    const pieces = pixels
      .filter((p) => !pieceSeen[p])
      .map((p) => (pieceSeen[p] ? [] : flood(p, (q) => member[q] === 1, pieceSeen, true)))
      .filter((piece) => piece.length > 0)
      .sort((a, b) => b.length - a.length)
      .slice(0, 32);
    const seeds = pieces.map((piece) => {
      const p = piece[piece.length >> 1];
      return [((p % w) + 0.5) / w, (Math.floor(p / w) + 0.5) / h] as [number, number];
    });

    const xs = pixels.map((p) => p % w);
    const ys = pixels.map((p) => Math.floor(p / w));
    const pad = 0.015;
    shapes.push({
      box: [
        Math.max(0, Math.min(...xs) / w - pad / (w / h)),
        Math.max(0, Math.min(...ys) / h - pad),
        Math.min(1, (Math.max(...xs) + 1) / w + pad / (w / h)),
        Math.min(1, (Math.max(...ys) + 1) / h + pad),
      ],
      seeds,
      pixels,
      area: region.length,
    });
  }
  return shapes.sort((a, b) => b.area - a.area).slice(0, MAX_CUTOUTS);
}
