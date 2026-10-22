import type { StudioDesign, StudioLayer, StudioRepeat } from '@/lib/studio-design';
import { membersBox, membersOf } from './groups';
import { layerWidth } from './model';
import { apply, flatten, type Pt } from './paths';
import { brushPoints, isLinear } from './shapes';
import { layerAffine, localContours } from './vector';

/** A line copies can follow, in flag units. */
export type GuideLine = { pts: Pt[]; closed: boolean };

/** Whether copies can follow a layer: any shape or brush stroke, but not text or an emblem. */
export const canGuide = (layer: StudioLayer) => Boolean(layer.shape && !layer.text);

/**
 * The line through a layer that copies follow, where it is before any repeat of its own: a
 * brush stroke's middle, a line's length, or a shape's longest outline.
 */
export function guideLine(guide: StudioLayer, W: number): GuideLine | null {
  const shape = guide.shape;
  if (!shape || guide.text) return null;
  const m = layerAffine(guide, W, { cx: guide.x * W, cy: guide.y, rot: guide.rotation });
  const [w, h] = [layerWidth(guide), guide.size];
  if (shape.kind === 'brush') return { pts: brushPoints(shape.path ?? [], w, h, shape.stroke).map((p) => apply(m, p)), closed: false };
  if (isLinear(shape.kind)) {
    const ends: Pt[] = w >= h ? [[-w / 2, 0], [w / 2, 0]] : [[0, -h / 2], [0, h / 2]];
    return { pts: ends.map((p) => apply(m, p)), closed: false };
  }
  let best: GuideLine | null = null;
  let longest = 0;
  for (const contour of localContours(guide)) {
    const pts = flatten(contour, 24).map((p) => apply(m, p));
    const length = lengthOf(pts);
    if (length > longest) [best, longest] = [{ pts, closed: contour.closed }, length];
  }
  return best;
}

function lengthOf(pts: Pt[]) {
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return length;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * Copies evenly along a line, each as its place from `centre` and the line's heading there. A
 * closed line goes all the way round from `offset` (0–1); an open one runs end to end, `offset`
 * of its length in from each end.
 */
export function trackAlong(line: GuideLine, n: number, offset: number, centre: Pt): [number, number, number][] {
  const { pts, closed } = line;
  if (pts.length === 0 || n < 1) return [];
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const length = along.at(-1)!;
  const inset = Math.min(0.49, Math.max(0, offset));
  const spots = Array.from({ length: n }, (_, i) =>
    closed
      ? ((((offset + i / n) % 1) + 1) % 1) * length
      : n === 1
        ? length / 2
        : length * (inset + ((1 - 2 * inset) * i) / (n - 1)),
  );
  let seg = 1;
  return spots
    .map((s, i) => [s, i] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([s, i]) => {
      while (seg < pts.length - 1 && along[seg] < s) seg++;
      const [a, b] = [pts[Math.max(0, seg - 1)], pts[Math.min(seg, pts.length - 1)]];
      const span = along[seg] - along[seg - 1] || 1;
      const t = Math.min(1, Math.max(0, (s - along[seg - 1]) / span));
      const heading = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      return [i, [round(a[0] + (b[0] - a[0]) * t - centre[0]), round(a[1] + (b[1] - a[1]) * t - centre[1]), round(heading)]] as const;
    })
    .sort((a, b) => a[0] - b[0])
    .map(([, spot]) => spot as [number, number, number]);
}

const sameTrack = (a: StudioRepeat['track'], b: StudioRepeat['track']) =>
  a?.length === b?.length && (a ?? []).every((p, i) => p.every((v, j) => Math.abs(v - b![i][j]) < 1e-5));

const followsPath = (repeat: StudioRepeat | null | undefined): repeat is StudioRepeat & { along: string } =>
  repeat?.mode === 'path' && Boolean(repeat.along);

/**
 * Keeps patterns repeated along a path on it. Moving a pattern on its own takes its path with
 * it; otherwise the pattern sits on its path's centre with its copies spaced along the path.
 * Layers and groups that didn't change are left as they are.
 */
export function syncTracks(prev: StudioDesign, next: StudioDesign, W: number): StudioDesign {
  const layerPatterns = next.layers.filter((l) => followsPath(l.repeat) && l.repeat!.along !== l.id);
  const groupPatterns = (next.groups ?? []).filter((g) => followsPath(g.repeat));
  if (layerPatterns.length === 0 && groupPatterns.length === 0) return next;
  let layers = next.layers;
  let groups = next.groups;
  const swap = (id: string, fn: (l: StudioLayer) => StudioLayer) => {
    layers = layers.map((l) => (l.id === id ? fn(l) : l));
  };
  const find = (list: StudioLayer[], id: string) => list.find((l) => l.id === id);

  /** Moves the guide along when only the pattern moved, then gives back where the pattern should be and its track. */
  const follow = (repeat: StudioRepeat & { along: string }, centre: Pt, before: Pt | null): { centre: Pt; track: StudioRepeat['track'] } | null => {
    let guide = find(layers, repeat.along);
    if (!guide) return null;
    const [dx, dy] = before ? [centre[0] - before[0], centre[1] - before[1]] : [0, 0];
    if (find(prev.layers, guide.id) === guide && (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9)) {
      guide = { ...guide, x: guide.x + dx / W, y: guide.y + dy };
      const moved = guide;
      swap(moved.id, () => moved);
    }
    const line = guideLine(guide, W);
    if (!line) return null;
    const at: Pt = [guide.x * W, guide.y];
    return { centre: at, track: trackAlong(line, repeat.count, repeat.spacing, at) };
  };

  for (const pattern of layerPatterns) {
    const repeat = pattern.repeat as StudioRepeat & { along: string };
    const old = find(prev.layers, pattern.id);
    const placed = follow(repeat, [pattern.x * W, pattern.y], old ? [old.x * W, old.y] : null);
    if (!placed) continue;
    const [x, y] = [placed.centre[0] / W, placed.centre[1]];
    if (Math.abs(x - pattern.x) < 1e-9 && Math.abs(y - pattern.y) < 1e-9 && sameTrack(placed.track, repeat.track)) continue;
    swap(pattern.id, (l) => ({ ...l, x, y, repeat: { ...repeat, track: placed.track } }));
  }

  for (const group of groupPatterns) {
    const repeat = group.repeat as StudioRepeat & { along: string };
    const members = membersOf(layers, group.id);
    if (members.some((m) => m.id === repeat.along)) continue;
    const box = membersBox(members, W);
    if (!box) continue;
    const oldBox = prev.groups?.some((g) => g.id === group.id) ? membersBox(membersOf(prev.layers, group.id), W) : null;
    const middle = (b: typeof box): Pt => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    const placed = follow(repeat, middle(box), oldBox && middle(oldBox));
    if (!placed) continue;
    const [dx, dy] = [placed.centre[0] - middle(box)[0], placed.centre[1] - middle(box)[1]];
    const moved = Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9;
    if (!moved && sameTrack(placed.track, repeat.track)) continue;
    if (moved) layers = layers.map((l) => (l.group === group.id ? { ...l, x: l.x + dx / W, y: l.y + dy } : l));
    groups = groups!.map((g) => (g.id === group.id ? { ...g, repeat: { ...repeat, track: placed.track } } : g));
  }

  return layers === next.layers && groups === next.groups ? next : { ...next, layers, ...(groups && { groups }) };
}
