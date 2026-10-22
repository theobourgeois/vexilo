import type { StudioDesign, StudioGroup, StudioLayer, StudioRepeat } from '@/lib/studio-design';
import { layerShownAt } from './clip';
import { hitsLayer, layerBounds, layerCopies, unionBox, type Box } from './model';

/**
 * Where one copy of a group goes: points turn by `rot` degrees about the group's centre (ox, oy),
 * which then moves to (cx, cy). A group that isn't repeated has one copy, where it is.
 */
export type Placement = { cx: number; cy: number; rot: number; ox: number; oy: number };

const IN_PLACE: Placement = { cx: 0, cy: 0, rot: 0, ox: 0, oy: 0 };
const IN_PLACE_ONLY = [IN_PLACE];

export const groupOf = (design: Pick<StudioDesign, 'groups'>, layer: Pick<StudioLayer, 'group'>) =>
  (layer.group && design.groups?.find((g) => g.id === layer.group)) || null;

export const membersOf = <L extends Pick<StudioLayer, 'group'>>(layers: L[], groupId: string) => layers.filter((l) => l.group === groupId);

/** Bounds of a group's layers where they are, before any repeat: the shown ones, or all when none are. */
export function membersBox(members: StudioLayer[], W: number): Box | null {
  if (members.length === 0) return null;
  const shown = members.filter((l) => !l.hidden);
  return unionBox((shown.length ? shown : members).map((l) => layerBounds(l, W)));
}

const placementCache = new WeakMap<StudioDesign, Map<string, Placement[]>>();

/** Every copy of a group, in the order they're drawn. */
export function groupPlacements(design: StudioDesign, groupId: string, W: number): Placement[] {
  let cache = placementCache.get(design);
  if (!cache) placementCache.set(design, (cache = new Map()));
  const cached = cache.get(groupId);
  if (cached) return cached;
  const group = design.groups?.find((g) => g.id === groupId);
  const box = group?.repeat && group.repeat.count > 1 ? membersBox(membersOf(design.layers, groupId), W) : null;
  let placements = IN_PLACE_ONLY;
  if (group?.repeat && box) {
    const [ox, oy] = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
    const h = Math.max(box.y1 - box.y0, 0.001);
    // The whole group repeats as if it were one layer its size.
    const unit = { x: ox / W, y: oy, size: h, aspect: Math.max(box.x1 - box.x0, 0.001) / h, rotation: 0, repeat: group.repeat } as StudioLayer;
    placements = layerCopies(unit, W).map((copy) => ({ cx: copy.cx, cy: copy.cy, rot: copy.rot, ox, oy }));
  }
  cache.set(groupId, placements);
  return placements;
}

/** The copies a layer is drawn at through its group: just one, in place, outside a repeated group. */
export const layerPlacements = (design: StudioDesign, layer: StudioLayer, W: number) =>
  layer.group ? groupPlacements(design, layer.group, W) : IN_PLACE_ONLY;

const isInPlace = (p: Placement) => p === IN_PLACE || (p.rot === 0 && p.cx === p.ox && p.cy === p.oy);

export function place(p: Placement, x: number, y: number): [number, number] {
  if (isInPlace(p)) return [x, y];
  const a = (p.rot * Math.PI) / 180;
  const [dx, dy] = [x - p.ox, y - p.oy];
  return [p.cx + dx * Math.cos(a) - dy * Math.sin(a), p.cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

export function unplace(p: Placement, x: number, y: number): [number, number] {
  if (isInPlace(p)) return [x, y];
  const a = (-p.rot * Math.PI) / 180;
  const [dx, dy] = [x - p.cx, y - p.cy];
  return [p.ox + dx * Math.cos(a) - dy * Math.sin(a), p.oy + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** An SVG transform drawing a layer where a copy puts it; undefined in place. */
export const placementTransform = (p: Placement) =>
  isInPlace(p) ? undefined : `translate(${p.cx} ${p.cy}) rotate(${p.rot}) translate(${-p.ox} ${-p.oy})`;

/** Axis-aligned bounds of a layer as drawn, every copy of its group included. */
export function placedBounds(design: StudioDesign, layer: StudioLayer, W: number): Box {
  const box = layerBounds(layer, W);
  const placements = layerPlacements(design, layer, W);
  if (placements === IN_PLACE_ONLY) return box;
  const corners = placements.flatMap((p) =>
    [
      [box.x0, box.y0],
      [box.x1, box.y0],
      [box.x1, box.y1],
      [box.x0, box.y1],
    ].map(([x, y]) => place(p, x, y)),
  );
  return {
    x0: Math.min(...corners.map((c) => c[0])),
    y0: Math.min(...corners.map((c) => c[1])),
    x1: Math.max(...corners.map((c) => c[0])),
    y1: Math.max(...corners.map((c) => c[1])),
  };
}

/**
 * Whether a point (flag units) is on a layer, in any copy of its group: where it shows, or
 * anywhere on it when `clipped` is false.
 */
export function layerAt(design: StudioDesign, layer: StudioLayer, W: number, px: number, py: number, reach = 0, clipped = true) {
  return layerPlacements(design, layer, W).some((p) => {
    const [lx, ly] = unplace(p, px, py);
    return hitsLayer(layer, W, lx, ly, reach) && (!clipped || layerShownAt(design, layer, px, py, lx, ly));
  });
}

/** The repeated groups in rings or arcs whose layers are all among `ids`; their radius scales with them. */
export function ringGroups(design: StudioDesign, ids: string[]): StudioGroup[] {
  return (design.groups ?? []).filter(
    (g) => (g.repeat?.mode === 'ring' || g.repeat?.mode === 'arc') && membersOf(design.layers, g.id).every((m) => m.hidden || m.locked || ids.includes(m.id)),
  );
}

/** The groups with the radius each of `from` began with, times k. */
export function scaleRings(groups: StudioGroup[] | undefined, from: StudioGroup[], k: number) {
  if (!groups || from.length === 0) return groups;
  return groups.map((g) => {
    const start = from.find((f) => f.id === g.id)?.repeat;
    return start ? { ...g, repeat: { ...start, spacing: start.spacing * k } } : g;
  });
}

/**
 * The layers bottom first in units that move through the stack together: a whole group, or a
 * layer on its own.
 */
export function stackUnits<L extends Pick<StudioLayer, 'group'>>(layers: L[]): L[][] {
  const units: L[][] = [];
  for (const layer of layers) {
    const last = units.at(-1);
    if (layer.group && last?.[0].group === layer.group) last.push(layer);
    else units.push([layer]);
  }
  return units;
}

/**
 * Keeps groups whole: their layers together in the stack, where the bottom one is, no group
 * without layers and no layer in a group that's gone. Returns the design itself when it's tidy.
 */
export function tidyGroups(design: StudioDesign): StudioDesign {
  const groups = design.groups ?? [];
  if (groups.length === 0 && !design.layers.some((l) => l.group)) return design;
  const known = new Set(groups.map((g) => g.id));
  const layers: StudioLayer[] = [];
  const placed = new Set<string>();
  for (const layer of design.layers) {
    if (!layer.group) layers.push(layer);
    else if (!known.has(layer.group)) {
      const rest = { ...layer };
      delete rest.group;
      layers.push(rest);
    } else if (!placed.has(layer.group)) {
      placed.add(layer.group);
      layers.push(...membersOf(design.layers, layer.group));
    }
  }
  const kept = groups.filter((g) => placed.has(g.id));
  const same = kept.length === groups.length && layers.every((l, i) => l === design.layers[i]);
  if (same) return design;
  const next = { ...design, layers };
  if (kept.length) next.groups = kept;
  else delete next.groups;
  return next;
}

/** The group the layers are, when they're exactly all of one group's layers. */
export function wholeGroup(design: StudioDesign, ids: string[]): StudioGroup | null {
  if (ids.length === 0) return null;
  const first = design.layers.find((l) => l.id === ids[0]);
  const group = first && groupOf(design, first);
  if (!group) return null;
  const members = membersOf(design.layers, group.id);
  return members.length === ids.length && members.every((m) => ids.includes(m.id)) ? group : null;
}

/**
 * The group the selection is inside, picking out some of its layers but not all: clicks then
 * pick its layers one by one.
 */
export function enteredGroup(design: StudioDesign, ids: string[]): string | null {
  const layers = design.layers.filter((l) => ids.includes(l.id));
  const group = layers[0]?.group;
  if (!group || layers.some((l) => l.group !== group)) return null;
  return wholeGroup(design, ids) ? null : group;
}

/** The ids with every group any of them is in filled out. */
export function withWholeGroups(design: StudioDesign, ids: string[]): string[] {
  const groups = new Set(design.layers.filter((l) => l.group && ids.includes(l.id)).map((l) => l.group));
  return design.layers.filter((l) => ids.includes(l.id) || (l.group && groups.has(l.group))).map((l) => l.id);
}

/** A repeat for a group, its spacing set so the copies sit apart. */
export function defaultGroupRepeat(mode: StudioRepeat['mode'], box: Box, facing = false): StudioRepeat {
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 1.15;
  const count = mode === 'ring' ? 8 : mode === 'arc' ? 5 : mode === 'grid' ? 4 : 3;
  const spacing =
    mode === 'ring'
      ? Math.min(0.7, Math.max(0.15, (count * span) / (2 * Math.PI)))
      : mode === 'arc'
        ? Math.min(0.7, Math.max(0.15, (span * (count - 1)) / ((150 * Math.PI) / 180)))
        : 0.25;
  return { mode, count, spacing, facing };
}
