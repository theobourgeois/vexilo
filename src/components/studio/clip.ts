import type { FieldPartRef, StudioDesign, StudioField, StudioLayer } from '@/lib/studio-design';
import { divisionGeometry, divisionLabel, insidePart, resolvePart } from './divisions';
import { flagWidth, hitsLayer } from './model';

/** Divisions with more parts than this, like fine stripes, aren't offered to clip to. */
const MAX_PARTS = 16;

export const clipsBelow = (layer: StudioLayer) => layer.clip?.kind === 'below';

/**
 * The layers bottom first, in runs: a layer, then the ones above it clipped to the layer below,
 * which only show inside it. A clipped layer at the very bottom has nothing to clip to, so it
 * starts its own run.
 */
export function clipGroups(layers: StudioLayer[]) {
  const groups: StudioLayer[][] = [];
  for (const layer of layers) {
    if (clipsBelow(layer) && groups.length) groups.at(-1)!.push(layer);
    else groups.push([layer]);
  }
  return groups;
}

/** Where the layer a layer clipped to the one below shows inside is; -1 when there's none. */
export function clipBaseIndex(layers: StudioLayer[], index: number) {
  let k = index - 1;
  while (k > 0 && clipsBelow(layers[k])) k--;
  return k;
}

/** Whether a layer's clip lets a point (flag units) show. */
export function layerShownAt(design: StudioDesign, layer: StudioLayer, px: number, py: number): boolean {
  const clip = layer.clip;
  if (!clip) return true;
  const W = flagWidth(design);
  if (clip.kind === 'part') return insidePart(design.field, clip, W, px, py);
  const k = clipBaseIndex(design.layers, design.layers.indexOf(layer));
  if (k < 0) return true;
  const base = design.layers[k];
  return !base.hidden && hitsLayer(base, W, px, py) && layerShownAt(design, base, px, py);
}

export const samePart = (a: FieldPartRef | null | undefined, b: FieldPartRef | null | undefined) =>
  Boolean(a && b && a.divisionId === b.divisionId && a.part === b.part);

/** What each division is called, numbered bottom up where two would read the same. */
function divisionNames(field: StudioField) {
  if (field.kind !== 'stack') return new Map<string, string>();
  const labels = field.divisions.map(divisionLabel);
  const seen = new Map<string, number>();
  return new Map(
    field.divisions.map((division, i) => {
      const label = labels[i];
      if (labels.indexOf(label) === labels.lastIndexOf(label)) return [division.id, label];
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      return [division.id, `${label} ${n}`];
    }),
  );
}

/** What a field part is called: its name alone when its division is just that part. */
export function partLabel(design: StudioDesign, ref: FieldPartRef) {
  const target = resolvePart(design.field, ref, flagWidth(design));
  if (!target) return null;
  return target.geometry.parts.length === 1 ? target.name : `${divisionNames(design.field).get(target.division.id)} · ${target.name}`;
}

/** The field parts something can be clipped to; `below` limits them to the divisions under that index. */
export function clipTargets(design: StudioDesign, below?: number): { ref: FieldPartRef; label: string }[] {
  const field = design.field;
  if (field.kind !== 'stack') return [];
  const W = flagWidth(design);
  const names = divisionNames(field);
  return field.divisions.slice(0, below).flatMap((division) => {
    const parts = division.hidden ? [] : divisionGeometry(division, W).parts;
    if (parts.length > MAX_PARTS) return [];
    return parts.map((part, i) => ({
      ref: { divisionId: division.id, part: i },
      label: parts.length === 1 ? part.name : `${names.get(division.id)} · ${part.name}`,
    }));
  });
}
