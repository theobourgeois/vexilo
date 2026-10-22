import type { PathContour, ShapeKind, StudioLayer, StudioShape } from '@/lib/studio-design';
import { uid } from './model';
import { contoursD, fitContours, hitsContours, mapContours, parsePathD, segmentDistance, type Affine } from './paths';

type Pt = [number, number];

/** What the shape tool can draw. Proportional ones keep their own shape unless shift frees them. */
export type ShapePreset = {
  id: string;
  label: string;
  shape: Pick<StudioShape, 'kind' | 'points' | 'inner' | 'corner'>;
  proportional?: boolean;
};

export const SHAPE_PRESETS: ShapePreset[] = [
  { id: 'rect', label: 'Rectangle', shape: { kind: 'rect' } },
  { id: 'ellipse', label: 'Circle', shape: { kind: 'ellipse' }, proportional: true },
  { id: 'triangle', label: 'Triangle', shape: { kind: 'triangle' } },
  { id: 'diamond', label: 'Diamond', shape: { kind: 'diamond' } },
  { id: 'star', label: 'Star', shape: { kind: 'star', points: 5, inner: 0.382 }, proportional: true },
  { id: 'sun', label: 'Sun', shape: { kind: 'star', points: 12, inner: 0.6 }, proportional: true },
  { id: 'polygon', label: 'Hexagon', shape: { kind: 'polygon', points: 6 }, proportional: true },
  { id: 'cross', label: 'Cross', shape: { kind: 'cross' }, proportional: true },
  { id: 'crescent', label: 'Crescent', shape: { kind: 'crescent' }, proportional: true },
  { id: 'heart', label: 'Heart', shape: { kind: 'heart' }, proportional: true },
  { id: 'line', label: 'Line', shape: { kind: 'line' } },
  { id: 'arrow', label: 'Arrow', shape: { kind: 'arrow' } },
];

/** Lines and arrows are drawn from end to end; their height is their weight. */
export const isLinear = (kind: ShapeKind) => kind === 'line' || kind === 'arrow';

/** Weight a fresh line or arrow starts at, as a fraction of flag height. */
export const LINE_WEIGHT: Record<'line' | 'arrow', number> = { line: 0.025, arrow: 0.09 };

/** The stroke a shape gets when its stroke is first turned on. */
export const defaultStroke = (w: number, h: number) => Math.max(0.004, Math.min(0.03, Math.min(w, h) * 0.06));

const f = (n: number) => Math.round(n * 1e5) / 1e5;

/** Points around a circle, alternating with an inner radius for stars, fitted to a unit box. */
function radial(count: number, inner?: number) {
  const n = inner === undefined ? count : count * 2;
  const pts: Pt[] = Array.from({ length: n }, (_, i) => {
    const r = inner === undefined || i % 2 === 0 ? 1 : inner;
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  return normalize(pts);
}

function normalize(pts: Pt[]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return {
    pts: pts.map(([x, y]) => [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)] as Pt),
    aspect: (x1 - x0) / (y1 - y0),
  };
}

// A crescent is a disc with an offset disc taken out: radius 1, the cut radius R_CUT, offset D_CUT.
const R_CUT = 0.8;
const D_CUT = 0.38;
const TIP_X = (1 - R_CUT ** 2 + D_CUT ** 2) / (2 * D_CUT);
const TIP_Y = Math.sqrt(1 - TIP_X ** 2);
const CRESCENT_W = 1 + TIP_X;

// A heart in a 20 × 18.35 box.
const HEART: [Pt, Pt, Pt][] = [
  [[3.4, 12.36], [0, 9.28], [0, 5.5]],
  [[0, 2.42], [2.42, 0], [5.5, 0]],
  [[7.24, 0], [8.91, 0.81], [10, 2.09]],
  [[11.09, 0.81], [12.76, 0], [14.5, 0]],
  [[17.58, 0], [20, 2.42], [20, 5.5]],
  [[20, 9.28], [16.6, 12.36], [10, 18.35]],
];

/** Width over height a shape looks right at. */
export function naturalAspect(shape: Pick<StudioShape, 'kind' | 'points' | 'inner'>) {
  switch (shape.kind) {
    case 'triangle':
      return 2 / Math.sqrt(3);
    case 'star':
      return radial(shape.points ?? 5, shape.inner ?? 0.382).aspect;
    case 'polygon':
      return radial(shape.points ?? 6).aspect;
    case 'crescent':
      return CRESCENT_W / 2;
    case 'heart':
      return 20 / 18.35;
    default:
      return 1;
  }
}

/**
 * The shape's outline in a w × h box centred on the origin. A stroke is kept inside the box, so
 * the box is the shape's whole extent with or without one.
 */
export function shapePath(shape: StudioShape, w: number, h: number): string {
  if (shape.kind === 'brush') return brushPath(shape.path ?? [], w, h, shape.stroke);
  if (shape.kind === 'path') return contoursD(mapContours(shape.contours ?? [], insetBox(w, h, shape.stroke)));
  const s = shape.stroke;
  const bw = Math.max(0, w - s);
  const bh = Math.max(0, h - s);
  const x0 = -bw / 2;
  const y0 = -bh / 2;
  const P = (x: number, y: number) => `${f(x0 + x * bw)} ${f(y0 + y * bh)}`;
  const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => P(x, y)).join('L')}Z`;
  const abs = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
  switch (shape.kind) {
    case 'rect':
    case 'line': {
      const r = ((shape.kind === 'rect' ? (shape.corner ?? 0) : 0) * Math.min(bw, bh)) / 2;
      if (r <= 0) return poly([[0, 0], [1, 0], [1, 1], [0, 1]]);
      const [l, t, rt, b] = [x0, y0, x0 + bw, y0 + bh];
      const arc = (x: number, y: number) => `A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y)}`;
      return `M${f(l + r)} ${f(t)}H${f(rt - r)}${arc(rt, t + r)}V${f(b - r)}${arc(rt - r, b)}H${f(l + r)}${arc(l, b - r)}V${f(t + r)}${arc(l + r, t)}Z`;
    }
    case 'ellipse': {
      const [rx, ry] = [f(bw / 2), f(bh / 2)];
      return `M${-rx} 0A${rx} ${ry} 0 1 0 ${rx} 0A${rx} ${ry} 0 1 0 ${-rx} 0Z`;
    }
    case 'triangle':
      return poly([[0.5, 0], [1, 1], [0, 1]]);
    case 'diamond':
      return poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]);
    case 'star':
      return poly(radial(shape.points ?? 5, shape.inner ?? 0.382).pts);
    case 'polygon':
      return poly(radial(shape.points ?? 6).pts);
    case 'cross': {
      const t = (Math.min(bw, bh) * 0.32) / 2;
      const [x, y] = [bw / 2, bh / 2];
      return abs([[-t, -y], [t, -y], [t, -t], [x, -t], [x, t], [t, t], [t, y], [-t, y], [-t, t], [-x, t], [-x, -t], [-t, -t]]);
    }
    case 'crescent': {
      const X = (x: number) => (x + 1) / CRESCENT_W;
      const Y = (y: number) => (y + 1) / 2;
      const [orx, ory] = [f(bw / CRESCENT_W), f(bh / 2)];
      const [irx, iry] = [f((R_CUT * bw) / CRESCENT_W), f((R_CUT * bh) / 2)];
      const large = TIP_X > D_CUT ? 1 : 0;
      return `M${P(X(TIP_X), Y(-TIP_Y))}A${orx} ${ory} 0 1 0 ${P(X(TIP_X), Y(TIP_Y))}A${irx} ${iry} 0 ${large} 1 ${P(X(TIP_X), Y(-TIP_Y))}Z`;
    }
    case 'heart': {
      const H = (p: Pt) => P(p[0] / 20, p[1] / 18.35);
      return `M${H([10, 18.35])}${HEART.map(([a, b, c]) => `C${H(a)} ${H(b)} ${H(c)}`).join('')}Z`;
    }
    case 'arrow': {
      const head = Math.min(bh * 1.1, bw * 0.6);
      const shaft = bh * 0.19;
      const [x, y] = [bw / 2, bh / 2];
      return abs([[-x, -shaft], [x - head, -shaft], [x - head, -y], [x, 0], [x - head, y], [x - head, shaft], [-x, shaft]]);
    }
  }
}

/** Maps a path's fractions into a w × h box centred on the origin, inside its stroke. */
const insetBox = (w: number, h: number, stroke: number): Affine => {
  const [bw, bh] = [Math.max(0, w - stroke), Math.max(0, h - stroke)];
  return [bw, 0, 0, bh, -bw / 2, -bh / 2];
};

/** Any shape's outline as editable contours, in its w × h box centred on the origin. */
export function shapeContours(shape: StudioShape, w: number, h: number): PathContour[] {
  if (shape.kind === 'path') return mapContours(shape.contours ?? [], insetBox(w, h, shape.stroke));
  return parsePathD(shapePath(shape, w, h));
}

/** Whether a point in a path layer's own box (centred, unrotated) is on it. */
export const hitsPath = (shape: StudioShape, w: number, h: number, point: Pt, reach: number) =>
  hitsContours(shapeContours(shape, w, h), point, { fill: shape.fill, reach: shape.stroke / 2 + reach });

/** Where a brush stroke's points sit in a w × h box: inside it by half the stroke. */
function brushPoints(path: Pt[], w: number, h: number, stroke: number): Pt[] {
  const iw = Math.max(0, w - stroke);
  const ih = Math.max(0, h - stroke);
  return path.map(([x, y]) => [-iw / 2 + x * iw, -ih / 2 + y * ih]);
}

/** A smooth line through points (flag units): curves between the midpoints of each pair. */
export function smoothPath(pts: Pt[]) {
  if (pts.length === 0) return '';
  const p = (q: Pt) => `${f(q[0])} ${f(q[1])}`;
  // A lone point still draws a round dot.
  if (pts.length === 1) return `M${p(pts[0])}L${p([pts[0][0] + 1e-4, pts[0][1]])}`;
  let d = `M${p(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mid: Pt = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
    d += `Q${p(pts[i])} ${p(mid)}`;
  }
  return `${d}L${p(pts[pts.length - 1])}`;
}

export const brushPath = (path: Pt[], w: number, h: number, stroke: number) => smoothPath(brushPoints(path, w, h, stroke));

/** Whether a point in a brush layer's own box (centred, unrotated) is on the stroke. */
export function hitsBrush(shape: StudioShape, w: number, h: number, point: Pt, reach: number) {
  const pts = brushPoints(shape.path ?? [], w, h, shape.stroke);
  const limit = shape.stroke / 2 + reach;
  if (pts.length === 1) return Math.hypot(point[0] - pts[0][0], point[1] - pts[0][1]) <= limit;
  return pts.some((a, i) => i > 0 && segmentDistance(point, pts[i - 1], a) <= limit);
}

/** Drops points that sit within `tolerance` of the line through their neighbours (Ramer–Douglas–Peucker). */
export function simplify(pts: Pt[], tolerance: number): Pt[] {
  if (pts.length < 3) return pts;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segmentDistance(pts[i], pts[0], pts[pts.length - 1]);
    if (d > worst) [worst, index] = [d, i];
  }
  if (worst <= tolerance) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(pts.slice(index), tolerance)];
}

/** How a new shape is painted. A stroke width of 0 is no stroke. */
export type ShapeStyle = { fill: string; filled: boolean; stroke: string; strokeWidth: number };

/** A box in flag units: centre, size and turn. */
export type ShapeBox = { cx: number; cy: number; w: number; h: number; rotation: number };

const MIN_SIDE = 0.002;

export function newShapeLayer(preset: ShapePreset, box: ShapeBox, style: ShapeStyle, W: number): StudioLayer {
  const linear = isLinear(preset.shape.kind);
  const w = Math.max(MIN_SIDE, box.w);
  const h = Math.max(MIN_SIDE, box.h);
  // A line is all fill, and anything else needs a fill or a stroke to be seen.
  const filled = linear || style.filled;
  const colors = [style.fill, style.stroke];
  return {
    id: uid(),
    emblemId: 'shape',
    name: preset.label,
    src: '',
    shape: { ...preset.shape, fill: filled, stroke: !filled && !style.strokeWidth ? defaultStroke(w, h) : style.strokeWidth },
    aspect: w / h,
    palette: [...colors],
    colors,
    x: box.cx / W,
    y: box.cy,
    size: h,
    rotation: box.rotation,
    flipX: false,
    flipY: false,
    outline: null,
    repeat: null,
  };
}

/** The stroke an open path gets, as it has nothing to fill. */
const PATH_STROKE = 0.008;

/** A path drawn with the pen, from contours in flag units. Open paths are only stroked. */
export function newPathLayer(contours: PathContour[], style: ShapeStyle, W: number): StudioLayer {
  const closed = contours.every((c) => c.closed);
  const filled = closed && style.filled;
  const stroke = filled ? style.strokeWidth : style.strokeWidth || PATH_STROKE;
  const fit = fitContours(contours);
  const w = Math.max(MIN_SIDE, fit.w + stroke);
  const h = Math.max(MIN_SIDE, fit.h + stroke);
  const colors = [style.fill, style.stroke];
  return {
    id: uid(),
    emblemId: 'shape',
    name: 'Path',
    src: '',
    shape: { kind: 'path', fill: filled, stroke, contours: fit.contours },
    aspect: w / h,
    palette: [...colors],
    colors,
    x: fit.cx / W,
    y: fit.cy,
    size: h,
    rotation: 0,
    flipX: false,
    flipY: false,
    outline: null,
    repeat: null,
  };
}

/** A brush stroke through points in flag units. */
export function newBrushLayer(points: Pt[], color: string, width: number, W: number): StudioLayer {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [iw, ih] = [x1 - x0, y1 - y0];
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  const path = points.map(([x, y]) => [iw ? round((x - x0) / iw) : 0.5, ih ? round((y - y0) / ih) : 0.5] as Pt);
  const [w, h] = [iw + width, ih + width];
  return {
    id: uid(),
    emblemId: 'brush',
    name: 'Brush stroke',
    src: '',
    shape: { kind: 'brush', fill: false, stroke: width, path },
    aspect: w / h,
    palette: [color, color],
    colors: [color, color],
    x: (x0 + x1) / 2 / W,
    y: (y0 + y1) / 2,
    size: h,
    rotation: 0,
    flipX: false,
    flipY: false,
    outline: null,
    repeat: null,
  };
}

/** The colours a shape actually shows. */
export function shapeColors(layer: Pick<StudioLayer, 'colors' | 'shape'>) {
  const shape = layer.shape!;
  return [...(shape.fill ? [layer.colors[0]] : []), ...(shape.stroke > 0 ? [layer.colors[1] ?? layer.colors[0]] : [])];
}
