import type { StoredStudioDesign, StudioDesign, StudioLayer, StudioRepeat } from '@/lib/studio-design';
import { uniqueColors } from './colors';
import { fieldPartAt } from './divisions';
import { layoutToStack, stackColors, swapStackColor } from './field';
import { defaultParams, LAYOUTS, type Anchor } from './layouts';
import { hitsBrush, hitsPath, shapeColors } from './shapes';

/** An emblem from the library, as the editor gets it. */
export type StudioEmblem = {
  id: string;
  /** The drawing's descriptive name. */
  name: string;
  /** Every flag it appears on, for search. */
  names: string[];
  tags?: string[];
  category?: string;
  rank?: number;
  collection: string;
  src: string;
  aspect: number;
  colors: string[];
  copies: number;
  /** Drawn from an SVG, so it can be turned into shapes. */
  vector?: boolean;
};

export type StudioDoc = { name: string; design: StudioDesign };

/** What a remix starts from. */
export type RemixSource = {
  /** Cached segmentation was held for review; retain the original image field. */
  partsNeedReview?: boolean;
  id: string;
  name: string;
  image: string;
  palette: string[];
  design: StoredStudioDesign | null;
  placements: { emblem: StudioEmblem; box: [number, number, number, number]; copies: number }[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const flagWidth = (design: Pick<StudioDesign, 'ratio'>) => design.ratio[1] / design.ratio[0];

/** How wide a PNG export is; one of its pixels is the finest step the editor works in. */
export const EXPORT_WIDTH = 2400;

/** One export pixel, in flag units. */
export const pixelSize = (W: number) => W / EXPORT_WIDTH;

export const RATIOS: [number, number][] = [
  [2, 3],
  [1, 2],
  [3, 5],
  [1, 1],
];

export function newDesign(): StudioDesign {
  return {
    version: 2,
    ratio: [2, 3],
    field: layoutToStack('triband-v', defaultParams('triband-v'), LAYOUTS['triband-v'].colors),
    layers: [],
  };
}

/** The size that fits an emblem in an anchor's room. */
export function fitSize(aspect: number, anchor: Pick<Anchor, 'w' | 'h'>) {
  return Math.max(0.04, Math.min(anchor.h, anchor.w / aspect) * 0.78);
}

export function newLayer(emblem: StudioEmblem, at: { x: number; y: number; size: number }): StudioLayer {
  return {
    id: uid(),
    emblemId: emblem.id,
    name: emblem.name.replace(/^the /, ''),
    src: emblem.src,
    aspect: emblem.aspect,
    palette: emblem.colors,
    colors: [...emblem.colors],
    x: at.x,
    y: at.y,
    size: at.size,
    rotation: 0,
    flipX: false,
    flipY: false,
    outline: null,
    repeat: null,
  };
}

/** Width of one copy in flag units, height being its size. */
export const layerWidth = (layer: Pick<StudioLayer, 'size' | 'aspect' | 'stretch'>) => layer.size * layer.aspect * (layer.stretch ?? 1);

export type Copy = { cx: number; cy: number; rot: number };

const ARC_SPREAD = 150;

const range = (count: number) => Array.from({ length: count }, (_, i) => i - (count - 1) / 2);

/** A grid's columns and rows: as set, or as square as the count allows. */
export function gridShape(repeat: StudioRepeat) {
  const columns = repeat.columns ?? Math.ceil(Math.sqrt(repeat.count));
  return { columns, rows: repeat.rows ?? Math.ceil(repeat.count / columns) };
}

/** How many copies a grid of columns × rows has, every other row one short when staggered. */
export const gridCount = (columns: number, rows: number, stagger = false) =>
  stagger && columns > 1 ? columns * Math.ceil(rows / 2) + (columns - 1) * Math.floor(rows / 2) : columns * rows;

/** How many copies go on each ring of a ring or arc, innermost first. */
export function ringCounts(repeat: StudioRepeat): number[] {
  const rings = Math.max(1, repeat.rings ?? 1);
  const gap = repeat.ringGap ?? 0;
  return Array.from({ length: rings }, (_, k) =>
    k > 0 && repeat.even && repeat.spacing > 0 ? Math.max(1, Math.round((repeat.count * (repeat.spacing + k * gap)) / repeat.spacing)) : repeat.count,
  );
}

/** Where each copy of a layer is drawn, in flag units (the flag is W wide, 1 tall). */
export function layerCopies(layer: StudioLayer, W: number): Copy[] {
  const cx = layer.x * W;
  const cy = layer.y;
  const h = layer.size;
  const w = layerWidth(layer);
  const repeat = layer.repeat;
  const alone = [{ cx, cy, rot: layer.rotation }];
  if (!repeat) return alone;
  const n = repeat.count;
  switch (repeat.mode) {
    case 'row':
      return n < 2 ? alone : range(n).map((i) => ({ cx: cx + i * w * (1 + repeat.spacing), cy, rot: layer.rotation }));
    case 'column':
      return n < 2 ? alone : range(n).map((i) => ({ cx, cy: cy + i * h * (1 + repeat.spacing), rot: layer.rotation }));
    case 'grid': {
      const { columns, rows } = gridShape(repeat);
      const across = w * (1 + repeat.spacing);
      const down = h * (1 + (repeat.spacingY ?? repeat.spacing));
      const copies: Copy[] = [];
      let left = repeat.columns ? Infinity : n;
      for (let row = 0; row < rows && left > 0; row++) {
        const inRow = Math.min(repeat.stagger && row % 2 && columns > 1 ? columns - 1 : columns, left);
        left -= inRow;
        for (const i of range(inRow)) copies.push({ cx: cx + i * across, cy: cy + (row - (rows - 1) / 2) * down, rot: layer.rotation });
      }
      return copies.length ? copies : alone;
    }
    case 'ring':
    case 'arc': {
      const turn = repeat.angle ?? 0;
      const spread = repeat.spread ?? ARC_SPREAD;
      const copies: Copy[] = [];
      ringCounts(repeat).forEach((m, k) => {
        const radius = repeat.spacing + k * (repeat.ringGap ?? 0);
        const start = -90 + turn;
        const angles =
          repeat.mode === 'ring'
            ? Array.from({ length: m }, (_, i) => start + ((i + (repeat.stagger && k % 2 ? 0.5 : 0)) * 360) / m)
            : m < 2
              ? [start]
              : Array.from({ length: m }, (_, i) => start - spread / 2 + (i * spread) / (m - 1));
        for (const angle of angles) {
          const a = (angle * Math.PI) / 180;
          copies.push({ cx: cx + radius * Math.cos(a), cy: cy + radius * Math.sin(a), rot: layer.rotation + (repeat.facing ? angle + 90 : 0) });
        }
      });
      return n < 2 && (repeat.rings ?? 1) < 2 ? alone : copies;
    }
    case 'path':
      return repeat.track?.length
        ? repeat.track.map(([dx, dy, deg]) => ({ cx: cx + dx, cy: cy + dy, rot: layer.rotation + (repeat.facing ? deg : 0) }))
        : alone;
  }
}

/** Copies read best smaller than a lone emblem; these are the largest each pattern starts at. */
export const REPEAT_SIZE: Record<StudioRepeat['mode'], number> = { ring: 0.1, arc: 0.12, row: 0.22, column: 0.18, grid: 0.14, path: 0.1 };

export function defaultRepeat(mode: StudioRepeat['mode'], layer: StudioLayer): StudioRepeat {
  const ring = mode === 'ring' || mode === 'arc';
  const size = Math.min(layer.size, REPEAT_SIZE[mode]);
  const repeat: StudioRepeat = {
    mode,
    count: mode === 'ring' ? 12 : mode === 'arc' ? 5 : mode === 'grid' ? 9 : mode === 'path' ? 8 : 3,
    spacing: ring ? Math.max(0.2, size * 2.8) : mode === 'path' ? 0 : 0.35,
    facing: false,
  };
  if (mode === 'grid') Object.assign(repeat, { columns: 3, rows: 3 });
  if (ring) repeat.even = true;
  return repeat;
}

/** The repeat with its rings' radius and gap times k, so a ring scales with its copies; the same repeat otherwise. */
export function scaleRepeat<R extends StudioRepeat | null | undefined>(repeat: R, k: number): R {
  if (!repeat || (repeat.mode !== 'ring' && repeat.mode !== 'arc')) return repeat;
  return { ...repeat, spacing: repeat.spacing * k, ...(repeat.ringGap !== undefined && { ringGap: repeat.ringGap * k }) };
}

function corners(copy: Copy, w: number, h: number) {
  const a = (copy.rot * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [copy.cx + x * c - y * s, copy.cy + x * s + y * c] as [number, number]);
}

export type Box = { x0: number; y0: number; x1: number; y1: number };

/** Axis-aligned bounds of every copy, in flag units. */
export function layerBounds(layer: StudioLayer, W: number): Box {
  const w = layerWidth(layer);
  const points = layerCopies(layer, W).flatMap((copy) => corners(copy, w, layer.size));
  return {
    x0: Math.min(...points.map((p) => p[0])),
    y0: Math.min(...points.map((p) => p[1])),
    x1: Math.max(...points.map((p) => p[0])),
    y1: Math.max(...points.map((p) => p[1])),
  };
}

export const unionBox = (boxes: Box[]): Box => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y1: Math.max(...boxes.map((b) => b.y1)),
});

/**
 * Whether a point (flag units) is on any copy of the layer. `reach` is how near counts, so thin
 * lines and brush strokes can still be picked up.
 */
export function hitsLayer(layer: StudioLayer, W: number, px: number, py: number, reach = 0) {
  const w = layerWidth(layer);
  const h = layer.size;
  return layerCopies(layer, W).some((copy) => {
    const a = (-copy.rot * Math.PI) / 180;
    const [dx, dy] = [px - copy.cx, py - copy.cy];
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    const own: [number, number] = [layer.flipX ? -lx : lx, layer.flipY ? -ly : ly];
    if (layer.shape?.kind === 'brush') return hitsBrush(layer.shape, w, h, own, reach);
    // Text is picked up anywhere in its box, not only on its thin letters.
    if (layer.shape?.kind === 'path' && !layer.text) return hitsPath(layer.shape, w, h, own, reach);
    return Math.abs(lx) <= Math.max(w / 2, reach) && Math.abs(ly) <= Math.max(h / 2, reach);
  });
}

/** The colour of the field under a point (flag units). */
export function fieldColorAt(design: StudioDesign, px: number, py: number) {
  const field = design.field;
  if (field.kind !== 'stack') return field.colors[0];
  return fieldPartAt(design, px, py)?.color ?? field.color;
}

/** Every colour the field shows, each once. */
export function fieldColors(design: StudioDesign) {
  return design.field.kind === 'stack' ? stackColors(design.field) : design.field.colors;
}

/** The colours a layer shows. */
export const layerColors = (layer: StudioLayer) => (layer.shape ? shapeColors(layer) : layer.colors);

/** Every colour in the flag, field first. */
export function documentColors(design: StudioDesign) {
  return uniqueColors([...fieldColors(design), ...design.layers.filter((l) => !l.hidden).flatMap(layerColors)]);
}

/** Swaps one colour for another everywhere it's used. */
export function replaceColor(design: StudioDesign, from: string, to: string): StudioDesign {
  const swap = (colors: string[]) => colors.map((c) => (c.toUpperCase() === from.toUpperCase() ? to : c));
  return {
    ...design,
    field: design.field.kind === 'stack' ? swapStackColor(design.field, from, to) : { ...design.field, colors: swap(design.field.colors) },
    layers: design.layers.map((layer) => ({
      ...layer,
      colors: swap(layer.colors),
      outline: layer.outline && layer.outline.color.toUpperCase() === from.toUpperCase() ? { ...layer.outline, color: to } : layer.outline,
    })),
  };
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
