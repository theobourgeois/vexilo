import type { DivisionKind, EdgeStyle, FieldPartRef, StudioDesign, StudioDivision, StudioField } from '@/lib/studio-design';
import type { Anchor } from './layouts';

/**
 * A field is a base colour with divisions painted over it in order. Each division draws in its
 * own frame — its box, scaled so the box is 1 tall and `lw` wide — and is clipped to the box.
 * Shapes that reach the frame's edge overshoot it, so neither edge styling nor fimbriation ever
 * shows along the flag's edges.
 */

type Pt = [number, number];
type Ring = Pt[];
type Params = Record<string, number>;
type Edge = NonNullable<StudioDivision['edge']>;

export type DivisionParam = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Picked from a few values rather than slid. */
  options?: { value: number; label: string }[];
};

type Piece = { name: string; rings: Ring[]; holes?: Ring[] };
type LocalAnchor = Omit<Anchor, 'id'> & { id: string };

export type DivisionDef = {
  kind: DivisionKind;
  label: string;
  params: DivisionParam[];
  colors: string[];
  /** Its colours repeat across its parts, so it takes any number of them. */
  cycles: boolean;
  /** Its parts tile the frame, so fimbriation runs between them rather than around it. */
  tiling: boolean;
  /** How many parts are sized by weights (`w0`, `w1`, …), for kinds that have them. */
  weighted?: (p: Params) => number;
  /** In frame units, painted in order. */
  pieces: (lw: number, p: Params) => Piece[];
  /** Places emblems snap to, in frame units. */
  anchors: (lw: number, p: Params) => LocalAnchor[];
};

const DEG = Math.PI / 180;
/** How far shapes overshoot the frame. */
const reach = (lw: number) => lw + 4;
const rect = (x0: number, y0: number, x1: number, y1: number): Ring => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const count = (p: Params) => Math.max(1, Math.round(p.count));
const weights = (p: Params, n: number) => Array.from({ length: n }, (_, i) => Math.max(0.001, p[`w${i}`] ?? 1));
/** Where each part starts and ends, as fractions: n + 1 cuts from 0 to 1. */
function cuts(p: Params, n: number) {
  const w = weights(p, n);
  const total = w.reduce((a, b) => a + b, 0);
  let at = 0;
  return [0, ...w.map((v) => (at += v / total))];
}

/** Names for n parts across: two or three get words, more get numbers. */
function partNames(n: number, words2: string[], words3: string[], noun: string) {
  if (n === 2) return words2;
  if (n === 3) return words3;
  return Array.from({ length: n }, (_, i) => `${noun} ${i + 1}`);
}

/**
 * Arms of equal or differing widths from a centre, out past the frame: a band (two arms), a
 * pall (three), a cross or saltire (four). Neighbouring arms meet where their sides cross.
 */
function arms(c: Pt, list: { angle: number; half: number }[], R: number): Ring {
  const sorted = [...list].sort((a, b) => a.angle - b.angle);
  const ring: Ring = [];
  sorted.forEach((a, k) => {
    const b = sorted[(k + 1) % sorted.length];
    const ua: Pt = [Math.cos(a.angle), Math.sin(a.angle)];
    const na: Pt = [-ua[1], ua[0]];
    const ub: Pt = [Math.cos(b.angle), Math.sin(b.angle)];
    const nb: Pt = [-ub[1], ub[0]];
    ring.push([c[0] + R * ua[0] - a.half * na[0], c[1] + R * ua[1] - a.half * na[1]]);
    ring.push([c[0] + R * ua[0] + a.half * na[0], c[1] + R * ua[1] + a.half * na[1]]);
    const gap = (((b.angle - a.angle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (sorted.length < 2 || gap >= Math.PI - 1e-6) return;
    // c + s·ua + ha·na = c + r·ub − hb·nb
    const det = -ua[0] * ub[1] + ub[0] * ua[1];
    if (Math.abs(det) < 1e-9) return;
    const rx = -b.half * nb[0] - a.half * na[0];
    const ry = -b.half * nb[1] - a.half * na[1];
    const s = (-rx * ub[1] + ub[0] * ry) / det;
    ring.push([c[0] + s * ua[0] + a.half * na[0], c[1] + s * ua[1] + a.half * na[1]]);
  });
  return ring;
}

/** A band of width t through c at an angle (radians). */
const band = (c: Pt, angle: number, t: number, R: number) =>
  arms(
    c,
    [
      { angle, half: t / 2 },
      { angle: angle + Math.PI, half: t / 2 },
    ],
    R,
  );

/** Corners of the frame: upper hoist, upper fly, lower fly, lower hoist. */
const frameCorners = (lw: number): Pt[] => [
  [0, 0],
  [lw, 0],
  [lw, 1],
  [0, 1],
];
const CORNER_OPTIONS = [
  { value: 0, label: 'Upper hoist' },
  { value: 1, label: 'Upper fly' },
  { value: 2, label: 'Lower fly' },
  { value: 3, label: 'Lower hoist' },
];
const SIDE_OPTIONS = [
  { value: 0, label: 'Hoist' },
  { value: 1, label: 'Fly' },
  { value: 2, label: 'Top' },
  { value: 3, label: 'Bottom' },
];

/**
 * A frame turned so that `side` is at u = 0: E is how far it reaches from that side, L the
 * side's length, and map takes (u along the reach, v along the side) to frame units.
 */
function sideFrame(lw: number, side: number) {
  switch (Math.round(side)) {
    case 1:
      return { E: lw, L: 1, map: ([u, v]: Pt): Pt => [lw - u, v] };
    case 2:
      return { E: 1, L: lw, map: ([u, v]: Pt): Pt => [v, u] };
    case 3:
      return { E: 1, L: lw, map: ([u, v]: Pt): Pt => [v, 1 - u] };
    default:
      return { E: lw, L: 1, map: ([u, v]: Pt): Pt => [u, v] };
  }
}

/** A triangle on a side, its sides run back past the frame so only the point shows. */
function wedge(lw: number, p: Params, base: number) {
  const { E, L, map } = sideFrame(lw, p.side);
  const R = reach(lw);
  const apex: Pt = [Math.max(0.001, p.depth * E), L / 2];
  const back = (from: Pt): Pt => {
    const [dx, dy] = [apex[0] - from[0], apex[1] - from[1]];
    const len = Math.hypot(dx, dy);
    return [from[0] - (dx / len) * R, from[1] - (dy / len) * R];
  };
  const e0 = back([0, (L * (1 - base)) / 2]);
  const e1 = back([0, (L * (1 + base)) / 2]);
  return { E, L, map, apex, e0, e1 };
}

const centreAnchor = (lw: number, w = lw * 0.55, h = 0.6): LocalAnchor => ({ id: 'centre', label: 'Centre', x: lw / 2, y: 0.5, w, h });

export const DIVISIONS: Record<DivisionKind, DivisionDef> = {
  'stripes-h': {
    kind: 'stripes-h',
    label: 'Horizontal stripes',
    params: [{ key: 'count', label: 'Stripes', min: 1, max: 15, step: 1, value: 3 }],
    colors: ['#C8102E', '#FFFFFF', '#003DA5'],
    cycles: true,
    tiling: true,
    weighted: count,
    pieces: (lw, p) => {
      const n = count(p);
      const at = cuts(p, n);
      const R = reach(lw);
      const names = partNames(n, ['Top', 'Bottom'], ['Top', 'Middle', 'Bottom'], 'Stripe');
      return names.map((name, i) => ({ name, rings: [rect(-R, i === 0 ? -R : at[i], lw + R, i === n - 1 ? 1 + R : at[i + 1])] }));
    },
    anchors: (lw, p) => {
      const n = count(p);
      const at = cuts(p, n);
      const names = partNames(n, ['Top', 'Bottom'], ['Top', 'Middle', 'Bottom'], 'Stripe');
      return names.map((label, i) => {
        const h = at[i + 1] - at[i];
        return { id: `s${i}`, label, x: lw / 2, y: (at[i] + at[i + 1]) / 2, w: lw * 0.6, h: h * 0.8 };
      });
    },
  },
  'stripes-v': {
    kind: 'stripes-v',
    label: 'Vertical stripes',
    params: [{ key: 'count', label: 'Stripes', min: 1, max: 15, step: 1, value: 3 }],
    colors: ['#0055A4', '#FFFFFF', '#EF4135'],
    cycles: true,
    tiling: true,
    weighted: count,
    pieces: (lw, p) => {
      const n = count(p);
      const at = cuts(p, n);
      const R = reach(lw);
      const names = partNames(n, ['Hoist', 'Fly'], ['Hoist', 'Middle', 'Fly'], 'Stripe');
      return names.map((name, i) => ({
        name,
        rings: [rect(i === 0 ? -R : at[i] * lw, -R, i === n - 1 ? lw + R : at[i + 1] * lw, 1 + R)],
      }));
    },
    anchors: (lw, p) => {
      const n = count(p);
      const at = cuts(p, n);
      const names = partNames(n, ['Hoist', 'Fly'], ['Hoist', 'Middle', 'Fly'], 'Stripe');
      return names.map((label, i) => {
        const w = (at[i + 1] - at[i]) * lw;
        return { id: `s${i}`, label, x: ((at[i] + at[i + 1]) / 2) * lw, y: 0.5, w: w * 0.8, h: 0.6 };
      });
    },
  },
  band: {
    kind: 'band',
    label: 'Band',
    params: [
      { key: 'angle', label: 'Angle', min: -90, max: 90, step: 1, value: 0 },
      { key: 'width', label: 'Width', min: 0.02, max: 1, step: 0.01, value: 0.25 },
      { key: 'x', label: 'Across', min: 0, max: 1, step: 0.01, value: 0.5 },
      { key: 'y', label: 'Down', min: 0, max: 1, step: 0.01, value: 0.5 },
    ],
    colors: ['#FFD100'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => [{ name: 'Band', rings: [band([p.x * lw, p.y], p.angle * DEG, p.width, reach(lw) * 2)] }],
    anchors: (lw, p) => [{ id: 'band', label: 'Band', x: p.x * lw, y: p.y, w: p.width * 1.2, h: p.width * 0.8 }],
  },
  bend: {
    kind: 'bend',
    label: 'Diagonal band',
    params: [
      { key: 'width', label: 'Width', min: 0.02, max: 1, step: 0.01, value: 0.25 },
      {
        key: 'flip',
        label: 'Direction',
        min: 0,
        max: 1,
        step: 1,
        value: 0,
        options: [
          { value: 0, label: 'Rising' },
          { value: 1, label: 'Falling' },
        ],
      },
    ],
    colors: ['#FFD100'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => [
      { name: 'Band', rings: [band([lw / 2, 0.5], Math.atan2(p.flip ? 1 : -1, lw), p.width, reach(lw) * 2)] },
    ],
    anchors: (lw, p) => [{ id: 'band', label: 'Band', x: lw / 2, y: 0.5, w: p.width * 1.2, h: p.width * 0.8 }],
  },
  'per-bend': {
    kind: 'per-bend',
    label: 'Diagonal half',
    params: [{ key: 'corner', label: 'Corner', min: 0, max: 3, step: 1, value: 2, options: CORNER_OPTIONS }],
    colors: ['#003DA5'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => {
      const k = Math.round(p.corner) & 3;
      const C = frameCorners(lw);
      const R = reach(lw);
      const [A, B, K] = [C[(k + 3) % 4], C[(k + 1) % 4], C[k]];
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const u: Pt = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
      const out: Pt = [K[0] < lw / 2 ? -R : R, K[1] < 0.5 ? -R : R];
      return [
        {
          name: 'Half',
          rings: [
            [
              [A[0] - u[0] * R, A[1] - u[1] * R],
              [K[0] + out[0], K[1] + out[1]],
              [B[0] + u[0] * R, B[1] + u[1] * R],
            ],
          ],
        },
      ];
    },
    anchors: (lw, p) => {
      const k = Math.round(p.corner) & 3;
      const C = frameCorners(lw);
      const [A, B, K] = [C[(k + 3) % 4], C[(k + 1) % 4], C[k]];
      return [{ id: 'half', label: K[0] ? 'Fly' : 'Hoist', x: (A[0] + B[0] + K[0]) / 3, y: (A[1] + B[1] + K[1]) / 3, w: lw * 0.3, h: 0.3 }];
    },
  },
  cross: {
    kind: 'cross',
    label: 'Cross',
    params: [
      { key: 'width', label: 'Width', min: 0.02, max: 0.8, step: 0.01, value: 0.2 },
      { key: 'x', label: 'Across', min: 0, max: 1, step: 0.01, value: 0.5 },
      { key: 'y', label: 'Down', min: 0, max: 1, step: 0.01, value: 0.5 },
    ],
    colors: ['#FFFFFF'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => [
      {
        name: 'Cross',
        rings: [arms([p.x * lw, p.y], [0, 90, 180, 270].map((a) => ({ angle: a * DEG, half: p.width / 2 })), reach(lw))],
      },
    ],
    anchors: (lw, p) => {
      const [cx, cy, h] = [p.x * lw, p.y, p.width / 2];
      return [
        { id: 'canton', label: 'Canton', x: (cx - h) / 2, y: (cy - h) / 2, w: (cx - h) * 0.85, h: (cy - h) * 0.85 },
        { id: 'crossing', label: 'Crossing', x: cx, y: cy, w: p.width, h: p.width },
      ].filter((a) => a.w > 0.02 && a.h > 0.02);
    },
  },
  saltire: {
    kind: 'saltire',
    label: 'Saltire',
    params: [{ key: 'width', label: 'Width', min: 0.02, max: 0.8, step: 0.01, value: 0.18 }],
    colors: ['#FFFFFF'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => {
      const c: Pt = [lw / 2, 0.5];
      const list = frameCorners(lw).map(([x, y]) => ({ angle: Math.atan2(y - 0.5, x - lw / 2), half: p.width / 2 }));
      return [{ name: 'Saltire', rings: [arms(c, list, reach(lw))] }];
    },
    anchors: (lw, p) => [
      { id: 'crossing', label: 'Crossing', x: lw / 2, y: 0.5, w: p.width * 1.2, h: p.width * 1.2 },
      { id: 'hoist', label: 'Hoist', x: lw * 0.17, y: 0.5, w: lw * 0.18, h: 0.3 },
    ],
  },
  pall: {
    kind: 'pall',
    label: 'Pall',
    params: [
      { key: 'width', label: 'Width', min: 0.02, max: 0.6, step: 0.01, value: 0.2 },
      { key: 'x', label: 'Fork', min: 0.1, max: 0.9, step: 0.01, value: 0.4 },
      { key: 'inset', label: 'Arms at', min: 0, max: 0.45, step: 0.01, value: 0 },
    ],
    colors: ['#007749'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => {
      const c: Pt = [p.x * lw, 0.5];
      const ends: Pt[] = [
        [0, p.inset],
        [0, 1 - p.inset],
      ];
      const list = [
        { angle: 0, half: p.width / 2 },
        ...ends.map(([x, y]) => ({ angle: Math.atan2(y - c[1], x - c[0]), half: p.width / 2 })),
      ];
      return [{ name: 'Pall', rings: [arms(c, list, reach(lw))] }];
    },
    anchors: (lw, p) => [
      { id: 'hoist', label: 'Hoist', x: p.x * lw * 0.35, y: 0.5, w: p.x * lw * 0.4, h: 0.3 },
      { id: 'fork', label: 'Fork', x: p.x * lw, y: 0.5, w: p.width, h: p.width },
    ],
  },
  triangle: {
    kind: 'triangle',
    label: 'Triangle',
    params: [
      { key: 'side', label: 'Side', min: 0, max: 3, step: 1, value: 0, options: SIDE_OPTIONS },
      { key: 'depth', label: 'Depth', min: 0.05, max: 1, step: 0.01, value: 0.5 },
      { key: 'base', label: 'Base', min: 0.05, max: 1, step: 0.01, value: 1 },
    ],
    colors: ['#003DA5'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => {
      const { map, apex, e0, e1 } = wedge(lw, p, p.base);
      return [{ name: 'Triangle', rings: [[e0, apex, e1].map(map)] }];
    },
    anchors: (lw, p) => {
      const { E, L, map } = sideFrame(lw, p.side);
      const [x, y] = map([(p.depth * E) / 3, L / 2]);
      const side = Math.round(p.side) < 2;
      const across = p.depth * E * 0.45;
      const along = L * p.base * 0.35;
      return [{ id: 'triangle', label: 'Triangle', x, y, w: side ? across : along, h: side ? along : across }];
    },
  },
  chevron: {
    kind: 'chevron',
    label: 'Chevron',
    params: [
      { key: 'side', label: 'Side', min: 0, max: 3, step: 1, value: 0, options: SIDE_OPTIONS },
      { key: 'depth', label: 'Depth', min: 0.05, max: 1, step: 0.01, value: 0.5 },
      { key: 'width', label: 'Width', min: 0.02, max: 0.6, step: 0.01, value: 0.15 },
    ],
    colors: ['#FFFFFF'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => {
      const { L, map, apex, e0, e1 } = wedge(lw, p, 1);
      // Shifted back along the reach far enough that the band is `width` across.
      const t = (p.width * Math.hypot(apex[0], L / 2)) / (L / 2);
      const shift = ([u, v]: Pt): Pt => [u - t, v];
      return [{ name: 'Chevron', rings: [[e0, apex, e1, shift(e1), shift(apex), shift(e0)].map(map)] }];
    },
    anchors: (lw, p) => {
      const { E, L, map } = sideFrame(lw, p.side);
      const t = (p.width * Math.hypot(p.depth * E, L / 2)) / (L / 2);
      const inner = p.depth * E - t;
      if (inner < 0.1) return [];
      const [x, y] = map([inner / 3, L / 2]);
      const side = Math.round(p.side) < 2;
      return [{ id: 'inside', label: 'Inside', x, y, w: side ? inner * 0.45 : L * 0.3, h: side ? L * 0.3 : inner * 0.45 }];
    },
  },
  canton: {
    kind: 'canton',
    label: 'Canton',
    params: [
      { key: 'corner', label: 'Corner', min: 0, max: 3, step: 1, value: 0, options: CORNER_OPTIONS },
      { key: 'width', label: 'Width', min: 0.05, max: 1, step: 0.01, value: 0.5 },
      { key: 'height', label: 'Height', min: 0.05, max: 1, step: 0.01, value: 0.5 },
    ],
    colors: ['#003DA5'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => {
      const R = reach(lw);
      const k = Math.round(p.corner) & 3;
      const hoist = k === 0 || k === 3;
      const top = k < 2;
      const w = p.width * lw;
      return [
        {
          name: 'Canton',
          rings: [rect(hoist ? -R : lw - w, top ? -R : 1 - p.height, hoist ? w : lw + R, top ? p.height : 1 + R)],
        },
      ];
    },
    anchors: (lw, p) => {
      const k = Math.round(p.corner) & 3;
      const w = p.width * lw;
      const x = k === 0 || k === 3 ? w / 2 : lw - w / 2;
      const y = k < 2 ? p.height / 2 : 1 - p.height / 2;
      return [{ id: 'canton', label: 'Canton', x, y, w: w * 0.8, h: p.height * 0.8 }];
    },
  },
  quarters: {
    kind: 'quarters',
    label: 'Quarters',
    params: [
      { key: 'x', label: 'Across', min: 0.05, max: 0.95, step: 0.01, value: 0.5 },
      { key: 'y', label: 'Down', min: 0.05, max: 0.95, step: 0.01, value: 0.5 },
    ],
    colors: ['#FFFFFF', '#C8102E'],
    cycles: true,
    tiling: true,
    pieces: (lw, p) => {
      const R = reach(lw);
      const [cx, cy] = [p.x * lw, p.y];
      return [
        { name: 'Upper hoist', rings: [rect(-R, -R, cx, cy)] },
        { name: 'Upper fly', rings: [rect(cx, -R, lw + R, cy)] },
        { name: 'Lower fly', rings: [rect(cx, cy, lw + R, 1 + R)] },
        { name: 'Lower hoist', rings: [rect(-R, cy, cx, 1 + R)] },
      ];
    },
    anchors: (lw, p) => {
      const [cx, cy] = [p.x * lw, p.y];
      const quarter = (id: string, label: string, x0: number, y0: number, x1: number, y1: number) => ({
        id,
        label,
        x: (x0 + x1) / 2,
        y: (y0 + y1) / 2,
        w: (x1 - x0) * 0.8,
        h: (y1 - y0) * 0.8,
      });
      return [
        quarter('uh', 'Upper hoist', 0, 0, cx, cy),
        quarter('uf', 'Upper fly', cx, 0, lw, cy),
        quarter('lf', 'Lower fly', cx, cy, lw, 1),
        quarter('lh', 'Lower hoist', 0, cy, cx, 1),
      ];
    },
  },
  'per-saltire': {
    kind: 'per-saltire',
    label: 'Diagonal quarters',
    params: [],
    colors: ['#009B3A', '#000000'],
    cycles: true,
    tiling: true,
    pieces: (lw) => {
      const c: Pt = [lw / 2, 0.5];
      const k = 1 + reach(lw);
      const K = frameCorners(lw).map(([x, y]): Pt => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);
      return [
        { name: 'Top', rings: [[c, K[0], K[1]]] },
        { name: 'Fly', rings: [[c, K[1], K[2]]] },
        { name: 'Bottom', rings: [[c, K[2], K[3]]] },
        { name: 'Hoist', rings: [[c, K[3], K[0]]] },
      ];
    },
    anchors: (lw) => [
      { id: 'hoist', label: 'Hoist', x: lw / 6, y: 0.5, w: lw * 0.18, h: 0.3 },
      { id: 'fly', label: 'Fly', x: (lw * 5) / 6, y: 0.5, w: lw * 0.18, h: 0.3 },
      { id: 'top', label: 'Top', x: lw / 2, y: 1 / 6, w: lw * 0.3, h: 0.18 },
      { id: 'bottom', label: 'Bottom', x: lw / 2, y: 5 / 6, w: lw * 0.3, h: 0.18 },
    ],
  },
  border: {
    kind: 'border',
    label: 'Border',
    params: [{ key: 'width', label: 'Width', min: 0.01, max: 0.45, step: 0.01, value: 0.08 }],
    colors: ['#FFD100'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => {
      const R = reach(lw);
      const b = Math.min(p.width, 0.49, lw / 2 - 0.01);
      return [{ name: 'Border', rings: [rect(-R, -R, lw + R, 1 + R)], holes: [rect(b, b, lw - b, 1 - b)] }];
    },
    anchors: (lw, p) => [centreAnchor(lw, (lw - p.width * 2) * 0.6, (1 - p.width * 2) * 0.6)],
  },
  disc: {
    kind: 'disc',
    label: 'Disc',
    params: [
      { key: 'size', label: 'Size', min: 0.05, max: 1.5, step: 0.01, value: 0.6 },
      { key: 'x', label: 'Across', min: 0, max: 1, step: 0.01, value: 0.5 },
      { key: 'y', label: 'Down', min: 0, max: 1, step: 0.01, value: 0.5 },
    ],
    colors: ['#BC002D'],
    cycles: false,
    tiling: false,
    pieces: (lw, p) => {
      const r = p.size / 2;
      const ring = Array.from({ length: 128 }, (_, i): Pt => {
        const a = (i / 128) * 2 * Math.PI;
        return [p.x * lw + r * Math.cos(a), p.y + r * Math.sin(a)];
      });
      return [{ name: 'Disc', rings: [ring] }];
    },
    anchors: (lw, p) => [{ id: 'disc', label: 'Disc', x: p.x * lw, y: p.y, w: p.size * 0.72, h: p.size * 0.72 }],
  },
  rays: {
    kind: 'rays',
    label: 'Rays',
    params: [
      { key: 'count', label: 'Rays', min: 2, max: 48, step: 1, value: 16 },
      { key: 'rotation', label: 'Turn', min: -180, max: 180, step: 1, value: 0 },
      { key: 'sweep', label: 'Spread', min: 10, max: 360, step: 1, value: 360 },
      { key: 'x', label: 'Across', min: 0, max: 1, step: 0.01, value: 0.5 },
      { key: 'y', label: 'Down', min: 0, max: 1, step: 0.01, value: 0.5 },
    ],
    colors: ['#FFD100', '#C8102E'],
    cycles: true,
    tiling: true,
    weighted: count,
    pieces: (lw, p) => {
      const n = count(p);
      const at = cuts(p, n);
      const c: Pt = [p.x * lw, p.y];
      const R = reach(lw) * 2;
      const angle = (f: number) => (p.rotation + f * p.sweep) * DEG;
      return at.slice(0, -1).map((from, i) => {
        const [a0, a1] = [angle(from), angle(at[i + 1])];
        const steps = Math.max(1, Math.ceil((a1 - a0) / (45 * DEG)));
        const arc = Array.from({ length: steps + 1 }, (_, j): Pt => {
          const a = a0 + ((a1 - a0) * j) / steps;
          return [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
        });
        return { name: `Ray ${i + 1}`, rings: [[c, ...arc]] };
      });
    },
    anchors: (lw, p) => [{ id: 'centre', label: 'Rays', x: p.x * lw, y: p.y, w: 0.3, h: 0.3 }],
  },
};

export const DIVISION_KINDS = Object.keys(DIVISIONS) as DivisionKind[];

export function divisionParams(division: Pick<StudioDivision, 'kind' | 'params'>): Params {
  return { ...Object.fromEntries(DIVISIONS[division.kind].params.map((param) => [param.key, param.value])), ...division.params };
}

/** How many parts a division has, which is how many of its colours show. */
export function divisionParts(division: Pick<StudioDivision, 'kind' | 'params'>) {
  return DIVISIONS[division.kind].pieces(1.5, divisionParams(division)).length;
}

/** The colours a division paints with, fimbriation included. */
export function divisionColors(division: StudioDivision) {
  const shown = division.colors.slice(0, DIVISIONS[division.kind].cycles ? divisionParts(division) : 1);
  return division.fimbriation ? [...shown, division.fimbriation.color] : shown;
}

export const FULL_BOX: [number, number, number, number] = [0, 0, 1, 1];

/** The division's box in flag units. */
export function divisionFrame(division: Pick<StudioDivision, 'box'>, W: number) {
  const [x0, y0, x1, y1] = division.box ?? FULL_BOX;
  const h = Math.max(0.01, y1 - y0);
  return { x: x0 * W, y: y0, w: Math.max(0.01, (x1 - x0) * W), h };
}

// —— Edges ——

type Area = { x0: number; y0: number; x1: number; y1: number };
const JUMP = 1e-6;

const BREAKS: Record<EdgeStyle, { at: number; jump: boolean }[]> = {
  wavy: [],
  zigzag: [
    { at: 0.25, jump: false },
    { at: 0.75, jump: false },
  ],
  serrated: [{ at: 0, jump: true }],
  stepped: [
    { at: 0, jump: true },
    { at: 0.5, jump: true },
  ],
};

/** The edge's offset at a phase in [0, 1), from −1 to 1. */
function wave(style: EdgeStyle, phase: number) {
  switch (style) {
    case 'wavy':
      return Math.sin(phase * 2 * Math.PI);
    case 'zigzag':
      return phase < 0.25 ? 4 * phase : phase < 0.75 ? 2 - 4 * phase : 4 * phase - 4;
    case 'serrated':
      return 2 * phase - 1;
    case 'stepped':
      return phase < 0.5 ? 1 : -1;
  }
}

const frac = (x: number) => x - Math.floor(x);

/** Distances along an edge (from its start, between `from` and `to`) where its shape bends. */
function samplePoints(style: EdgeStyle, period: number, from: number, to: number, offset: number) {
  const out: number[] = [];
  const [t0, t1] = [offset + from, offset + to];
  if (style === 'wavy') {
    const step = Math.max(period / 24, 0.0015);
    for (let k = Math.ceil(t0 / step); k * step <= t1; k++) out.push(k * step - offset);
  } else {
    for (let k = Math.floor(t0 / period); k * period <= t1 + period; k++) {
      for (const b of BREAKS[style]) {
        const t = (k + b.at) * period - offset;
        if (b.jump) out.push(t - JUMP, t + JUMP);
        else out.push(t);
      }
    }
  }
  return out.filter((u) => u >= from && u <= to);
}

/** The part of segment a→b inside an area, as fractions along it (Liang–Barsky), or null. */
function clipRange(a: Pt, b: Pt, area: Area): [number, number] | null {
  let [t0, t1] = [0, 1];
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const checks: [number, number][] = [
    [-dx, a[0] - area.x0],
    [dx, area.x1 - a[0]],
    [-dy, a[1] - area.y0],
    [dy, area.y1 - a[1]],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [t0, t1];
}

/**
 * A straight edge reshaped. Its wave is laid out along the line it lies on, in the direction
 * that points right (or down), so two parts sharing an edge shape it identically. It eases out
 * toward its ends so corners still meet, and stays straight where it can't be seen.
 */
function styleSegment(P: Pt, Q: Pt, edge: Edge, area: Area): Pt[] {
  const reversed = Q[0] < P[0] - 1e-9 || (Math.abs(Q[0] - P[0]) <= 1e-9 && Q[1] < P[1]);
  const [a, b] = reversed ? [Q, P] : [P, Q];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const range = len > 1e-9 ? clipRange(a, b, area) : null;
  if (!range) return [P, Q];
  const d: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n: Pt = [-d[1], d[0]];
  const offset = a[0] * d[0] + a[1] * d[1];
  const { style, period } = edge;
  const amp = edge.depth / 2;
  const [from, to] = [range[0] * len, range[1] * len];
  const knots =
    style === 'stepped'
      ? [period / 2 - JUMP, period / 2 + JUMP, len - period / 2 - JUMP, len - period / 2 + JUMP]
      : [period, len - period];
  const us = [from, to, ...samplePoints(style, period, from, to, offset), ...knots.filter((u) => u > from && u < to)].sort((x, y) => x - y);
  const taper = (u: number) =>
    style === 'stepped' ? (u < period / 2 || len - u < period / 2 ? 0 : 1) : Math.max(0, Math.min(1, u / period, (len - u) / period));
  const pts: Pt[] = [a];
  let last = -Infinity;
  for (const u of us) {
    if (u - last < JUMP / 2) continue;
    last = u;
    const off = amp * wave(style, frac((offset + u) / period)) * taper(u);
    pts.push([a[0] + d[0] * u + n[0] * off, a[1] + d[1] * u + n[1] * off]);
  }
  pts.push(b);
  return reversed ? pts.reverse() : pts;
}

/** A closed curve (a disc) reshaped all the way round, its period fitted to go round evenly. */
function styleLoop(ring: Ring, edge: Edge): Ring {
  const n = ring.length;
  const lens = ring.map((p, i) => Math.hypot(ring[(i + 1) % n][0] - p[0], ring[(i + 1) % n][1] - p[1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const period = total / Math.max(3, Math.round(total / edge.period));
  const starts: number[] = [];
  lens.reduce((at, len) => (starts.push(at), at + len), 0);
  const segNormal = (i: number): Pt => {
    const [p, q] = [ring[i], ring[(i + 1) % n]];
    return [-(q[1] - p[1]) / lens[i], (q[0] - p[0]) / lens[i]];
  };
  const normals = ring.map((_, i) => {
    const [a, b] = [segNormal((i + n - 1) % n), segNormal(i)];
    const len = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
    return [(a[0] + b[0]) / len, (a[1] + b[1]) / len] as Pt;
  });
  const us = [...starts, ...samplePoints(edge.style, period, 0, total, 0)].filter((u) => u < total).sort((x, y) => x - y);
  const out: Ring = [];
  let i = 0;
  let last = -Infinity;
  for (const u of us) {
    if (u - last < JUMP / 2) continue;
    last = u;
    while (i < n - 1 && u >= starts[i + 1]) i++;
    const f = (u - starts[i]) / lens[i];
    const [p, q] = [ring[i], ring[(i + 1) % n]];
    const [na, nb] = [normals[i], normals[(i + 1) % n]];
    const nx = na[0] + (nb[0] - na[0]) * f;
    const ny = na[1] + (nb[1] - na[1]) * f;
    const nl = Math.hypot(nx, ny) || 1;
    const off = (edge.depth / 2) * wave(edge.style, frac(u / period));
    out.push([p[0] + (q[0] - p[0]) * f + (nx / nl) * off, p[1] + (q[1] - p[1]) * f + (ny / nl) * off]);
  }
  return out;
}

function turn(a: Pt, b: Pt, c: Pt) {
  const [ux, uy] = [b[0] - a[0], b[1] - a[1]];
  const [vx, vy] = [c[0] - b[0], c[1] - b[1]];
  const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return len ? Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / len))) : 0;
}

function styleRing(ring: Ring, edge: Edge, area: Area): Ring {
  const n = ring.length;
  const cornered = ring.some((p, i) => turn(ring[(i + n - 1) % n], p, ring[(i + 1) % n]) > 20 * DEG);
  if (!cornered) return styleLoop(ring, edge);
  return ring.flatMap((p, i) => styleSegment(p, ring[(i + 1) % n], edge, area).slice(0, -1));
}

// —— Geometry ——

export type DivisionPart = { name: string; d: string };
export type DivisionGeometry = {
  parts: DivisionPart[];
  /** The box it's clipped to, in flag units. */
  clip: { x: number; y: number; w: number; h: number };
  tiling: boolean;
  /** The straight, upright lines it draws, in flag units: where a region guide can follow it. */
  xs: number[];
  ys: number[];
};

const signedArea = (ring: Ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
const oriented = (ring: Ring, positive: boolean) => ((signedArea(ring) >= 0) === positive ? ring : [...ring].reverse());
const num = (v: number) => String(Math.round(v * 1e4) / 1e4);
const pathOf = (rings: Ring[]) => rings.map((ring) => `M${ring.map((p) => `${num(p[0])} ${num(p[1])}`).join('L')}Z`).join('');

const geometryCache = new WeakMap<StudioDivision, { W: number; geometry: DivisionGeometry }>();

/** A division's parts as SVG paths in flag units. */
export function divisionGeometry(division: StudioDivision, W: number): DivisionGeometry {
  const cached = geometryCache.get(division);
  if (cached && cached.W === W) return cached.geometry;
  const def = DIVISIONS[division.kind];
  const clip = divisionFrame(division, W);
  const lw = clip.w / clip.h;
  const toFlag = (ring: Ring): Ring => ring.map(([x, y]) => [clip.x + x * clip.h, clip.y + y * clip.h]);
  const edge = division.edge && division.edge.depth > 0 ? division.edge : null;
  const margin = edge ? edge.depth + edge.period : 0;
  const area = { x0: clip.x - margin, y0: clip.y - margin, x1: clip.x + clip.w + margin, y1: clip.y + clip.h + margin };
  const xs: number[] = [];
  const ys: number[] = [];
  if (division.box) {
    xs.push(clip.x, clip.x + clip.w);
    ys.push(clip.y, clip.y + clip.h);
  }

  const parts = def.pieces(lw, divisionParams(division)).map((piece) => {
    const rings = [...piece.rings.map((r) => oriented(toFlag(r), true)), ...(piece.holes ?? []).map((r) => oriented(toFlag(r), false))];
    const upright = rings.every((ring) =>
      ring.every((p, i) => {
        const q = ring[(i + 1) % ring.length];
        return Math.abs(p[0] - q[0]) < 1e-9 || Math.abs(p[1] - q[1]) < 1e-9;
      }),
    );
    if (upright && !edge) {
      for (const [x, y] of rings.flat()) {
        xs.push(Math.min(Math.max(x, clip.x), clip.x + clip.w));
        ys.push(Math.min(Math.max(y, clip.y), clip.y + clip.h));
      }
    }
    return { name: piece.name, d: pathOf(edge ? rings.map((ring) => styleRing(ring, edge, area)) : rings) };
  });

  const geometry = { parts, clip, tiling: def.tiling, xs, ys };
  geometryCache.set(division, { W, geometry });
  return geometry;
}

/** A division's anchors in flag units. */
export function divisionAnchors(division: StudioDivision, W: number): Anchor[] {
  const clip = divisionFrame(division, W);
  const lw = clip.w / clip.h;
  return DIVISIONS[division.kind].anchors(lw, divisionParams(division)).map((a) => ({
    id: `${division.id}:${a.id}`,
    label: a.label,
    x: clip.x + a.x * clip.h,
    y: clip.y + a.y * clip.h,
    w: a.w * clip.h,
    h: a.h * clip.h,
  }));
}

/** Places emblems snap to: the topmost division's first, then the flag's centre and hoist. */
export function fieldAnchors(design: StudioDesign): Anchor[] {
  const W = design.ratio[1] / design.ratio[0];
  const flag: Anchor[] = [
    { id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: W * 0.55, h: 0.6 },
    { id: 'hoist', label: 'Hoist', x: W / 4, y: 0.5, w: W * 0.4, h: 0.55 },
  ];
  if (design.field.kind !== 'stack') return flag;
  const own = [...design.field.divisions]
    .reverse()
    .filter((d) => !d.hidden)
    .flatMap((d) => divisionAnchors(d, W));
  return [...own, ...flag];
}

// —— Hit testing ——

/** What's under a point on the field: a division's part or fimbriation, or the base (no division). */
export type FieldPart = {
  divisionId: string | null;
  /** Which of the division's parts. */
  part: number;
  /** Which of its colours. */
  slot: number;
  target: 'fill' | 'fimbriation';
  color: string;
  name: string;
};

let scratch: CanvasRenderingContext2D | null = null;
const pathCache = new WeakMap<DivisionGeometry, Path2D[]>();

function scratchContext() {
  scratch ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  return scratch;
}

function partPaths(geometry: DivisionGeometry) {
  let paths = pathCache.get(geometry);
  if (!paths) pathCache.set(geometry, (paths = geometry.parts.map((part) => new Path2D(part.d))));
  return paths;
}

const inFrame = (clip: DivisionGeometry['clip'], px: number, py: number) =>
  px >= clip.x && px <= clip.x + clip.w && py >= clip.y && py <= clip.y + clip.h;

/**
 * The division part a clip points at, with its outline in flag units and, for a division drawn
 * in a box, that box. Null when it's gone: the division deleted, or with fewer parts now.
 */
export function resolvePart(field: StudioField, ref: FieldPartRef | null | undefined, W: number) {
  if (!ref || field.kind !== 'stack') return null;
  const division = field.divisions.find((d) => d.id === ref.divisionId);
  if (!division) return null;
  const geometry = divisionGeometry(division, W);
  const part = geometry.parts[ref.part];
  return part ? { division, name: part.name, d: part.d, box: division.box ? geometry.clip : null, geometry } : null;
}

/**
 * Whether a point (flag units) is inside a field part, by its own outline: the part's division
 * being clipped too doesn't carry over. A part that's gone clips nothing.
 */
export function insidePart(field: StudioField, ref: FieldPartRef, W: number, px: number, py: number) {
  const target = resolvePart(field, ref, W);
  const ctx = scratchContext();
  if (!target || !ctx) return true;
  if (target.box && !inFrame(target.box, px, py)) return false;
  return ctx.isPointInPath(partPaths(target.geometry)[ref.part], px, py);
}

/** What a division is called in lists: its own name, or what kind it is. */
export const divisionLabel = (division: StudioDivision) => division.name ?? DIVISIONS[division.kind].label;

/** The field part under a point (flag units); null for an image field. */
export function fieldPartAt(design: StudioDesign, px: number, py: number): FieldPart | null {
  const field = design.field;
  if (field.kind !== 'stack') return null;
  const base: FieldPart = { divisionId: null, part: 0, slot: 0, target: 'fill', color: field.color, name: 'Field' };
  const ctx = scratchContext();
  if (!ctx) return base;
  const W = design.ratio[1] / design.ratio[0];
  for (let k = field.divisions.length - 1; k >= 0; k--) {
    const division = field.divisions[k];
    if (division.hidden) continue;
    const geometry = divisionGeometry(division, W);
    if (!inFrame(geometry.clip, px, py)) continue;
    if (division.clip && !insidePart(field, division.clip, W, px, py)) continue;
    const paths = partPaths(geometry);
    const fim = division.fimbriation;
    if (fim && fim.width > 0) {
      ctx.lineWidth = geometry.tiling ? fim.width : fim.width * 2;
      ctx.lineJoin = division.edge ? 'round' : 'miter';
      ctx.miterLimit = 20;
      for (const path of paths) {
        // A charge's fimbriation is under its fill; only the outer half shows.
        if (ctx.isPointInStroke(path, px, py) && (geometry.tiling || !ctx.isPointInPath(path, px, py))) {
          return { divisionId: division.id, part: 0, slot: 0, target: 'fimbriation', color: fim.color, name: 'Fimbriation' };
        }
      }
    }
    for (let i = paths.length - 1; i >= 0; i--) {
      if (ctx.isPointInPath(paths[i], px, py)) {
        const slot = i % division.colors.length;
        return { divisionId: division.id, part: i, slot, target: 'fill', color: division.colors[slot], name: geometry.parts[i].name };
      }
    }
  }
  return base;
}
