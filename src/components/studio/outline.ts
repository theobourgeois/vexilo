import type { FlagOutline, FlagOutlineKind, PathContour, StudioDesign } from '@/lib/studio-design';
import { flagWidth } from './model';
import { contoursD, hitsContours, makeNode, mapContours, scaling, type Pt } from './paths';

export type OutlineParam = { key: string; label: string; min: number; max: number; step: number; value: number };

type OutlineDef = {
  label: string;
  params: OutlineParam[];
  /** The ratio it's usually flown at, picked along with it. */
  ratio?: [number, number];
};

export const OUTLINES: Record<FlagOutlineKind, OutlineDef> = {
  rect: { label: 'Rectangle', params: [] },
  rounded: { label: 'Rounded', params: [{ key: 'radius', label: 'Corners', min: 0.02, max: 0.5, step: 0.01, value: 0.12 }] },
  swallowtail: { label: 'Swallowtail', params: [{ key: 'depth', label: 'Cut depth', min: 0.05, max: 0.7, step: 0.01, value: 0.25 }] },
  tongued: {
    label: 'Tongued',
    params: [
      { key: 'depth', label: 'Cut depth', min: 0.05, max: 0.7, step: 0.01, value: 0.25 },
      { key: 'tongue', label: 'Tongue', min: 0.04, max: 0.8, step: 0.01, value: 0.2 },
    ],
  },
  pennant: { label: 'Pennant', params: [{ key: 'tip', label: 'Tip', min: 0, max: 0.9, step: 0.01, value: 0 }], ratio: [1, 2] },
  burgee: {
    label: 'Burgee',
    params: [
      { key: 'tips', label: 'Tips', min: 0.1, max: 1, step: 0.01, value: 0.6 },
      { key: 'depth', label: 'Cut depth', min: 0.05, max: 0.7, step: 0.01, value: 0.3 },
    ],
    ratio: [8, 13],
  },
  // Its construction: a step where the upper pennant ends at 1 − 3/(4√2) of the height.
  nepal: { label: 'Nepal', params: [], ratio: [4, 3] },
  custom: { label: 'Custom', params: [] },
};

/** The kinds offered to pick from; a custom outline comes from a path. */
export const OUTLINE_KINDS = (Object.keys(OUTLINES) as FlagOutlineKind[]).filter((kind) => kind !== 'custom');

export function outlineParams(outline: FlagOutline): Record<string, number> {
  return Object.fromEntries(OUTLINES[outline.kind].params.map((p) => [p.key, outline.params[p.key] ?? p.value]));
}

export function newOutline(kind: FlagOutlineKind, from?: FlagOutline | null): FlagOutline {
  return { kind, params: outlineParams({ kind, params: from?.params ?? {} }), trim: from?.trim ?? null };
}

const polygon = (points: Pt[]): PathContour[] => [{ nodes: points.map(([x, y]) => ({ x, y })), closed: true }];

/** The outline, in flag units (W wide, 1 tall). */
export function outlineContours(outline: FlagOutline | null | undefined, W: number): PathContour[] {
  const p = outline ? outlineParams(outline) : {};
  switch (outline?.kind ?? 'rect') {
    case 'rounded': {
      const r = Math.min(p.radius, W / 2, 0.5);
      const k = r * 0.5523;
      return [
        {
          closed: true,
          nodes: [
            makeNode([r, 0], [-k, 0]),
            makeNode([W - r, 0], undefined, [k, 0]),
            makeNode([W, r], [0, -k]),
            makeNode([W, 1 - r], undefined, [0, k]),
            makeNode([W - r, 1], [k, 0]),
            makeNode([r, 1], undefined, [-k, 0]),
            makeNode([0, 1 - r], [0, k]),
            makeNode([0, r], undefined, [0, -k]),
          ],
        },
      ];
    }
    case 'swallowtail':
      return polygon([[0, 0], [W, 0], [W * (1 - p.depth), 0.5], [W, 1], [0, 1]]);
    case 'tongued': {
      const [x, t] = [W * (1 - p.depth), p.tongue / 2];
      return polygon([[0, 0], [W, 0], [x, 0.5 - t], [W, 0.5 - t], [W, 0.5 + t], [x, 0.5 + t], [W, 1], [0, 1]]);
    }
    case 'pennant':
      return polygon(p.tip > 0 ? [[0, 0], [W, 0.5 - p.tip / 2], [W, 0.5 + p.tip / 2], [0, 1]] : [[0, 0], [W, 0.5], [0, 1]]);
    case 'burgee':
      return polygon([[0, 0], [W, 0.5 - p.tips / 2], [W * (1 - p.depth), 0.5], [W, 0.5 + p.tips / 2], [0, 1]]);
    case 'nepal': {
      const step = 1 - 3 / (4 * Math.SQRT2);
      return polygon([[0, 0], [W, step], [W * (1 - Math.SQRT1_2), step], [W, 1], [0, 1]]);
    }
    case 'custom':
      return mapContours(outline?.contours ?? [], scaling(W, 1));
    default:
      return polygon([[0, 0], [W, 0], [W, 1], [0, 1]]);
  }
}

/** Whether the flag is a plain rectangle, with nothing cut away or trimmed. */
export const isPlainRect = (outline: FlagOutline | null | undefined) => !outline || (outline.kind === 'rect' && !outline.trim?.width);

export const outlineD = (outline: FlagOutline | null | undefined, W: number) => contoursD(outlineContours(outline, W));

/** Whether a point (flag units) is on the flag, inside its outline. */
export function insideOutline(design: Pick<StudioDesign, 'ratio' | 'outline'>, u: number, v: number) {
  const W = flagWidth(design);
  if (u < 0 || u > W || v < 0 || v > 1) return false;
  const kind = design.outline?.kind ?? 'rect';
  return kind === 'rect' || hitsContours(outlineContours(design.outline, W), [u, v], { fill: true, reach: 0 });
}
