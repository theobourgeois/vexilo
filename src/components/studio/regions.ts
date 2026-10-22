import type { StudioDesign, StudioLayer } from '@/lib/studio-design';
import { divisionGeometry, fieldAnchors, fieldPartAt } from './divisions';
import { flagWidth, layerBounds, unionBox, type Box } from './model';

/** A part of the field an emblem can sit in, like a canton, a band or a quarter. */
export type Region = Box & { label: string };

export type FieldGuides = {
  /** The whole flag, then every region, largest first. */
  regions: Region[];
  /** Lines in the field's own drawing (band and arm edges), plus the flag's edges. */
  xs: number[];
  ys: number[];
  /** The region a point sits in: its stretch of one colour, or the flag. */
  containerAt: (u: number, v: number) => Region;
};

const EPS = 1e-4;
/** Part names too general to call a region by. */
const GENERIC = /^(Field|Fimbriation|Half|Stripe \d+|Ray \d+)$/;

function uniqueSorted(values: number[]) {
  return [...values].sort((a, b) => a - b).filter((value, i, all) => i === 0 || value - all[i - 1] > EPS);
}

const cache = new Map<string, FieldGuides>();

/**
 * Splits the field along the edges of its straight shapes into cells, then grows each cell
 * over neighbours showing the same part, so a canton reads as canton + fly, a cross as four
 * quarters and two arms. Diagonal divisions add no lines of their own.
 */
export function fieldGuides(design: StudioDesign): FieldGuides {
  const W = flagWidth(design);
  const field = design.field;
  const key = JSON.stringify([
    W,
    field.kind === 'stack' ? field.divisions.filter((d) => !d.hidden).map((d) => [d.kind, d.params, d.box, d.edge, d.fimbriation?.width]) : 'image',
  ]);
  const cached = cache.get(key);
  if (cached) return cached;

  const flag: Region = { x0: 0, y0: 0, x1: W, y1: 1, label: 'Flag' };
  let xs = [0, W];
  let ys = [0, 1];
  const containers: Region[][] = [];
  const regions: Region[] = [];

  if (field.kind === 'stack') {
    for (const division of field.divisions) {
      if (division.hidden) continue;
      const geometry = divisionGeometry(division, W);
      xs.push(...geometry.xs.map((x) => Math.min(Math.max(x, 0), W)));
      ys.push(...geometry.ys.map((y) => Math.min(Math.max(y, 0), 1)));
    }
    xs = uniqueSorted(xs);
    ys = uniqueSorted(ys);

    const cols = xs.length - 1;
    const rows = ys.length - 1;
    const parts = Array.from({ length: cols }, (_, i) =>
      Array.from({ length: rows }, (_, j) => fieldPartAt(design, (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2)),
    );
    const slot = parts.map((column) => column.map((part) => (part ? `${part.divisionId ?? 'base'}|${part.part}|${part.target}` : '')));
    const anchors = fieldAnchors(design);

    const name = (box: Box, i: number, j: number) => {
      const cx = (box.x0 + box.x1) / 2;
      const cy = (box.y0 + box.y1) / 2;
      // An anchor names the region it sits well inside and roughly fills (not a whole cross arm).
      const area = (box.x1 - box.x0) * (box.y1 - box.y0);
      const anchor = anchors
        .filter((a) => a.x > box.x0 + EPS && a.x < box.x1 - EPS && a.y > box.y0 + EPS && a.y < box.y1 - EPS && area <= a.w * a.h * 2.5)
        .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
      if (anchor) return anchor.label;
      const partName = parts[i][j]?.name;
      if (partName && !GENERIC.test(partName)) return partName;
      const fullWidth = box.x1 - box.x0 > W - EPS;
      const fullHeight = box.y1 - box.y0 > 1 - EPS;
      const across = fullWidth ? '' : cx < W * 0.4 ? 'hoist' : cx > W * 0.6 ? 'fly' : '';
      const down = fullHeight ? '' : cy < 0.4 ? 'upper' : cy > 0.6 ? 'lower' : '';
      const words = [down, across].filter(Boolean).join(' ');
      return words ? words[0].toUpperCase() + words.slice(1) : fullWidth ? 'Stripe' : 'Band';
    };

    // Grows a cell over same-coloured neighbours, one direction first.
    const grow = (i: number, j: number, verticalFirst: boolean) => {
      let [i0, i1, j0, j1] = [i, i, j, j];
      const same = (a0: number, a1: number, b0: number, b1: number) => {
        for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) if (slot[a][b] !== slot[i][j]) return false;
        return true;
      };
      const vertical = () => {
        while (j0 > 0 && same(i0, i1, j0 - 1, j0 - 1)) j0--;
        while (j1 < rows - 1 && same(i0, i1, j1 + 1, j1 + 1)) j1++;
      };
      const horizontal = () => {
        while (i0 > 0 && same(i0 - 1, i0 - 1, j0, j1)) i0--;
        while (i1 < cols - 1 && same(i1 + 1, i1 + 1, j0, j1)) i1++;
      };
      const order = verticalFirst ? [vertical, horizontal] : [horizontal, vertical];
      for (const step of order) step();
      return { x0: xs[i0], x1: xs[i1 + 1], y0: ys[j0], y1: ys[j1 + 1] };
    };

    for (let i = 0; i < cols; i++) {
      containers.push([]);
      for (let j = 0; j < rows; j++) {
        const cell = { x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1] };
        const a = grow(i, j, true);
        const b = grow(i, j, false);
        // Where growing could go two ways (the middle of a cross), the cell itself is the region.
        const box = a.x0 === b.x0 && a.x1 === b.x1 && a.y0 === b.y0 && a.y1 === b.y1 ? a : cell;
        const whole = box.x1 - box.x0 > W - EPS && box.y1 - box.y0 > 1 - EPS;
        let region = whole ? flag : regions.find((r) => r.x0 === box.x0 && r.x1 === box.x1 && r.y0 === box.y0 && r.y1 === box.y1);
        if (!region) {
          region = { ...box, label: name(box, i, j) };
          regions.push(region);
        }
        containers[i].push(region);
      }
    }
  }

  const containerAt = (u: number, v: number) => {
    const i = xs.findIndex((x, k) => k < xs.length - 1 && u >= x && u <= xs[k + 1]);
    const j = ys.findIndex((y, k) => k < ys.length - 1 && v >= y && v <= ys[k + 1]);
    return containers[i]?.[j] ?? flag;
  };
  const guides: FieldGuides = {
    regions: [flag, ...regions.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))],
    xs,
    ys,
    containerAt,
  };
  if (cache.size > 40) cache.clear();
  cache.set(key, guides);
  return guides;
}

/** What a selection can be lined up against: itself (several emblems), the region it's in, or the flag. */
export type AlignScope = { id: 'selection' | 'region' | 'flag'; label: string; box: Box | null };

export function alignScopes(design: StudioDesign, layers: StudioLayer[]): AlignScope[] {
  const guides = fieldGuides(design);
  const flag = guides.regions[0];
  const group = layers.length ? unionBox(layers.map((l) => layerBounds(l, flagWidth(design)))) : null;
  const region = group ? guides.containerAt((group.x0 + group.x1) / 2, (group.y0 + group.y1) / 2) : flag;
  return [
    ...(layers.length > 1 ? [{ id: 'selection' as const, label: 'Selection', box: null }] : []),
    ...(region !== flag ? [{ id: 'region' as const, label: region.label, box: region }] : []),
    { id: 'flag' as const, label: 'Flag', box: flag },
  ];
}
