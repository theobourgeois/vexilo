import type { LayoutId } from '@/lib/studio-design';

/** Geometry is in flag units: the flag is W wide and 1 tall. */
export type Shape = { slot: number; d: string };
export type Anchor = { id: string; label: string; x: number; y: number; w: number; h: number };
export type ParamDef = { key: string; label: string; min: number; max: number; step: number; value: number };

export type LayoutDef = {
  id: LayoutId;
  slots: string[];
  params: ParamDef[];
  colors: string[];
  /** Painted in order, later shapes over earlier ones. */
  shapes: (W: number, p: Record<string, number>) => Shape[];
  /** Places emblems snap to, with the room available there. */
  anchors: (W: number, p: Record<string, number>) => Anchor[];
};

const r = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}z`;
const poly = (...pts: [number, number][]) => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}z`;
/** A band of thickness t along the line a→b, overshooting both ends so it reaches the flag edges. */
function band(a: [number, number], b: [number, number], t: number) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [ux, uy] = [dx / len, dy / len];
  const [nx, ny] = [(-uy * t) / 2, (ux * t) / 2];
  const a2: [number, number] = [a[0] - ux, a[1] - uy];
  const b2: [number, number] = [b[0] + ux, b[1] + uy];
  return poly([a2[0] + nx, a2[1] + ny], [b2[0] + nx, b2[1] + ny], [b2[0] - nx, b2[1] - ny], [a2[0] - nx, a2[1] - ny]);
}

const circle = (cx: number, cy: number, radius: number) =>
  `M${cx - radius} ${cy}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0z`;

const centre = (W: number, w = W * 0.55, h = 0.6): Anchor => ({ id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w, h });

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  solid: {
    id: 'solid',
    slots: ['Field'],
    params: [],
    colors: ['#C8102E'],
    shapes: (W) => [{ slot: 0, d: r(0, 0, W, 1) }],
    anchors: (W) => [centre(W), { id: 'hoist', label: 'Hoist', x: W / 4, y: 0.5, w: W * 0.4, h: 0.55 }],
  },
  'bicolor-h': {
    id: 'bicolor-h',
    slots: ['Top', 'Bottom'],
    params: [{ key: 'split', label: 'Split', min: 0.2, max: 0.8, step: 0.01, value: 0.5 }],
    colors: ['#FFFFFF', '#DC143C'],
    shapes: (W, p) => [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d: r(0, p.split, W, 1 - p.split) }],
    anchors: (W, p) => [
      centre(W, W * 0.5, 0.65),
      { id: 'top', label: 'Top', x: W / 2, y: p.split / 2, w: W * 0.6, h: p.split * 0.8 },
      { id: 'bottom', label: 'Bottom', x: W / 2, y: (1 + p.split) / 2, w: W * 0.6, h: (1 - p.split) * 0.8 },
      { id: 'canton', label: 'Hoist', x: W / 4, y: p.split / 2, w: W * 0.4, h: p.split * 0.8 },
    ],
  },
  'bicolor-v': {
    id: 'bicolor-v',
    slots: ['Hoist', 'Fly'],
    params: [{ key: 'split', label: 'Split', min: 0.2, max: 0.8, step: 0.01, value: 0.5 }],
    colors: ['#006600', '#FF0000'],
    shapes: (W, p) => [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d: r(W * p.split, 0, W * (1 - p.split), 1) }],
    anchors: (W, p) => [
      { id: 'centre', label: 'Division', x: W * p.split, y: 0.5, w: W * 0.4, h: 0.6 },
      { id: 'hoist', label: 'Hoist', x: (W * p.split) / 2, y: 0.5, w: W * p.split * 0.8, h: 0.7 },
      { id: 'fly', label: 'Fly', x: W * (1 + p.split) / 2, y: 0.5, w: W * (1 - p.split) * 0.8, h: 0.7 },
    ],
  },
  'triband-h': {
    id: 'triband-h',
    slots: ['Top', 'Middle', 'Bottom'],
    params: [{ key: 'middle', label: 'Middle', min: 0.15, max: 0.7, step: 0.01, value: 1 / 3 }],
    colors: ['#000000', '#DD0000', '#FFCE00'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: r(0, (1 - p.middle) / 2, W, p.middle) },
      { slot: 2, d: r(0, (1 + p.middle) / 2, W, (1 - p.middle) / 2) },
    ],
    anchors: (W, p) => [
      { id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: W * 0.6, h: p.middle * 0.85 },
      { id: 'hoist', label: 'Hoist', x: W * 0.22, y: 0.5, w: W * 0.3, h: p.middle * 0.85 },
      { id: 'top', label: 'Top', x: W / 2, y: (1 - p.middle) / 4, w: W * 0.6, h: ((1 - p.middle) / 2) * 0.75 },
    ],
  },
  'triband-v': {
    id: 'triband-v',
    slots: ['Hoist', 'Middle', 'Fly'],
    params: [{ key: 'middle', label: 'Middle', min: 0.15, max: 0.7, step: 0.01, value: 1 / 3 }],
    colors: ['#0055A4', '#FFFFFF', '#EF4135'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: r((W * (1 - p.middle)) / 2, 0, W * p.middle, 1) },
      { slot: 2, d: r((W * (1 + p.middle)) / 2, 0, (W * (1 - p.middle)) / 2, 1) },
    ],
    anchors: (W, p) => [{ id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: W * p.middle * 0.85, h: 0.75 }],
  },
  'stripes-h': {
    id: 'stripes-h',
    slots: ['Stripes', 'Between'],
    params: [{ key: 'count', label: 'Stripes', min: 3, max: 15, step: 1, value: 7 }],
    colors: ['#B22234', '#FFFFFF'],
    shapes: (W, p) => {
      const n = Math.round(p.count);
      const d = Array.from({ length: n }, (_, i) => i)
        .filter((i) => i % 2 === 1)
        .map((i) => r(0, i / n, W, 1 / n))
        .join('');
      return [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d }];
    },
    anchors: (W) => [centre(W)],
  },
  cross: {
    id: 'cross',
    slots: ['Field', 'Cross'],
    params: [{ key: 'width', label: 'Width', min: 0.06, max: 0.45, step: 0.01, value: 0.2 }],
    colors: ['#FFFFFF', '#CE1124'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: r(0, (1 - p.width) / 2, W, p.width) + r((W - p.width) / 2, 0, p.width, 1) },
    ],
    anchors: (W, p) => [
      { id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: p.width * 0.85, h: p.width * 0.85 },
      { id: 'canton', label: 'Canton', x: (W - p.width) / 4, y: (1 - p.width) / 4, w: ((W - p.width) / 2) * 0.75, h: ((1 - p.width) / 2) * 0.75 },
    ],
  },
  nordic: {
    id: 'nordic',
    slots: ['Field', 'Cross'],
    params: [
      { key: 'width', label: 'Width', min: 0.06, max: 0.4, step: 0.01, value: 0.19 },
      { key: 'offset', label: 'Offset', min: 0.2, max: 0.5, step: 0.01, value: 0.36 },
    ],
    colors: ['#C8102E', '#FFFFFF'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: r(0, (1 - p.width) / 2, W, p.width) + r(W * p.offset - p.width / 2, 0, p.width, 1) },
    ],
    anchors: (W, p) => [
      { id: 'centre', label: 'Crossing', x: W * p.offset, y: 0.5, w: p.width * 0.85, h: p.width * 0.85 },
      { id: 'canton', label: 'Canton', x: (W * p.offset - p.width / 2) / 2, y: (1 - p.width) / 4, w: (W * p.offset - p.width / 2) * 0.75, h: ((1 - p.width) / 2) * 0.75 },
      { id: 'fly', label: 'Fly', x: (W + W * p.offset + p.width / 2) / 2, y: (1 - p.width) / 4, w: (W - W * p.offset - p.width / 2) * 0.6, h: ((1 - p.width) / 2) * 0.75 },
    ],
  },
  'nordic-fimbriated': {
    id: 'nordic-fimbriated',
    slots: ['Field', 'Border', 'Cross'],
    params: [
      { key: 'width', label: 'Width', min: 0.06, max: 0.3, step: 0.01, value: 0.12 },
      { key: 'border', label: 'Border', min: 0.02, max: 0.12, step: 0.005, value: 0.06 },
      { key: 'offset', label: 'Offset', min: 0.2, max: 0.5, step: 0.01, value: 0.36 },
    ],
    colors: ['#BA0C2F', '#FFFFFF', '#00205B'],
    shapes: (W, p) => {
      const outer = p.width + p.border * 2;
      const cx = W * p.offset;
      return [
        { slot: 0, d: r(0, 0, W, 1) },
        { slot: 1, d: r(0, (1 - outer) / 2, W, outer) + r(cx - outer / 2, 0, outer, 1) },
        { slot: 2, d: r(0, (1 - p.width) / 2, W, p.width) + r(cx - p.width / 2, 0, p.width, 1) },
      ];
    },
    anchors: (W, p) => {
      const outer = p.width + p.border * 2;
      const cx = W * p.offset;
      return [
        { id: 'centre', label: 'Crossing', x: cx, y: 0.5, w: p.width * 0.85, h: p.width * 0.85 },
        { id: 'canton', label: 'Canton', x: (cx - outer / 2) / 2, y: (1 - outer) / 4, w: (cx - outer / 2) * 0.75, h: ((1 - outer) / 2) * 0.75 },
      ];
    },
  },
  saltire: {
    id: 'saltire',
    slots: ['Field', 'Saltire'],
    params: [{ key: 'width', label: 'Width', min: 0.06, max: 0.4, step: 0.01, value: 0.18 }],
    colors: ['#005EB8', '#FFFFFF'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: band([0, 0], [W, 1], p.width) + band([0, 1], [W, 0], p.width) },
    ],
    anchors: (W) => [
      { id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: 0.3, h: 0.3 },
      { id: 'hoist', label: 'Hoist', x: W * 0.17, y: 0.5, w: W * 0.18, h: 0.4 },
      { id: 'fly', label: 'Fly', x: W * 0.83, y: 0.5, w: W * 0.18, h: 0.4 },
      { id: 'top', label: 'Top', x: W / 2, y: 0.17, w: W * 0.3, h: 0.22 },
    ],
  },
  canton: {
    id: 'canton',
    slots: ['Field', 'Canton'],
    params: [{ key: 'size', label: 'Canton', min: 0.25, max: 0.75, step: 0.01, value: 0.5 }],
    colors: ['#FE0000', '#000095'],
    shapes: (W, p) => [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d: r(0, 0, W * p.size, p.size) }],
    anchors: (W, p) => [
      { id: 'canton', label: 'Canton', x: (W * p.size) / 2, y: p.size / 2, w: W * p.size * 0.8, h: p.size * 0.8 },
      { id: 'fly', label: 'Fly', x: (W + W * p.size) / 2, y: 0.5, w: W * (1 - p.size) * 0.8, h: 0.6 },
      centre(W),
    ],
  },
  border: {
    id: 'border',
    slots: ['Border', 'Field'],
    params: [{ key: 'width', label: 'Border', min: 0.02, max: 0.25, step: 0.005, value: 0.08 }],
    colors: ['#FFBE29', '#8D153A'],
    shapes: (W, p) => [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d: r(p.width, p.width, W - p.width * 2, 1 - p.width * 2) }],
    anchors: (W, p) => [centre(W, (W - p.width * 2) * 0.7, (1 - p.width * 2) * 0.75)],
  },
  'hoist-triangle': {
    id: 'hoist-triangle',
    slots: ['Top', 'Bottom', 'Triangle'],
    params: [{ key: 'depth', label: 'Depth', min: 0.15, max: 0.7, step: 0.01, value: 0.5 }],
    colors: ['#FFFFFF', '#D7141A', '#11457E'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: r(0, 0.5, W, 0.5) },
      { slot: 2, d: poly([0, 0], [W * p.depth, 0.5], [0, 1]) },
    ],
    anchors: (W, p) => [
      { id: 'triangle', label: 'Triangle', x: (W * p.depth) / 3, y: 0.5, w: W * p.depth * 0.45, h: 0.42 },
      centre(W),
    ],
  },
  'triband-triangle': {
    id: 'triband-triangle',
    slots: ['Top', 'Middle', 'Bottom', 'Triangle'],
    params: [{ key: 'depth', label: 'Depth', min: 0.15, max: 0.7, step: 0.01, value: 0.4 }],
    colors: ['#000000', '#FFFFFF', '#007A3D', '#CE1126'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: r(0, 1 / 3, W, 1 / 3) },
      { slot: 2, d: r(0, 2 / 3, W, 1 / 3) },
      { slot: 3, d: poly([0, 0], [W * p.depth, 0.5], [0, 1]) },
    ],
    anchors: (W, p) => [
      { id: 'triangle', label: 'Triangle', x: (W * p.depth) / 3, y: 0.5, w: W * p.depth * 0.45, h: 0.4 },
      { id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: W * 0.4, h: 0.28 },
    ],
  },
  diagonal: {
    id: 'diagonal',
    slots: ['Hoist', 'Fly'],
    params: [],
    colors: ['#FFD520', '#FF4E12'],
    shapes: (W) => [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d: poly([W, 0], [W, 1], [0, 1]) }],
    anchors: (W) => [
      centre(W, W * 0.6, 0.7),
      { id: 'hoist', label: 'Hoist', x: W / 3, y: 1 / 3, w: W * 0.35, h: 0.38 },
      { id: 'fly', label: 'Fly', x: (W * 2) / 3, y: 2 / 3, w: W * 0.35, h: 0.38 },
    ],
  },
  'diagonal-band': {
    id: 'diagonal-band',
    slots: ['Hoist', 'Band', 'Fly'],
    params: [{ key: 'width', label: 'Band', min: 0.1, max: 0.6, step: 0.01, value: 0.3 }],
    colors: ['#1EB53A', '#000000', '#00A3DD'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 2, d: poly([W, 0], [W, 1], [0, 1]) },
      { slot: 1, d: band([0, 1], [W, 0], p.width) },
    ],
    anchors: (W) => [
      { id: 'hoist', label: 'Hoist', x: W * 0.22, y: 0.27, w: W * 0.2, h: 0.3 },
      { id: 'fly', label: 'Fly', x: W * 0.78, y: 0.73, w: W * 0.2, h: 0.3 },
      centre(W, 0.35, 0.35),
    ],
  },
  quartered: {
    id: 'quartered',
    slots: ['Field', 'Quarters'],
    params: [],
    colors: ['#FFFFFF', '#DA121A'],
    shapes: (W) => [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d: r(W / 2, 0, W / 2, 0.5) + r(0, 0.5, W / 2, 0.5) }],
    anchors: (W) => [
      { id: 'canton', label: 'Canton', x: W / 4, y: 0.25, w: W * 0.4, h: 0.4 },
      { id: 'lower-fly', label: 'Fly', x: (W * 3) / 4, y: 0.75, w: W * 0.4, h: 0.4 },
      centre(W, 0.3, 0.3),
    ],
  },
  'stripes-v': {
    id: 'stripes-v',
    slots: ['Stripes', 'Between'],
    params: [{ key: 'count', label: 'Stripes', min: 3, max: 15, step: 1, value: 5 }],
    colors: ['#0055A4', '#FFFFFF'],
    shapes: (W, p) => {
      const n = Math.round(p.count);
      const d = Array.from({ length: n }, (_, i) => i)
        .filter((i) => i % 2 === 1)
        .map((i) => r((W * i) / n, 0, W / n, 1))
        .join('');
      return [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d }];
    },
    anchors: (W) => [centre(W)],
  },
  'pentaband-h': {
    id: 'pentaband-h',
    slots: ['Outer', 'Inner', 'Middle'],
    params: [
      { key: 'middle', label: 'Middle', min: 0.15, max: 0.5, step: 0.01, value: 1 / 3 },
      { key: 'inner', label: 'Inner', min: 0.04, max: 0.25, step: 0.01, value: 1 / 6 },
    ],
    colors: ['#A51931', '#F4F5F8', '#2D2A4A'],
    shapes: (W, p) => {
      const top = (1 - p.middle) / 2;
      const inner = Math.min(p.inner, top);
      return [
        { slot: 0, d: r(0, 0, W, 1) },
        { slot: 1, d: r(0, top - inner, W, p.middle + inner * 2) },
        { slot: 2, d: r(0, top, W, p.middle) },
      ];
    },
    anchors: (W, p) => [{ id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: W * 0.6, h: p.middle * 0.85 }],
  },
  'stars-stripes': {
    id: 'stars-stripes',
    slots: ['Stripes', 'Between', 'Canton'],
    params: [
      { key: 'count', label: 'Stripes', min: 3, max: 15, step: 1, value: 13 },
      { key: 'width', label: 'Canton width', min: 0.25, max: 0.6, step: 0.01, value: 0.4 },
      { key: 'height', label: 'Canton height', min: 0.25, max: 0.75, step: 0.01, value: 7 / 13 },
    ],
    colors: ['#B22234', '#FFFFFF', '#3C3B6E'],
    shapes: (W, p) => {
      const n = Math.round(p.count);
      const d = Array.from({ length: n }, (_, i) => i)
        .filter((i) => i % 2 === 1)
        .map((i) => r(0, i / n, W, 1 / n))
        .join('');
      return [{ slot: 0, d: r(0, 0, W, 1) }, { slot: 1, d }, { slot: 2, d: r(0, 0, W * p.width, p.height) }];
    },
    anchors: (W, p) => [
      { id: 'canton', label: 'Canton', x: (W * p.width) / 2, y: p.height / 2, w: W * p.width * 0.8, h: p.height * 0.8 },
      centre(W),
    ],
  },
  'hoist-band': {
    id: 'hoist-band',
    slots: ['Top', 'Middle', 'Bottom', 'Hoist'],
    params: [{ key: 'width', label: 'Band', min: 0.12, max: 0.45, step: 0.01, value: 0.25 }],
    colors: ['#00732F', '#FFFFFF', '#000000', '#FF0000'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: r(0, 1 / 3, W, 1 / 3) },
      { slot: 2, d: r(0, 2 / 3, W, 1 / 3) },
      { slot: 3, d: r(0, 0, W * p.width, 1) },
    ],
    anchors: (W, p) => [
      { id: 'hoist', label: 'Hoist', x: (W * p.width) / 2, y: 0.5, w: W * p.width * 0.75, h: 0.4 },
      { id: 'centre', label: 'Centre', x: (W * (1 + p.width)) / 2, y: 0.5, w: W * (1 - p.width) * 0.6, h: 0.28 },
    ],
  },
  disc: {
    id: 'disc',
    slots: ['Field', 'Disc'],
    params: [
      { key: 'size', label: 'Disc', min: 0.2, max: 0.9, step: 0.01, value: 0.6 },
      { key: 'offset', label: 'Position', min: 0.25, max: 0.75, step: 0.01, value: 0.5 },
    ],
    colors: ['#FFFFFF', '#BC002D'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: circle(W * p.offset, 0.5, p.size / 2) },
    ],
    anchors: (W, p) => [{ id: 'centre', label: 'Disc', x: W * p.offset, y: 0.5, w: p.size * 0.7, h: p.size * 0.7 }],
  },
  'per-saltire': {
    id: 'per-saltire',
    slots: ['Top and bottom', 'Sides', 'Saltire'],
    params: [{ key: 'width', label: 'Saltire', min: 0.04, max: 0.35, step: 0.01, value: 0.14 }],
    colors: ['#009B3A', '#000000', '#FED100'],
    shapes: (W, p) => [
      { slot: 0, d: r(0, 0, W, 1) },
      { slot: 1, d: poly([0, 0], [W / 2, 0.5], [0, 1]) + poly([W, 0], [W / 2, 0.5], [W, 1]) },
      { slot: 2, d: band([0, 0], [W, 1], p.width) + band([0, 1], [W, 0], p.width) },
    ],
    anchors: (W) => [
      { id: 'hoist', label: 'Hoist', x: W * 0.15, y: 0.5, w: W * 0.16, h: 0.35 },
      { id: 'top', label: 'Top', x: W / 2, y: 0.17, w: W * 0.3, h: 0.2 },
      { id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: 0.2, h: 0.2 },
    ],
  },
  union: {
    id: 'union',
    slots: ['Field', 'Fimbriation', 'Cross'],
    params: [
      { key: 'width', label: 'Cross', min: 0.1, max: 0.34, step: 0.01, value: 0.2 },
      { key: 'saltire', label: 'Saltire', min: 0.08, max: 0.3, step: 0.01, value: 0.2 },
    ],
    colors: ['#012169', '#FFFFFF', '#C8102E'],
    shapes: (W, p) => {
      const border = p.width / 3;
      const outer = p.width + border * 2;
      const thin = p.saltire / 3;
      return [
        { slot: 0, d: r(0, 0, W, 1) },
        { slot: 1, d: band([0, 0], [W, 1], p.saltire) + band([0, 1], [W, 0], p.saltire) },
        { slot: 2, d: band([0, 0], [W, 1], thin) + band([0, 1], [W, 0], thin) },
        { slot: 1, d: r(0, (1 - outer) / 2, W, outer) + r((W - outer) / 2, 0, outer, 1) },
        { slot: 2, d: r(0, (1 - p.width) / 2, W, p.width) + r((W - p.width) / 2, 0, p.width, 1) },
      ];
    },
    anchors: (W, p) => [{ id: 'centre', label: 'Centre', x: W / 2, y: 0.5, w: p.width * 0.85, h: p.width * 0.85 }],
  },
};

export type LayoutPreset = { layout: LayoutId; params?: Record<string, number> };

/** The layout picker, in order. Variants are the same layout with classic proportions. */
export const LAYOUT_PRESETS: LayoutPreset[] = [
  { layout: 'triband-v' },
  { layout: 'triband-v', params: { middle: 0.5 } },
  { layout: 'triband-h' },
  { layout: 'triband-h', params: { middle: 0.5 } },
  { layout: 'bicolor-h' },
  { layout: 'bicolor-v' },
  { layout: 'nordic' },
  { layout: 'nordic-fimbriated' },
  { layout: 'cross' },
  { layout: 'saltire' },
  { layout: 'canton' },
  { layout: 'stripes-h' },
  { layout: 'stripes-h', params: { count: 13 } },
  { layout: 'hoist-triangle' },
  { layout: 'triband-triangle' },
  { layout: 'diagonal' },
  { layout: 'diagonal-band' },
  { layout: 'border' },
  { layout: 'quartered' },
  { layout: 'stars-stripes' },
  { layout: 'stars-stripes', params: { count: 11, width: 0.5, height: 7 / 11 } },
  { layout: 'pentaband-h' },
  { layout: 'hoist-band' },
  { layout: 'stripes-v' },
  { layout: 'disc' },
  { layout: 'disc', params: { size: 0.6, offset: 0.45 } },
  { layout: 'per-saltire' },
  { layout: 'union' },
  { layout: 'solid' },
];

export function defaultParams(layout: LayoutId, overrides?: Record<string, number>) {
  return { ...Object.fromEntries(LAYOUTS[layout].params.map((param) => [param.key, param.value])), ...overrides };
}

/** Anchors plus the flag's centre lines, which every layout snaps to. */
export function snapAnchors(layout: LayoutId | null, W: number, params: Record<string, number>) {
  const anchors = layout ? LAYOUTS[layout].anchors(W, { ...defaultParams(layout), ...params }) : [];
  return anchors.some((anchor) => anchor.id === 'centre') ? anchors : [...anchors, centre(W)];
}
