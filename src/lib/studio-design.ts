/**
 * The flag maker's document: a field (a base colour with a stack of divisions — stripes,
 * crosses, cantons… — or a flag image when a remix can't be split into parts) with emblem
 * layers on top. Positions are fractions of the flag (x of its width, y and size of its
 * height), so changing the ratio keeps the design.
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

export type DivisionKind =
  | 'stripes-h'
  | 'stripes-v'
  | 'band'
  | 'bend'
  | 'per-bend'
  | 'cross'
  | 'saltire'
  | 'pall'
  | 'triangle'
  | 'chevron'
  | 'canton'
  | 'quarters'
  | 'per-saltire'
  | 'border'
  | 'disc'
  | 'rays';

export type EdgeStyle = 'wavy' | 'zigzag' | 'serrated' | 'stepped';

/**
 * One part of a flag's field, painted over the ones below it. Its geometry is drawn inside
 * `box` (fractions of the flag, [x0, y0, x1, y1]; absent is the whole flag) and clipped to it.
 */
export type StudioDivision = {
  id: string;
  kind: DivisionKind;
  colors: string[];
  params: Record<string, number>;
  box?: [number, number, number, number];
  /** A line along the division's edges; width is what shows, as a fraction of flag height. */
  fimbriation?: { color: string; width: number } | null;
  /** Edges that aren't straight; depth and period are fractions of flag height. */
  edge?: { style: EdgeStyle; depth: number; period: number } | null;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
};

export type StudioImageField = { kind: 'image'; src: string; palette: string[]; colors: string[] };

export type StudioField =
  | { kind: 'stack'; color: string; divisions: StudioDivision[] }
  /** A flag image, recoloured by swapping its own palette colours. */
  | StudioImageField;

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

export type ShapeKind =
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'polygon'
  | 'cross'
  | 'crescent'
  | 'heart'
  | 'line'
  | 'arrow'
  | 'brush'
  | 'path';

/** A point on a path, with its curve handles as offsets from it. Without handles, a corner. */
export type PathNode = { x: number; y: number; in?: [number, number]; out?: [number, number] };

/** One outline of a path: open, or closed back to its first point. */
export type PathContour = { nodes: PathNode[]; closed: boolean };

/**
 * A shape or brush stroke drawn in the editor, filling the layer's box. It's painted in the
 * layer's colours: colors[0] fills it, colors[1] strokes it. A brush stroke is only a stroke.
 */
export type StudioShape = {
  kind: ShapeKind;
  fill: boolean;
  /** Stroke width as a fraction of flag height; 0 for none. */
  stroke: number;
  /** A star's points or a polygon's sides. */
  points?: number;
  /** A star's inner radius, as a fraction of its outer one. */
  inner?: number;
  /** A rectangle's corner rounding, 0 (square) to 1 (fully round). */
  corner?: number;
  /** A brush stroke's points, as fractions of the box inside its stroke. */
  path?: [number, number][];
  /**
   * A path's outlines, as fractions of the box inside its stroke. Where outlines overlap an even
   * number of times, there's a hole.
   */
  contours?: PathContour[];
};

export type StudioLayer = {
  id: string;
  emblemId: string;
  name: string;
  /** Emblem PNG on the CDN, or the flag image a cutout comes from; empty for shapes. */
  src: string;
  cutout?: StudioCutout;
  /** Drawn in the editor instead of loaded from `src`. */
  shape?: StudioShape;
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
  version: 2;
  /** Height : width, e.g. [1, 2]. */
  ratio: [number, number];
  field: StudioField;
  layers: StudioLayer[];
};

/** The first version, whose field was one of a fixed set of layouts. Still stored and shared. */
export type StudioDesignV1 = {
  version: 1;
  ratio: [number, number];
  field: { kind: 'layout'; layout: LayoutId; colors: string[]; params: Record<string, number> } | StudioImageField;
  layers: StudioLayer[];
};

/** A design as stored or shared: either version. The flag maker migrates v1 when it opens one. */
export type StoredStudioDesign = StudioDesign | StudioDesignV1;

/** Where an emblem sits on a flag it was found on: box as fractions [x0, y0, x1, y1]. */
export type EmblemPlacement = { flagId: string; box: [number, number, number, number]; copies: number };

/** Tags the flag maker puts on what it publishes, so they never pass as official flags. They can't be removed. */
export const REMIX_TAG = 'remix';
export const CUSTOM_TAG = 'custom';
export const MAKER_TAGS = [REMIX_TAG, CUSTOM_TAG];
