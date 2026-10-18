'use client';

import type { LayoutId, StudioDesign } from '@/lib/studio-design';
import { colorDistance, nearest, rgbToHex } from './colors';
import { cutoutPalette, loadImage } from './cutout';
import { proxied } from './images';
import { defaultParams, LAYOUTS } from './layouts';
import { newLayer, uid, type RemixSource } from './model';

/** Width the flag is read at; fine enough to find small details. */
const SAMPLE = 240;

/** Parameter variants tried for each layout, covering the common real-world proportions. */
const VARIANTS: Partial<Record<LayoutId, Record<string, number>[]>> = {
  'bicolor-h': [{ split: 0.5 }, { split: 2 / 3 }, { split: 1 / 3 }],
  'bicolor-v': [{ split: 0.5 }, { split: 1 / 3 }],
  'triband-h': [{ middle: 1 / 3 }, { middle: 0.5 }, { middle: 0.6 }],
  'triband-v': [{ middle: 1 / 3 }, { middle: 0.5 }],
  'stripes-h': [5, 7, 9, 11, 13].map((count) => ({ count })),
  cross: [0.14, 0.2, 0.26, 0.32].map((width) => ({ width })),
  nordic: [0.12, 0.16, 0.2, 0.25].flatMap((width) => [0.33, 0.36, 0.4].map((offset) => ({ width, offset }))),
  'nordic-fimbriated': [
    { width: 0.12, border: 0.06, offset: 0.36 },
    { width: 0.14, border: 0.04, offset: 0.36 },
    { width: 0.1, border: 0.05, offset: 0.33 },
  ],
  saltire: [0.1, 0.15, 0.2, 0.26].map((width) => ({ width })),
  canton: [0.4, 0.5, 0.54, 0.6].map((size) => ({ size })),
  border: [0.04, 0.06, 0.08, 0.12].map((width) => ({ width })),
  'hoist-triangle': [0.33, 0.4, 0.5].map((depth) => ({ depth })),
  'triband-triangle': [0.33, 0.4, 0.5].map((depth) => ({ depth })),
  'diagonal-band': [0.2, 0.3, 0.4].map((width) => ({ width })),
  'stripes-v': [3, 5, 7, 9].map((count) => ({ count })),
  'stars-stripes': [
    { count: 13, width: 0.4, height: 7 / 13 },
    { count: 11, width: 0.5, height: 7 / 11 },
    { count: 7, width: 0.5, height: 4 / 7 },
    { count: 5, width: 0.4, height: 3 / 5 },
  ],
  'hoist-band': [0.25, 0.3].map((width) => ({ width })),
  disc: [
    { size: 0.6, offset: 0.5 },
    { size: 0.6, offset: 0.45 },
    { size: 0.5, offset: 0.5 },
  ],
};

/** RGB distance within which a pixel counts as the layout colour it sits on. */
const EXPLAINED = 48;
/** A layout must account for this much of the flag (beyond known emblems) to be used at all. */
const MIN_EXPLAINED = 0.7;
/** Each extra slot has to explain this much more of the flag to be worth it. */
const SLOT_COST = 0.004;
const MAX_CUTOUTS = 6;

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
  if (source.palette.length === 0 || source.placements.some((p) => p.copies > 1)) return fallback;

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
    for (const variant of VARIANTS[layout] ?? [{}]) {
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
  const layers = source.placements.map(({ emblem, box }) => {
    const layer = newLayer(emblem, { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, size: box[3] - box[1] });
    // The library copy may come from a variant with slightly different shades; use this flag's own.
    layer.colors = layer.colors.map((color) => {
      const match = nearest(color, source.palette);
      return colorDistance(color, match) < 25 ? match : color;
    });
    return layer;
  });

  // Whatever the layout and known emblems don't explain becomes cutouts of the flag image.
  const slots = label(best.layout, params);
  const stray = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const slot = slots[p];
    if (!masked[p] && slot >= 0 && off(p, best.medians[slot])) stray[p] = 1;
  }
  const field = { layout: best.layout, params: best.params, colors };
  for (const box of strayBoxes(stray, w, h)) {
    const inside: [number, number, number][] = [];
    for (let y = Math.floor(box[1] * h); y < Math.ceil(box[3] * h); y++)
      for (let x = Math.floor(box[0] * w); x < Math.ceil(box[2] * w); x++)
        if (stray[y * w + x]) inside.push([pixels[(y * w + x) * 4], pixels[(y * w + x) * 4 + 1], pixels[(y * w + x) * 4 + 2]]);
    const palette = cutoutPalette(inside, source.palette);
    layers.push({
      id: uid(),
      emblemId: 'cutout',
      name: layers.some((l) => l.emblemId === 'cutout') ? 'Detail' : 'Emblem',
      src: source.image,
      cutout: { box, field },
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

/**
 * Groups stray pixels into boxes (fractions of the flag): thin slivers along band edges are
 * dropped, nearby pieces merged, and each box padded a little.
 */
function strayBoxes(stray: Uint8Array, w: number, h: number): [number, number, number, number][] {
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
  // Open (drop one-pixel slivers), then grow so pieces of one shape join up.
  const mask = morph(morph(morph(morph(stray, false), true), true), true);

  const seen = new Uint8Array(w * h);
  let boxes: { x0: number; y0: number; x1: number; y1: number; area: number }[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    const box = { x0: w, y0: h, x1: 0, y1: 0, area: 0 };
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const [x, y] = [p % w, Math.floor(p / w)];
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x + 1);
      box.y1 = Math.max(box.y1, y + 1);
      box.area++;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const q = (y + dy) * w + x + dx;
          if (at(mask, x + dx, y + dy) && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
    }
    if (box.area >= w * h * 0.002) boxes.push(box);
  }

  // Merge boxes that touch or nearly do.
  const gap = Math.max(2, h * 0.03);
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
          boxes[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), area: a.area + b.area };
          boxes.splice(j, 1);
          merged = true;
          break outer;
        }
      }
  }
  boxes = boxes.sort((a, b) => b.area - a.area).slice(0, MAX_CUTOUTS);
  const pad = 0.015;
  return boxes.map((b) => [
    Math.max(0, b.x0 / w - pad / (w / h)),
    Math.max(0, b.y0 / h - pad),
    Math.min(1, b.x1 / w + pad / (w / h)),
    Math.min(1, b.y1 / h + pad),
  ]);
}
