import type { PathContour, PathNode } from '@/lib/studio-design';

export type Pt = [number, number];
/** A cubic Bézier: start, two control points, end. */
export type Cubic = [Pt, Pt, Pt, Pt];
/** An affine map, as in SVG's matrix(a b c d e f): x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [number, number, number, number, number, number];

const EPS = 1e-9;
const f = (n: number) => Math.round(n * 1e5) / 1e5;
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const tiny = (v?: Pt) => !v || Math.hypot(v[0], v[1]) < EPS;

export const at = (node: PathNode): Pt => [node.x, node.y];

/** A node, dropping handles too short to matter. */
export function makeNode(p: Pt, handleIn?: Pt, handleOut?: Pt): PathNode {
  const node: PathNode = { x: p[0], y: p[1] };
  if (!tiny(handleIn)) node.in = handleIn;
  if (!tiny(handleOut)) node.out = handleOut;
  return node;
}

// ---- affine maps ----

export const multiply = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export function invert(m: Affine): Affine {
  const det = m[0] * m[3] - m[1] * m[2] || EPS;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}

export const translate = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
export const scaling = (x: number, y: number): Affine => [x, 0, 0, y, 0, 0];
export function rotation(degrees: number): Affine {
  const a = (degrees * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
}
/** Maps of several steps, applied last to first, like an SVG transform list. */
export const compose = (...maps: Affine[]) => maps.reduce((m, n) => multiply(m, n));

export const apply = (m: Affine, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
/** A map's effect on an offset, such as a handle. */
export const applyVector = (m: Affine, [x, y]: Pt): Pt => [m[0] * x + m[2] * y, m[1] * x + m[3] * y];

export function mapContours(contours: PathContour[], m: Affine): PathContour[] {
  return contours.map((c) => ({
    closed: c.closed,
    nodes: c.nodes.map((n) => makeNode(apply(m, at(n)), n.in && applyVector(m, n.in), n.out && applyVector(m, n.out))),
  }));
}

// ---- segments ----

/** Each curve between neighbouring nodes, the closing one included, as [from, to] node indexes. */
export function segments(contour: PathContour): { from: number; to: number; curve: Cubic; straight: boolean }[] {
  const { nodes } = contour;
  const count = contour.closed ? nodes.length : nodes.length - 1;
  const result = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % nodes.length;
    const [a, b] = [nodes[i], nodes[j]];
    const curve: Cubic = [at(a), add(at(a), a.out ?? [0, 0]), add(at(b), b.in ?? [0, 0]), at(b)];
    result.push({ from: i, to: j, curve, straight: !a.out && !b.in });
  }
  return result;
}

export function pointOn([p0, p1, p2, p3]: Cubic, t: number): Pt {
  const u = 1 - t;
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Splits a curve at t into two that draw the same line (de Casteljau). */
export function splitCubic([p0, p1, p2, p3]: Cubic, t: number): [Cubic, Cubic] {
  const [a, b, c] = [lerp(p0, p1, t), lerp(p1, p2, t), lerp(p2, p3, t)];
  const [d, e] = [lerp(a, b, t), lerp(b, c, t)];
  const m = lerp(d, e, t);
  return [
    [p0, a, d, m],
    [m, e, c, p3],
  ];
}

/** An SVG path through the contours. */
export function contoursD(contours: PathContour[]): string {
  let d = '';
  for (const contour of contours) {
    if (contour.nodes.length === 0) continue;
    const p = (q: Pt) => `${f(q[0])} ${f(q[1])}`;
    d += `M${p(at(contour.nodes[0]))}`;
    for (const seg of segments(contour)) {
      // The closing line is the Z itself.
      if (seg.straight && contour.closed && seg.to === 0) continue;
      d += seg.straight ? `L${p(seg.curve[3])}` : `C${p(seg.curve[1])} ${p(seg.curve[2])} ${p(seg.curve[3])}`;
    }
    if (contour.closed) d += 'Z';
  }
  return d;
}

// ---- bounds and fitting ----

/** Where a curve turns back along each axis, as t values. */
function extrema(curve: Cubic) {
  const ts: number[] = [];
  for (const i of [0, 1] as const) {
    const [p0, p1, p2, p3] = curve.map((p) => p[i]);
    const a = p3 - 3 * p2 + 3 * p1 - p0;
    const b = 2 * (p2 - 2 * p1 + p0);
    const c = p1 - p0;
    if (Math.abs(a) < EPS) {
      if (Math.abs(b) > EPS) ts.push(-c / b);
      continue;
    }
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const root = Math.sqrt(disc);
    ts.push((-b + root) / (2 * a), (-b - root) / (2 * a));
  }
  return ts.filter((t) => t > 0 && t < 1);
}

export type Bounds = { x0: number; y0: number; x1: number; y1: number };

/** The tight box around the curves, not their handles. */
export function contoursBounds(contours: PathContour[]): Bounds | null {
  const points: Pt[] = [];
  for (const contour of contours) {
    points.push(...contour.nodes.map(at));
    for (const seg of segments(contour)) if (!seg.straight) points.push(...extrema(seg.curve).map((t) => pointOn(seg.curve, t)));
  }
  if (points.length === 0) return null;
  return {
    x0: Math.min(...points.map((p) => p[0])),
    y0: Math.min(...points.map((p) => p[1])),
    x1: Math.max(...points.map((p) => p[0])),
    y1: Math.max(...points.map((p) => p[1])),
  };
}

/**
 * Fits contours to their own box: their outlines as fractions of it, and the box itself. A
 * straight run along one axis gets the middle of it.
 */
export function fitContours(contours: PathContour[]) {
  const b = contoursBounds(contours) ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
  const [w, h] = [b.x1 - b.x0, b.y1 - b.y0];
  const fx = (x: number) => (w > EPS ? x / w : 0);
  const fy = (y: number) => (h > EPS ? y / h : 0);
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  const handle = (v?: Pt) => (v ? ([r(fx(v[0])), r(fy(v[1]))] as Pt) : undefined);
  const fitted = contours.map((c) => ({
    closed: c.closed,
    nodes: c.nodes.map((n) =>
      makeNode([w > EPS ? r((n.x - b.x0) / w) : 0.5, h > EPS ? r((n.y - b.y0) / h) : 0.5], handle(n.in), handle(n.out)),
    ),
  }));
  return { contours: fitted, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, w, h };
}

// ---- hit testing ----

/** Each contour as a run of points close enough to its curves. */
export function flatten(contour: PathContour, steps = 16): Pt[] {
  if (contour.nodes.length === 0) return [];
  const points: Pt[] = [at(contour.nodes[0])];
  for (const seg of segments(contour)) {
    if (seg.straight) points.push(seg.curve[3]);
    else for (let i = 1; i <= steps; i++) points.push(pointOn(seg.curve, i / steps));
  }
  return points;
}

export function segmentDistance(p: Pt, a: Pt, b: Pt) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Whether a point is inside the contours (even-odd, open ones closed), or within `reach` of a line. */
export function hitsContours(contours: PathContour[], p: Pt, { fill, reach }: { fill: boolean; reach: number }) {
  let inside = false;
  for (const contour of contours) {
    const pts = flatten(contour);
    for (let i = 1; i < pts.length; i++) if (segmentDistance(p, pts[i - 1], pts[i]) <= reach) return true;
    if (pts.length === 1 && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= reach) return true;
    if (!fill) continue;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [a, b] = [pts[i], pts[j]];
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
  }
  return inside;
}

/** The closest point on any segment: which contour and segment, and how far along. */
export function nearestOnContours(contours: PathContour[], p: Pt) {
  let best: { contour: number; from: number; t: number; point: Pt; distance: number } | null = null;
  contours.forEach((contour, ci) => {
    for (const seg of segments(contour)) {
      let t0 = 0;
      let d0 = Infinity;
      for (let i = 0; i <= 32; i++) {
        const d = Math.hypot(...sub(pointOn(seg.curve, i / 32), p));
        if (d < d0) [t0, d0] = [i / 32, d];
      }
      // Narrow in around the closest sample.
      let step = 1 / 64;
      for (let k = 0; k < 12; k++, step /= 2) {
        for (const t of [t0 - step, t0 + step]) {
          if (t < 0 || t > 1) continue;
          const d = Math.hypot(...sub(pointOn(seg.curve, t), p));
          if (d < d0) [t0, d0] = [t, d];
        }
      }
      if (!best || d0 < best.distance) best = { contour: ci, from: seg.from, t: t0, point: pointOn(seg.curve, t0), distance: d0 };
    }
  });
  return best as { contour: number; from: number; t: number; point: Pt; distance: number } | null;
}

// ---- editing ----

/** A key for one node: its contour and place. */
export const nodeKey = (contour: number, node: number) => `${contour}:${node}`;
export const parseKey = (key: string) => key.split(':').map(Number) as [number, number];

/** Adds a node partway along a segment without changing the line it draws. */
export function insertNode(contours: PathContour[], contour: number, from: number, t: number): { contours: PathContour[]; key: string } {
  const c = contours[contour];
  const seg = segments(c).find((s) => s.from === from)!;
  const next = c.nodes.map((n) => ({ ...n }));
  let node: PathNode;
  if (seg.straight) node = makeNode(pointOn(seg.curve, t));
  else {
    const [left, right] = splitCubic(seg.curve, t);
    next[seg.from] = makeNode(at(next[seg.from]), next[seg.from].in, sub(left[1], left[0]));
    next[seg.to] = makeNode(at(next[seg.to]), sub(right[2], right[3]), next[seg.to].out);
    node = makeNode(left[3], sub(left[2], left[3]), sub(right[1], right[0]));
  }
  next.splice(from + 1, 0, node);
  return { contours: contours.map((x, i) => (i === contour ? { ...x, nodes: next } : x)), key: nodeKey(contour, from + 1) };
}

/** Drops nodes; contours left with too few to draw anything go too. */
export function removeNodes(contours: PathContour[], keys: string[]): PathContour[] {
  const drop = new Set(keys);
  return contours
    .map((c, ci) => ({ ...c, nodes: c.nodes.filter((_, ni) => !drop.has(nodeKey(ci, ni))) }))
    .filter((c) => c.nodes.length >= 2);
}

/** Whether a node's handles point opposite ways, so dragging one swings the other. */
export function isSmooth(node: PathNode) {
  if (!node.in || !node.out) return false;
  const [a, b] = [Math.atan2(node.in[1], node.in[0]), Math.atan2(node.out[1], node.out[0])];
  // Opposite handles are half a turn apart.
  const apart = (((b - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.abs(apart - Math.PI) < 0.05;
}

/** Turns a corner into a smooth point along its neighbours' line, or a curve back into a corner. */
export function toggleSmooth(contours: PathContour[], key: string): PathContour[] {
  const [ci, ni] = parseKey(key);
  const c = contours[ci];
  const node = c.nodes[ni];
  let next: PathNode;
  if (node.in || node.out) next = makeNode(at(node));
  else {
    const count = c.nodes.length;
    const prev = c.closed || ni > 0 ? c.nodes[(ni - 1 + count) % count] : null;
    const after = c.closed || ni < count - 1 ? c.nodes[(ni + 1) % count] : null;
    const p = at(node);
    const back = prev ? at(prev) : p;
    const ahead = after ? at(after) : p;
    const dir = sub(ahead, back);
    const length = Math.hypot(...dir) || 1;
    const unit: Pt = [dir[0] / length, dir[1] / length];
    const reachIn = prev ? Math.hypot(...sub(p, back)) / 3 : 0;
    const reachOut = after ? Math.hypot(...sub(ahead, p)) / 3 : 0;
    next = makeNode(p, [-unit[0] * reachIn, -unit[1] * reachIn], [unit[0] * reachOut, unit[1] * reachOut]);
  }
  return contours.map((x, i) => (i === ci ? { ...x, nodes: x.nodes.map((n, j) => (j === ni ? next : n)) } : x));
}

// ---- SVG path data ----

const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/y;

/** Turns an elliptical arc into cubic curves, as [control, control, end] each. */
function arcToCubics(from: Pt, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, to: Pt): [Pt, Pt, Pt][] {
  if (rx === 0 || ry === 0 || (from[0] === to[0] && from[1] === to[1])) return [[from, to, to]];
  const phi = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const [dx, dy] = [(from[0] - to[0]) / 2, (from[1] - to[1]) / 2];
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) [rx, ry] = [rx * Math.sqrt(lambda), ry * Math.sqrt(lambda)];
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const [cxp, cyp] = [(coef * rx * y1) / ry, (-coef * ry * x1) / rx];
  const cx = cos * cxp - sin * cyp + (from[0] + to[0]) / 2;
  const cy = sin * cxp + cos * cyp + (from[1] + to[1]) / 2;
  const angleOf = (u: Pt, v: Pt) => Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
  const start = angleOf([1, 0], [(x1 - cxp) / rx, (y1 - cyp) / ry]);
  let delta = angleOf([(x1 - cxp) / rx, (y1 - cyp) / ry], [(-x1 - cxp) / rx, (-y1 - cyp) / ry]);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-6));
  const step = delta / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t: number): Pt => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const tangent = (t: number): Pt => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const curves: [Pt, Pt, Pt][] = [];
  for (let i = 0; i < n; i++) {
    const [t1, t2] = [start + i * step, start + (i + 1) * step];
    const [a, b] = [point(t1), point(t2)];
    const [ta, tb] = [tangent(t1), tangent(t2)];
    curves.push([
      [a[0] + k * ta[0], a[1] + k * ta[1]],
      [b[0] - k * tb[0], b[1] - k * tb[1]],
      i === n - 1 ? to : b,
    ]);
  }
  return curves;
}

/** Reads SVG path data into contours of cubic curves. Arcs and quadratics become cubics. */
export function parsePathD(d: string): PathContour[] {
  const contours: PathContour[] = [];
  let current: PathContour | null = null;
  let i = 0;
  let pos: Pt = [0, 0];
  let start: Pt = [0, 0];
  // The last control point, for the smooth commands that mirror it.
  let lastCubic: Pt | null = null;
  let lastQuad: Pt | null = null;

  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };
  const num = () => {
    skip();
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(d);
    if (!m) throw new Error(`Bad path data near "${d.slice(i, i + 12)}"`);
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const flag = () => {
    skip();
    return d[i++] === '1';
  };
  const begin = (p: Pt) => {
    if (current && current.nodes.length) contours.push(current);
    current = { nodes: [makeNode(p)], closed: false };
    start = p;
  };
  const ensure = () => {
    if (!current) begin(pos);
    return current!;
  };
  const lineTo = (p: Pt) => {
    ensure().nodes.push(makeNode(p));
    pos = p;
  };
  const cubicTo = (c1: Pt, c2: Pt, p: Pt) => {
    const contour = ensure();
    const last = contour.nodes[contour.nodes.length - 1];
    contour.nodes[contour.nodes.length - 1] = makeNode(at(last), last.in, sub(c1, at(last)));
    contour.nodes.push(makeNode(p, sub(c2, p)));
    pos = p;
  };

  let command = '';
  while (true) {
    skip();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) command = d[i++];
    else if (!command) throw new Error('Path data must start with a command');
    const rel = command === command.toLowerCase();
    const o: Pt = rel ? pos : [0, 0];
    const P = (): Pt => {
      const x = num();
      return [x + o[0], num() + o[1]];
    };
    const upper = command.toUpperCase();
    let cubic: Pt | null = null;
    let quad: Pt | null = null;
    switch (upper) {
      case 'M': {
        const p = P();
        begin(p);
        pos = p;
        // Further pairs are lines.
        command = rel ? 'l' : 'L';
        break;
      }
      case 'L':
        lineTo(P());
        break;
      case 'H':
        lineTo([num() + (rel ? pos[0] : 0), pos[1]]);
        break;
      case 'V':
        lineTo([pos[0], num() + (rel ? pos[1] : 0)]);
        break;
      case 'C': {
        const [c1, c2, p] = [P(), P(), P()];
        cubicTo(c1, c2, p);
        cubic = c2;
        break;
      }
      case 'S': {
        const c1: Pt = lastCubic ? [2 * pos[0] - lastCubic[0], 2 * pos[1] - lastCubic[1]] : pos;
        const [c2, p] = [P(), P()];
        cubicTo(c1, c2, p);
        cubic = c2;
        break;
      }
      case 'Q':
      case 'T': {
        const q: Pt = upper === 'Q' ? P() : lastQuad ? [2 * pos[0] - lastQuad[0], 2 * pos[1] - lastQuad[1]] : pos;
        const from = pos;
        const p = P();
        cubicTo(lerp(from, q, 2 / 3), lerp(p, q, 2 / 3), p);
        quad = q;
        break;
      }
      case 'A': {
        const [rx, ry, angle] = [num(), num(), num()];
        const [large, sweep] = [flag(), flag()];
        const p = P();
        for (const [c1, c2, end] of arcToCubics(pos, rx, ry, angle, large, sweep, p)) {
          if (c1 === pos && c2 === end) lineTo(end);
          else cubicTo(c1, c2, end);
        }
        break;
      }
      case 'Z': {
        const contour = current as PathContour | null;
        if (contour) {
          contour.closed = true;
          // A last node back on the first is the same point: it gives the first its handle in.
          const nodes = contour.nodes;
          const [first, last] = [nodes[0], nodes[nodes.length - 1]];
          if (nodes.length > 1 && Math.hypot(...sub(at(first), at(last))) < 1e-7) {
            nodes[0] = makeNode(at(first), last.in, first.out);
            nodes.pop();
          }
          contours.push(contour);
          current = null;
        }
        pos = start;
        break;
      }
      default:
        throw new Error(`Unknown path command "${command}"`);
    }
    // Repeated arguments repeat the command, so it stays set.
    lastCubic = cubic;
    lastQuad = quad;
  }
  const open = current as PathContour | null;
  if (open && open.nodes.length) contours.push(open);
  return contours;
}
