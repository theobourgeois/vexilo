import type { StudioDesign, StudioLayer, StudioRepeat } from '@/lib/studio-design';
import { uniqueColors } from './colors';
import { defaultParams, LAYOUTS, type Anchor } from './layouts';

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
  design: StudioDesign | null;
  placements: { emblem: StudioEmblem; box: [number, number, number, number]; copies: number }[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const flagWidth = (design: Pick<StudioDesign, 'ratio'>) => design.ratio[1] / design.ratio[0];

export const RATIOS: [number, number][] = [
  [2, 3],
  [1, 2],
  [3, 5],
  [1, 1],
];

export function newDesign(): StudioDesign {
  return {
    version: 1,
    ratio: [2, 3],
    field: { kind: 'layout', layout: 'triband-v', colors: [...LAYOUTS['triband-v'].colors], params: defaultParams('triband-v') },
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

/** Where each copy of a layer is drawn, in flag units (the flag is W wide, 1 tall). */
export function layerCopies(layer: StudioLayer, W: number): Copy[] {
  const cx = layer.x * W;
  const cy = layer.y;
  const h = layer.size;
  const w = layerWidth(layer);
  const repeat = layer.repeat;
  if (!repeat || repeat.count < 2) return [{ cx, cy, rot: layer.rotation }];
  const n = repeat.count;
  const range = (count: number) => Array.from({ length: count }, (_, i) => i - (count - 1) / 2);
  switch (repeat.mode) {
    case 'row':
      return range(n).map((i) => ({ cx: cx + i * w * (1 + repeat.spacing), cy, rot: layer.rotation }));
    case 'column':
      return range(n).map((i) => ({ cx, cy: cy + i * h * (1 + repeat.spacing), rot: layer.rotation }));
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const copies: Copy[] = [];
      for (let row = 0; row < rows; row++) {
        const inRow = Math.min(cols, n - row * cols);
        for (const i of range(inRow)) {
          copies.push({ cx: cx + i * w * (1 + repeat.spacing), cy: cy + (row - (rows - 1) / 2) * h * (1 + repeat.spacing), rot: layer.rotation });
        }
      }
      return copies;
    }
    case 'ring':
    case 'arc': {
      const radius = repeat.spacing;
      const angles =
        repeat.mode === 'ring'
          ? Array.from({ length: n }, (_, i) => -90 + (i * 360) / n)
          : Array.from({ length: n }, (_, i) => -90 - ARC_SPREAD / 2 + (i * ARC_SPREAD) / (n - 1));
      return angles.map((angle) => {
        const a = (angle * Math.PI) / 180;
        return { cx: cx + radius * Math.cos(a), cy: cy + radius * Math.sin(a), rot: layer.rotation + (repeat.facing ? angle + 90 : 0) };
      });
    }
  }
}

/** Copies read best smaller than a lone emblem; these are the largest each pattern starts at. */
export const REPEAT_SIZE: Record<StudioRepeat['mode'], number> = { ring: 0.1, arc: 0.12, row: 0.22, column: 0.18, grid: 0.14 };

export function defaultRepeat(mode: StudioRepeat['mode'], layer: StudioLayer): StudioRepeat {
  const ring = mode === 'ring' || mode === 'arc';
  const size = Math.min(layer.size, REPEAT_SIZE[mode]);
  return {
    mode,
    count: mode === 'ring' ? 12 : mode === 'arc' ? 5 : mode === 'grid' ? 9 : 3,
    spacing: ring ? Math.max(0.2, size * 2.8) : 0.35,
    facing: false,
  };
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

/** Whether a point (flag units) is on any copy of the layer. */
export function hitsLayer(layer: StudioLayer, W: number, px: number, py: number) {
  const w = layerWidth(layer);
  const h = layer.size;
  return layerCopies(layer, W).some((copy) => {
    const a = (-copy.rot * Math.PI) / 180;
    const [dx, dy] = [px - copy.cx, py - copy.cy];
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
  });
}

let scratch: CanvasRenderingContext2D | null = null;

/** The field slot under a point (flag units), or -1. */
export function fieldSlotAt(design: StudioDesign, px: number, py: number) {
  if (design.field.kind !== 'layout') return -1;
  scratch ??= document.createElement('canvas').getContext('2d');
  if (!scratch) return -1;
  const W = flagWidth(design);
  const shapes = LAYOUTS[design.field.layout].shapes(W, { ...defaultParams(design.field.layout), ...design.field.params });
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (scratch.isPointInPath(new Path2D(shapes[i].d), px, py)) return shapes[i].slot;
  }
  return 0;
}

export function fieldColorAt(design: StudioDesign, px: number, py: number) {
  const field = design.field;
  if (field.kind !== 'layout') return field.colors[0];
  const slot = fieldSlotAt(design, px, py);
  return field.colors[slot] ?? field.colors[0];
}

export function fieldColors(design: StudioDesign) {
  return design.field.colors;
}

/** Every colour in the flag, field first. */
export function documentColors(design: StudioDesign) {
  return uniqueColors([...design.field.colors, ...design.layers.filter((l) => !l.hidden).flatMap((layer) => layer.colors)]);
}

/** Swaps one colour for another everywhere it's used. */
export function replaceColor(design: StudioDesign, from: string, to: string): StudioDesign {
  const swap = (colors: string[]) => colors.map((c) => (c.toUpperCase() === from.toUpperCase() ? to : c));
  return {
    ...design,
    field: { ...design.field, colors: swap(design.field.colors) },
    layers: design.layers.map((layer) => ({
      ...layer,
      colors: swap(layer.colors),
      outline: layer.outline && layer.outline.color.toUpperCase() === from.toUpperCase() ? { ...layer.outline, color: to } : layer.outline,
    })),
  };
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
