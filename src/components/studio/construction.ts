import type { StudioDesign, StudioDivision, StudioLayer } from '@/lib/studio-design';
import { divisionFrame, divisionGeometry, divisionParams, sideFrame } from './divisions';
import { layerPlacements, membersBox, membersOf, place, type Placement } from './groups';
import { flagWidth, layerCopies, layerWidth } from './model';
import { radialCircle } from './shapes';

/**
 * What a construction sheet measures, in flag units (the flag is W wide, 1 tall): where the
 * field's lines and the emblems' centres fall across and down, lengths measured where they are
 * (a band's width, a disc's diameter, an emblem's height), and dashed guides to read them by.
 */

export type Pt = [number, number];
export type Dim = { a: Pt; b: Pt };
export type Guide = { kind: 'line'; a: Pt; b: Pt } | { kind: 'circle'; c: Pt; r: number };
export type Construction = {
  W: number;
  /** Stops along the top and down the hoist, 0 and the flag's edge included; empty when there are none. */
  field: { xs: number[]; ys: number[] };
  emblems: { xs: number[]; ys: number[] };
  dims: Dim[];
  guides: Guide[];
  centres: Pt[];
};

/** More stops than this in one chain can't be read. */
const MAX_STOPS = 32;
/** How far a size runs beside what it measures. */
const GAP = 0.025;

const DEG = Math.PI / 180;
const EPS = 1e-4;

function stops(values: number[], end: number) {
  const sorted = [0, end, ...values.filter((v) => v > -EPS && v < end + EPS)].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (!out.length || v - out[out.length - 1] > EPS * 10) out.push(Math.min(end, Math.max(0, v)));
  return out.length > 2 && out.length <= MAX_STOPS ? out : [];
}

const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];
const rotate = ([x, y]: Pt, degrees: number): Pt => {
  const a = degrees * DEG;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

export function construction(design: StudioDesign, show: { field: boolean; emblems: boolean }): Construction {
  const W = flagWidth(design);
  const field = { xs: [] as number[], ys: [] as number[] };
  const emblems = { xs: [] as number[], ys: [] as number[] };
  const dims: Dim[] = [];
  const guides: Guide[] = [];
  const centres: Pt[] = [];

  if (show.field && design.field.kind === 'stack') {
    for (const division of design.field.divisions) {
      if (division.hidden) continue;
      measureDivision(division, W, { xs: field.xs, ys: field.ys, dims, guides, centres });
    }
  }

  if (show.emblems) {
    const seen = new Set<string>();
    for (const layer of design.layers) {
      if (layer.hidden) continue;
      // A group is measured as one thing.
      if (layer.group) {
        if (seen.has(layer.group)) continue;
        seen.add(layer.group);
        const box = membersBox(membersOf(design.layers, layer.group), W);
        if (!box) continue;
        const centre: Pt = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
        const at = layerPlacements(design, layer, W).map((p) => place(p, ...centre));
        for (const [x, y] of at) {
          emblems.xs.push(x);
          emblems.ys.push(y);
          centres.push([x, y]);
        }
        dims.push(height(centre, box.x1 - box.x0, box.y1 - box.y0, 0, layerPlacements(design, layer, W)[0]));
        continue;
      }
      measureLayer(layer, W, layerPlacements(design, layer, W), { xs: emblems.xs, ys: emblems.ys, dims, guides, centres });
    }
  }

  return {
    W,
    field: { xs: stops(field.xs, W), ys: stops(field.ys, 1) },
    emblems: { xs: stops(emblems.xs, W), ys: stops(emblems.ys, 1) },
    dims,
    guides,
    centres,
  };
}

type Sink = { xs: number[]; ys: number[]; dims: Dim[]; guides: Guide[]; centres: Pt[] };

/** A height measured up the right of something w × h at c, turned with it and placed as its group is. */
function height(c: Pt, w: number, h: number, rotation: number, p: Placement): Dim {
  const end = (dy: number) => place(p, ...add(c, rotate([w / 2 + GAP, dy], rotation)));
  return { a: end(-h / 2), b: end(h / 2) };
}

function measureLayer(layer: StudioLayer, W: number, placements: Placement[], out: Sink) {
  const w = layerWidth(layer);
  const h = layer.size;
  const circle = layer.shape && Math.abs((layer.stretch ?? 1) - 1) < 1e-6 ? radialCircle(layer.shape, w, h) : null;
  const round = circle && Math.abs(circle.rx - circle.ry) < 1e-3 * circle.ry ? circle : null;
  const copies = layerCopies(layer, W);
  copies.forEach((copy, i) => {
    // A star is set out from the centre of the circle its points lie on.
    const offset: Pt = round ? rotate([round.cx * (layer.flipX ? -1 : 1), round.cy * (layer.flipY ? -1 : 1)], copy.rot) : [0, 0];
    const centre = add([copy.cx, copy.cy], offset);
    placements.forEach((p, j) => {
      const at = place(p, ...centre);
      out.xs.push(at[0]);
      out.ys.push(at[1]);
      out.centres.push(at);
      // Its size once: on the first copy.
      if (i || j) return;
      if (round) {
        out.guides.push({ kind: 'circle', c: at, r: round.ry });
        const side = place(p, ...add(centre, [round.ry + GAP, 0]));
        out.dims.push({ a: [side[0], side[1] - round.ry], b: [side[0], side[1] + round.ry] });
      } else {
        out.dims.push(height([copy.cx, copy.cy], w, h, copy.rot, p));
      }
    });
  });
}

function measureDivision(division: StudioDivision, W: number, out: Sink) {
  // Lines along the flag's axes, wherever the division has them; edging would bend them.
  const geometry = divisionGeometry({ ...division, edge: null }, W);
  out.xs.push(...geometry.xs);
  out.ys.push(...geometry.ys);

  const clip = divisionFrame(division, W);
  const lw = clip.w / clip.h;
  const p = divisionParams(division);
  const F = ([u, v]: Pt): Pt => [clip.x + u * clip.h, clip.y + v * clip.h];
  const at = (pt: Pt) => {
    const [x, y] = F(pt);
    out.xs.push(x);
    out.ys.push(y);
    return [x, y] as Pt;
  };
  const line = (a: Pt, b: Pt) => out.guides.push({ kind: 'line', a: F(a), b: F(b) });
  const dim = (a: Pt, b: Pt) => out.dims.push({ a: F(a), b: F(b) });
  /** A band's width, across it at c: angle in radians. */
  const across = (c: Pt, angle: number, width: number) => {
    const n: Pt = [-Math.sin(angle), Math.cos(angle)];
    dim(add(c, n, -width / 2), add(c, n, width / 2));
  };
  /** The line through c at an angle, as far as the frame. */
  const through = (c: Pt, angle: number) => {
    const d: Pt = [Math.cos(angle), Math.sin(angle)];
    const ts = [
      ...(Math.abs(d[0]) > 1e-9 ? [-c[0] / d[0], (lw - c[0]) / d[0]] : []),
      ...(Math.abs(d[1]) > 1e-9 ? [-c[1] / d[1], (1 - c[1]) / d[1]] : []),
    ];
    const inside = ts.filter((t) => {
      const [x, y] = add(c, d, t);
      return x > -1e-6 && x < lw + 1e-6 && y > -1e-6 && y < 1 + 1e-6;
    });
    if (inside.length >= 2) line(add(c, d, Math.min(...inside)), add(c, d, Math.max(...inside)));
  };

  switch (division.kind) {
    case 'band': {
      const c: Pt = [p.x * lw, p.y];
      // Square to the flag, its edges are already measured.
      if (Math.abs(p.angle % 90) < 1e-6) break;
      at(c);
      through(c, p.angle * DEG);
      across(c, p.angle * DEG, p.width);
      break;
    }
    case 'bend': {
      const angle = Math.atan2(p.flip ? 1 : -1, lw);
      line(p.flip ? [0, 0] : [0, 1], p.flip ? [lw, 1] : [lw, 0]);
      // A quarter of the way along, clear of the centre.
      const len = Math.hypot(lw, 1);
      across(add([lw / 2, 0.5], [Math.cos(angle), Math.sin(angle)], len / 4), angle, p.width);
      break;
    }
    case 'saltire': {
      line([0, 0], [lw, 1]);
      line([0, 1], [lw, 0]);
      const angle = Math.atan2(0.5, lw / 2);
      across([lw / 4, 0.25], angle, p.width);
      break;
    }
    case 'pall': {
      at([p.x * lw, 0.5]);
      if (p.inset > 0) {
        at([0, p.inset]);
        at([0, 1 - p.inset]);
      }
      line([p.x * lw, 0.5], [0, p.inset]);
      line([p.x * lw, 0.5], [0, 1 - p.inset]);
      line([p.x * lw, 0.5], [lw, 0.5]);
      const u = (p.x * lw + lw) / 2;
      dim([u, 0.5 - p.width / 2], [u, 0.5 + p.width / 2]);
      break;
    }
    case 'triangle':
    case 'chevron': {
      const { E, L, map } = sideFrame(lw, p.side);
      const depth = Math.max(0.001, p.depth * E);
      at(map([depth, L / 2]));
      if (division.kind === 'triangle') {
        if (p.base < 1) {
          at(map([0, (L * (1 - p.base)) / 2]));
          at(map([0, (L * (1 + p.base)) / 2]));
        }
        line(map([0, (L * (1 - p.base)) / 2]), map([depth, L / 2]));
        line(map([0, (L * (1 + p.base)) / 2]), map([depth, L / 2]));
        break;
      }
      // The chevron's inner point, and its width square across the upper arm.
      const t = (p.width * Math.hypot(depth, L / 2)) / (L / 2);
      if (depth - t > 0) at(map([depth - t, L / 2]));
      const len = Math.hypot(depth, L / 2);
      const d: Pt = [depth / len, L / 2 / len];
      const m: Pt = [depth / 2, L / 4];
      dim(map(m), map(add(m, [-d[1], d[0]], p.width)));
      break;
    }
    case 'disc': {
      const c = at([p.x * lw, p.y]);
      out.centres.push(c);
      dim([p.x * lw - p.size / 2, p.y], [p.x * lw + p.size / 2, p.y]);
      break;
    }
    case 'rays':
      out.centres.push(at([p.x * lw, p.y]));
      break;
    case 'per-bend': {
      const k = Math.round(p.corner) & 3;
      line(k === 0 || k === 2 ? [0, 1] : [0, 0], k === 0 || k === 2 ? [lw, 0] : [lw, 1]);
      break;
    }
    case 'per-saltire':
      line([0, 0], [lw, 1]);
      line([0, 1], [lw, 0]);
      break;
    default:
      break;
  }
}

/** Every length the sheet labels, in flag units. */
export function lengths(c: Construction) {
  const steps = (s: number[]) => s.slice(1).map((v, i) => v - s[i]);
  return [
    c.W,
    1,
    ...steps(c.field.xs),
    ...steps(c.field.ys),
    ...steps(c.emblems.xs),
    ...steps(c.emblems.ys),
    ...c.dims.map((d) => Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1])),
  ];
}

/**
 * How many units the hoist is split into so every length comes out whole, as few as can be; or,
 * when nothing small enough does, a unit count that at least makes the flag's sides whole.
 */
export function autoUnits(design: StudioDesign, c: Construction): { units: number; whole: boolean } {
  const all = lengths(c);
  // Near enough that the sheet prints it whole.
  const fits = (n: number) => all.every((v) => Math.abs(v * n - Math.round(v * n)) < 0.005);
  for (let n = 1; n <= 120; n++) if (fits(n)) return { units: n, whole: true };
  // Sides whole, the hoist about 20.
  const W = c.W;
  let base = 1;
  while (base < 120 && Math.abs(W * base - Math.round(W * base)) > 1e-6) base++;
  if (base >= 120) base = design.ratio[0];
  return { units: Math.max(base, base * Math.round(20 / base)), whole: false };
}
