/**
 * The flag maker's document: a field (a parametric layout, or a flag image when a remix
 * can't be split into parts) with emblem layers on top. Positions are fractions of the
 * flag (x of its width, y and size of its height), so changing the ratio keeps the design.
 */

export type LayoutId =
  | 'solid'
  | 'bicolor-h'
  | 'bicolor-v'
  | 'triband-h'
  | 'triband-v'
  | 'stripes-h'
  | 'cross'
  | 'nordic'
  | 'nordic-fimbriated'
  | 'saltire'
  | 'canton'
  | 'border'
  | 'hoist-triangle'
  | 'triband-triangle'
  | 'diagonal'
  | 'diagonal-band'
  | 'quartered'
  | 'stripes-v'
  | 'pentaband-h'
  | 'stars-stripes'
  | 'hoist-band'
  | 'disc'
  | 'per-saltire'
  | 'union';

export type StudioField =
  | { kind: 'layout'; layout: LayoutId; colors: string[]; params: Record<string, number> }
  /** A flag image, recoloured by swapping its own palette colours. */
  | { kind: 'image'; src: string; palette: string[]; colors: string[] };

export type StudioRepeat = {
  mode: 'row' | 'column' | 'ring' | 'arc' | 'grid';
  count: number;
  /** Gap between copies (row, column, grid) as a fraction of the copy's size, or the radius (ring, arc) as a fraction of flag height. */
  spacing: number;
  /** Ring and arc copies turn to face outwards. */
  facing: boolean;
};

/**
 * A layer cut out of a flag image rather than taken from the emblem library: the part of the
 * image inside `box` (fractions of the image), minus whatever matches `field` — the layout the
 * flag was rebuilt with — and is reachable from the box's edge.
 */
export type StudioCutout = {
  box: [number, number, number, number];
  field: { layout: LayoutId; params: Record<string, number>; colors: string[] };
  /** Points on the shape (fractions of the image); only parts connected to them are kept. */
  seeds?: [number, number][];
};

export type StudioOutline = { color: string; /** fraction of flag height */ width: number };

export type StudioLayer = {
  id: string;
  emblemId: string;
  name: string;
  /** Emblem PNG on the CDN, or the flag image a cutout comes from. */
  src: string;
  cutout?: StudioCutout;
  /** Width / height of the emblem image. */
  aspect: number;
  /** The emblem's own colours, and what each is currently painted as. */
  palette: string[];
  colors: string[];
  x: number;
  y: number;
  size: number;
  /** Width on top of the emblem's own proportions, after a free stretch; absent keeps them. */
  stretch?: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  outline: StudioOutline | null;
  repeat: StudioRepeat | null;
  hidden?: boolean;
  locked?: boolean;
};

export type StudioDesign = {
  version: 1;
  /** Height : width, e.g. [1, 2]. */
  ratio: [number, number];
  field: StudioField;
  layers: StudioLayer[];
};

/** Where an emblem sits on a flag it was found on: box as fractions [x0, y0, x1, y1]. */
export type EmblemPlacement = { flagId: string; box: [number, number, number, number]; copies: number };

/** Tags the flag maker puts on what it publishes, so they never pass as official flags. They can't be removed. */
export const REMIX_TAG = 'remix';
export const CUSTOM_TAG = 'custom';
export const MAKER_TAGS = [REMIX_TAG, CUSTOM_TAG];
