'use client';

import type { StudioDesign, StudioGroup, StudioLayer } from '@/lib/studio-design';
import { getEmblemSvg } from '@/actions/studio-emblems';
import { colorDistance, nearest, sameColor } from './colors';
import { MAX_LAYERS, readSvg, SvgImportError, SvgTooDetailedError } from './import-svg';
import { compose, scaling } from './paths';
import { combineContours, combinedLayer, layerAffine } from './vector';

/** How far a drawing's colour can be from one in the emblem's palette and still follow its recolour. */
const PALETTE_MATCH = 30;

/**
 * An emblem drawn from an SVG as path layers, where it was: same place, size, turn, flips and
 * stretch, recoloured as it was, and clipped, hidden and repeated as it was. Several layers
 * come in a group named after it, or join the group it was in.
 */
export async function emblemShapes(layer: StudioLayer, design: StudioDesign, W: number): Promise<{ layers: StudioLayer[]; groups: StudioGroup[] }> {
  const source = await getEmblemSvg(layer.emblemId);
  if (!source) throw new SvgImportError('This emblem’s drawing couldn’t be loaded.');
  let read;
  try {
    read = await readSvg(source, {
      name: layer.name,
      W,
      // Its own proportions, then stretched as it was.
      box: { w: layer.size * layer.aspect, h: layer.size, affine: compose(layerAffine({ ...layer, repeat: null }, W), scaling(layer.stretch ?? 1, 1)) },
      // It makes way for them, and an outline needs a layer of its own.
      budget: MAX_LAYERS - design.layers.length + 1 - (layer.outline ? 1 : 0),
    });
  } catch (error) {
    throw error instanceof SvgTooDetailedError ? new SvgImportError('This emblem is too detailed to turn into shapes.') : error;
  }

  const several = read.layers.length > 1;
  if (several && layer.clip?.kind === 'below') throw new SvgImportError('Unclip it first: each of its shapes would clip to the one below.');
  // Groups don't nest, so its shapes couldn't repeat as one.
  if (several && layer.group && layer.repeat) throw new SvgImportError('Take it out of its group first, so its shapes can repeat together.');

  // Colours close to one the emblem was recoloured from follow it; the rest stay as drawn.
  const paint = (hex: string) => {
    if (layer.palette.length === 0) return hex;
    const i = layer.palette.indexOf(nearest(hex, layer.palette));
    return !sameColor(layer.colors[i], layer.palette[i]) && colorDistance(hex, layer.palette[i]) < PALETTE_MATCH ? layer.colors[i] : hex;
  };
  const group = several && !layer.group ? { ...read.group!, repeat: layer.repeat } : null;
  const groupId = several ? (group?.id ?? layer.group) : layer.group;
  // A single shape comes ungrouped; several always get the group set here.
  const shapes: StudioLayer[] = read.layers.map((part) => ({
    ...part,
    colors: part.colors.map(paint),
    repeat: several ? null : layer.repeat,
    outline: several ? null : layer.outline,
    ...(layer.clip && { clip: layer.clip }),
    ...(layer.hidden && { hidden: true }),
    ...(groupId && { group: groupId }),
  }));

  // One outline around the whole drawing, under it, as the emblem had; outlining each shape
  // would also draw lines between them.
  const filled = shapes.filter((s) => s.shape!.fill);
  if (several && layer.outline && filled.length) {
    const contours = await combineContours(filled, 'unite', W);
    if (contours.length) {
      const { color } = layer.outline;
      const base = combinedLayer({ ...filled[0], shape: { ...filled[0].shape!, stroke: 0 } }, contours, 'unite', W);
      shapes.unshift({
        ...base,
        name: 'Outline',
        palette: [color, color],
        colors: [color, color],
        outline: layer.outline,
        ...(layer.clip && { clip: layer.clip }),
        ...(layer.hidden && { hidden: true }),
        ...(groupId && { group: groupId }),
      });
    }
  }
  return { layers: shapes, groups: group ? [group] : [] };
}
