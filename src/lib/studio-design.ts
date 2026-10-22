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

/** One part of a division, like a canton, a disc or a stripe. */
export type FieldPartRef = { divisionId: string; part: number };

/**
 * What a layer only shows inside: the layer under it (or, when that one is clipped to the layer
 * under it too, the first one down that isn't), or a part of the field. A clip whose part is
 * gone shows the whole layer.
 */
export type StudioClip = { kind: 'below' } | ({ kind: 'part' } & FieldPartRef);

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
  /** Only shows inside this part of another division. */
  clip?: FieldPartRef | null;
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
  mode: 'row' | 'column' | 'ring' | 'arc' | 'grid' | 'path';
  /** How many copies: all of them in a grid, those on the innermost ring of rings and arcs. */
  count: number;
  /**
   * Gap between copies (row, column, grid) as a fraction of the copy's size, the radius (ring,
   * arc) as a fraction of flag height, or where along the path the copies start (path, 0–1).
   */
  spacing: number;
  /** Ring, arc and path copies turn to face outwards, or along the path. */
  facing: boolean;
  /** Grid: copies across and rows down. Without them it's as square as `count` allows. */
  columns?: number;
  rows?: number;
  /** Grid: gap between rows, as a fraction of the copy's height; `spacing` when unset. */
  spacingY?: number;
  /** Grid: every other row one copy shorter, sitting in the gaps (the US's 50 stars). Ring: every other ring turned half a step. */
  stagger?: boolean;
  /** Ring, arc: how many rings share the centre, and how far apart they are (flag height). */
  rings?: number;
  ringGap?: number;
  /** Ring, arc: outer rings get more copies, as far apart as on the innermost one. */
  even?: boolean;
  /** Ring, arc: degrees the pattern is turned clockwise from starting at the top. */
  angle?: number;
  /** Arc: degrees it spans. */
  spread?: number;
  /** Path: the layer the copies follow. */
  along?: string;
  /** Path: each copy's place from the pattern's middle (flag units) and the path's heading there (degrees), kept in step with `along`. */
  track?: [number, number, number][];
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
 * layer's colours: colors[0] fills it, colors[1] strokes it, and colors[2] is where a gradient
 * fill ends. A brush stroke is only a stroke.
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
  /** Fills where outlines overlap too, as text needs where letters touch; otherwise overlaps are holes. */
  nonzero?: boolean;
  /** A fill that runs from colors[0] to colors[2]: across the shape at an angle, or out from its middle. */
  gradient?: ShapeGradient | null;
  /** How the stroke is drawn; absent is solid. */
  strokeStyle?: StrokeStyle;
};

export type ShapeGradient = { kind: 'linear' | 'radial'; /** Degrees clockwise from left to right. */ angle: number };
export type StrokeStyle = 'dashed' | 'dotted' | 'double';

export type TextFont = 'inter' | 'garamond' | 'cinzel' | 'oswald' | 'slab' | 'fraktur' | 'script' | 'cairo';

/**
 * What a text layer says and how it's set. The layer is a path of the letters' outlines, so it
 * draws and exports like any shape; this is what sets them again when the text changes.
 */
export type StudioText = {
  content: string;
  font: TextFont;
  bold?: boolean;
  italic?: boolean;
  /** Extra space after each letter, in ems. */
  spacing: number;
  /** From one line's baseline to the next, in ems. */
  leading: number;
  align: 'left' | 'center' | 'right';
  /**
   * How far the text bends: the degrees of a circle its longest line runs around. Positive arches
   * it, negative bows it, and 360 runs it all the way round.
   */
  curve: number;
  /**
   * Where the outlines sit, in ems from the first line's baseline at its alignment point: x, y,
   * width and height. It keeps the letters their size, and the text in place, as it changes.
   */
  ink: [number, number, number, number];
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
  /** Set for text, whose shape is its letters. */
  text?: StudioText;
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
  clip?: StudioClip | null;
  hidden?: boolean;
  locked?: boolean;
  /** How opaque it's drawn, 0 to 1; absent is fully. */
  opacity?: number;
  /** The group it belongs to; a group's layers sit together in the stack. */
  group?: string;
};

/** Layers that move, recolour and repeat as one, like the parts of a coat of arms. */
export type StudioGroup = {
  id: string;
  name: string;
  /** The whole group, copied around its centre; spacing works as for a layer the group's size. */
  repeat: StudioRepeat | null;
};

export type FlagOutlineKind = 'rect' | 'rounded' | 'swallowtail' | 'tongued' | 'pennant' | 'burgee' | 'nepal' | 'custom';

/**
 * The flag's own outline, when it isn't a plain rectangle: everything outside it is cut away.
 * It's drawn inside the flag's box, so it stretches with the ratio.
 */
export type FlagOutline = {
  kind: FlagOutlineKind;
  /** The kind's settings, like how deep a swallowtail's cut goes. */
  params: Record<string, number>;
  /** A custom outline, as fractions of the flag's width (x) and height (y). */
  contours?: PathContour[];
  /** A band just inside the outline, like Nepal's border; width as a fraction of flag height. */
  trim?: { color: string; width: number } | null;
};

export type StudioDesign = {
  version: 2;
  /** Height : width, e.g. [1, 2]. */
  ratio: [number, number];
  /** Absent for a plain rectangle. */
  outline?: FlagOutline | null;
  field: StudioField;
  layers: StudioLayer[];
  groups?: StudioGroup[];
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
