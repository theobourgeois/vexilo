'use client';

import type { StudioCutout, StudioLayer } from '@/lib/studio-design';
import { hexToRgb } from './colors';
import { defaultParams, LAYOUTS } from './layouts';

const PREFIX = 'cutout:';
const MAX_SIZE = 1200;
/** RGB distance within which a pixel is the field showing through. */
const FIELD_DISTANCE = 42;

/** What the image pipeline loads for a layer: its emblem, or a key describing its cutout. */
export const layerImage = (layer: Pick<StudioLayer, 'src' | 'cutout'>) =>
  layer.cutout ? `${PREFIX}${JSON.stringify({ src: layer.src, ...layer.cutout })}` : layer.src;

export const isCutoutKey = (key: string) => key.startsWith(PREFIX);

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/**
 * Cuts a part out of a flag image: everything in the box except the field around it. A pixel is
 * field when it matches the colour the layout paints there and connects to the box's edge
 * through other field pixels, so enclosed areas in field colours (an arrow's head inside its
 * outline) stay part of the cutout.
 */
export async function renderCutout(key: string, toUrl: (src: string) => string): Promise<string> {
  const { src, box, field, seeds } = JSON.parse(key.slice(PREFIX.length)) as StudioCutout & { src: string };
  const img = await loadImage(toUrl(src));
  const [iw, ih] = [img.naturalWidth, img.naturalHeight];
  const [sx, sy, sw, sh] = [box[0] * iw, box[1] * ih, (box[2] - box[0]) * iw, (box[3] - box[1]) * ih];
  const k = Math.min(1, MAX_SIZE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;

  // What the layout paints under each pixel, in the image's own coordinates (1 unit = its height).
  const expected = document.createElement('canvas');
  expected.width = w;
  expected.height = h;
  const ectx = expected.getContext('2d', { willReadFrequently: true })!;
  ectx.setTransform(ih * k, 0, 0, ih * k, -sx * k, -sy * k);
  const def = LAYOUTS[field.layout];
  for (const shape of def.shapes(iw / ih, { ...defaultParams(field.layout), ...field.params })) {
    ectx.fillStyle = field.colors[shape.slot] ?? '#000000';
    ectx.fill(new Path2D(shape.d));
  }
  const bg = ectx.getImageData(0, 0, w, h).data;

  // How far each pixel is from the field. Near a boundary between two field colours the image
  // and the layout blend at slightly different places, so nearby layout colours count too, as
  // does any mix of two of them.
  const distance = new Float32Array(w * h);
  /** Distance from just the colour the layout paints at the pixel itself. */
  const strict = new Float32Array(w * h);
  const reach = Math.max(2, Math.round(Math.max(w, h) / 300));
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (px[i + 3] < 128) continue;
    strict[p] = Math.hypot(px[i] - bg[i], px[i + 1] - bg[i + 1], px[i + 2] - bg[i + 2]);
    const [x, y] = [p % w, Math.floor(p / w)];
    const near: number[] = [];
    for (let dy = -reach; dy <= reach; dy += reach)
      for (let dx = -reach; dx <= reach; dx += reach) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = (ny * w + nx) * 4;
        if (!near.some((j) => bg[j] === bg[q] && bg[j + 1] === bg[q + 1] && bg[j + 2] === bg[q + 2])) near.push(q);
      }
    let best = Infinity;
    for (const a of near) {
      best = Math.min(best, Math.hypot(px[i] - bg[a], px[i + 1] - bg[a + 1], px[i + 2] - bg[a + 2]));
      for (const b of near) {
        if (b <= a) continue;
        const ab = [bg[b] - bg[a], bg[b + 1] - bg[a + 1], bg[b + 2] - bg[a + 2]];
        const length = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
        if (!length) continue;
        const t = Math.max(0, Math.min(1, ((px[i] - bg[a]) * ab[0] + (px[i + 1] - bg[a + 1]) * ab[1] + (px[i + 2] - bg[a + 2]) * ab[2]) / length));
        best = Math.min(best, Math.hypot(px[i] - bg[a] - t * ab[0], px[i + 1] - bg[a + 1] - t * ab[1], px[i + 2] - bg[a + 2] - t * ab[2]));
      }
    }
    distance[p] = best;
  }

  // Which of the layout's colours each pixel sits in, or -1 on an edge between two of them.
  const fieldRgb = field.colors.map(hexToRgb);
  const region = new Int8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    region[p] = fieldRgb.findIndex((c) => Math.abs(c[0] - bg[i]) + Math.abs(c[1] - bg[i + 1]) + Math.abs(c[2] - bg[i + 2]) < 6);
  }

  // Flood the field in from the box's edges, never crossing from one layout colour into another,
  // so a shape painted in a field colour but enclosed by the emblem (an arrowhead inside its
  // outline) stays part of the cutout.
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (p: number, from: number) => {
    if (!outside[p] && region[p] >= 0 && region[p] === from && strict[p] < FIELD_DISTANCE) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  const seedEdge = (p: number) => seed(p, region[p]);
  for (let x = 0; x < w; x++) {
    seedEdge(x);
    seedEdge((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seedEdge(y * w);
    seedEdge(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const from = region[p];
    if (x > 0) seed(p - 1, from);
    if (x < w - 1) seed(p + 1, from);
    if (p >= w) seed(p - w, from);
    if (p < w * (h - 1)) seed(p + w, from);
  }
  // Along edges between two field colours the image and the layout disagree by a pixel or two:
  // those pixels (blends, or the colour across the edge) go with the field they border. Pixels in
  // their own field colour never do, which keeps enclosed shapes whole.
  const misplaced = (p: number) => !outside[p] && distance[p] < FIELD_DISTANCE && (region[p] < 0 || strict[p] >= FIELD_DISTANCE);
  const borders = (p: number) => {
    const x = p % w;
    return (x > 0 && outside[p - 1]) || (x < w - 1 && outside[p + 1]) || (p >= w && outside[p - w]) || (p < w * (h - 1) && outside[p + w]);
  };
  // Only a few pixels deep, so this can't creep along an edge into the middle of a shape.
  let front: number[] = [];
  for (let p = 0; p < w * h; p++) if (misplaced(p) && borders(p)) front.push(p);
  for (let depth = 0; depth <= reach + 1 && front.length; depth++) {
    for (const p of front) outside[p] = 1;
    const next: number[] = [];
    for (const p of front) {
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (q >= 0 && q < w * h && misplaced(q)) next.push(q);
    }
    front = next;
  }

  // Keep only the shape itself: what's connected to its seeds, not other shapes in its box.
  if (seeds?.length) {
    const reached = new Uint8Array(w * h);
    const queue: number[] = [];
    const reach = Math.ceil(((iw / 240) * k) * 1.5) + 1;
    for (const [fx, fy] of seeds) {
      const cx = Math.round((fx * iw - sx) * k);
      const cy = Math.round((fy * ih - sy) * k);
      // The seed was picked on a coarser sample; look nearby for a pixel of the shape.
      search: for (let r = 0; r <= reach; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const [x, y] = [cx + dx, cy + dy];
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const p = y * w + x;
            if (!outside[p] && !reached[p]) {
              reached[p] = 1;
              queue.push(p);
              break search;
            }
          }
    }
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      const [x, y] = [p % w, Math.floor(p / w)];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [x + dx, y + dy];
          const q = ny * w + nx;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && !outside[q] && !reached[q]) {
            reached[q] = 1;
            queue.push(q);
          }
        }
    }
    if (queue.length) for (let p = 0; p < w * h; p++) if (!reached[p]) outside[p] = 1;
  }

  // How far each kept pixel is from the field, up to EDGE_RING; edge pixels are mixes of field
  // and shape, so they get matted against the shape's solid colour just inside.
  const EDGE_RING = 3;
  const ring = new Uint8Array(w * h).fill(255);
  let frontier: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!outside[p]) continue;
    ring[p] = 0;
    frontier.push(p);
  }
  for (let depth = 1; depth <= EDGE_RING + 1 && frontier.length; depth++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q >= 0 && q < w * h && ring[q] === 255) {
          ring[q] = depth;
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  const source = new Uint8ClampedArray(px);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (outside[p]) {
      px[i + 3] = 0;
      continue;
    }
    if (ring[p] > EDGE_RING) continue;
    // The solid colour behind this edge: the interior neighbour furthest from the field in the
    // direction this pixel leans.
    const [x, y] = [p % w, Math.floor(p / w)];
    const lean = [source[i] - bg[i], source[i + 1] - bg[i + 1], source[i + 2] - bg[i + 2]];
    let fg = -1;
    let furthest = 0;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (ring[q] <= EDGE_RING) continue;
        const j = q * 4;
        const along = (source[j] - bg[i]) * lean[0] + (source[j + 1] - bg[i + 1]) * lean[1] + (source[j + 2] - bg[i + 2]) * lean[2];
        if (along > furthest) [fg, furthest] = [j, along];
      }
    if (fg < 0) continue;
    const span = [source[fg] - bg[i], source[fg + 1] - bg[i + 1], source[fg + 2] - bg[i + 2]];
    const length = span[0] ** 2 + span[1] ** 2 + span[2] ** 2;
    if (!length) continue;
    const alpha = Math.max(0, Math.min(1, (lean[0] * span[0] + lean[1] * span[1] + lean[2] * span[2]) / length));
    px[i] = source[fg];
    px[i + 1] = source[fg + 1];
    px[i + 2] = source[fg + 2];
    px[i + 3] = Math.round(source[i + 3] * alpha);
  }
  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not encode cutout');
  return URL.createObjectURL(blob);
}

/** Colours in a cutout, as entries of the flag's palette, most used first. */
export function cutoutPalette(pixels: [number, number, number][], palette: string[]) {
  const rgb = palette.map(hexToRgb);
  const counts = new Map<string, number>();
  for (const pixel of pixels) {
    let best = -1;
    let bestDistance = 60;
    rgb.forEach((c, i) => {
      const d = Math.hypot(pixel[0] - c[0], pixel[1] - c[1], pixel[2] - c[2]);
      if (d < bestDistance) [best, bestDistance] = [i, d];
    });
    if (best >= 0) counts.set(palette[best], (counts.get(palette[best]) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .filter(([, n]) => n >= total * 0.04)
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color);
}
