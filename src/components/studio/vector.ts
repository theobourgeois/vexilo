import type { PathContour, StudioLayer } from '@/lib/studio-design';
import { layerCopies, layerWidth, uid, type Copy } from './model';
import { applyVector, compose, fitContours, makeNode, mapContours, rotation, scaling, translate, type Affine } from './paths';
import { shapeContours } from './shapes';

const MIN_SIDE = 0.002;

/**
 * Whether a layer's outline can be edited point by point: any shape but a brush stroke. Text has
 * to be turned into a path first, as editing its letters would lose the text.
 */
export const canEditPoints = (layer: StudioLayer) => Boolean(layer.shape && layer.shape.kind !== 'brush' && !layer.text);

/** Whether a layer is an outline that can be combined with others: any shape or text but a brush stroke. */
export const isOutline = (layer: StudioLayer) => Boolean(layer.shape && layer.shape.kind !== 'brush');

/** From a layer's own box (centred, before turning and flipping) to flag units, for one copy. */
export function layerAffine(layer: StudioLayer, W: number, copy: Copy = layerCopies(layer, W)[0]): Affine {
  return compose(translate(copy.cx, copy.cy), rotation(copy.rot), scaling(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1));
}

/** A shape layer's outline in its own box. */
export const localContours = (layer: StudioLayer) => shapeContours(layer.shape!, layerWidth(layer), layer.size);

/**
 * Gives a shape layer new outlines, in its own box, as a path. The box is refitted around them
 * and moved so that what didn't change stays put.
 */
export function withContours(layer: StudioLayer, contours: PathContour[], W: number): StudioLayer {
  const shape = layer.shape!;
  const fit = fitContours(contours);
  const w = Math.max(MIN_SIDE, fit.w + shape.stroke);
  const h = Math.max(MIN_SIDE, fit.h + shape.stroke);
  const [dx, dy] = applyVector(layerAffine(layer, W), [fit.cx, fit.cy]);
  return {
    ...layer,
    x: layer.x + dx / W,
    y: layer.y + dy,
    size: h,
    aspect: w / h,
    stretch: undefined,
    text: undefined,
    shape: { kind: 'path', fill: shape.fill, stroke: shape.stroke, contours: fit.contours, ...(shape.nonzero && { nonzero: true }) },
  };
}

/** The same shape, as a path whose points can be moved; text becomes its letters' outlines. */
export const toPath = (layer: StudioLayer, W: number) =>
  layer.text ? { ...layer, text: undefined } : layer.shape?.kind === 'path' ? layer : withContours(layer, localContours(layer), W);

/** Every copy of a shape layer's outline, in flag units. */
export function worldContours(layer: StudioLayer, W: number): PathContour[] {
  const local = localContours(layer);
  return layerCopies(layer, W).flatMap((copy) => mapContours(local, layerAffine(layer, W, copy)));
}

export type BooleanOp = 'unite' | 'subtract' | 'intersect' | 'exclude';

export const BOOLEAN_LABELS: Record<BooleanOp, string> = {
  unite: 'Merge',
  subtract: 'Subtract',
  intersect: 'Intersect',
  exclude: 'Exclude',
};

// Paper.js does the curve maths; it loads the first time shapes are combined.
export type Paper = typeof import('paper/dist/paper-core');
let paperScope: Promise<Paper> | null = null;
export function loadPaper() {
  paperScope ??= import('paper/dist/paper-core').then((m) => {
    const paper = (m as unknown as { default?: Paper }).default ?? m;
    paper.setup(new paper.Size(1, 1));
    paper.settings.insertItems = false;
    return paper;
  });
  return paperScope;
}

/** Paper works in pixel-sized numbers; flag units are too small for its tolerances. */
const SCALE = 1000;

/**
 * Combines shapes, bottom first: merge joins them, subtract cuts the rest out of the bottom one,
 * intersect keeps where they all overlap, and exclude keeps where an odd number do. Returns
 * contours in flag units, empty when nothing is left.
 */
export async function combineContours(layers: StudioLayer[], op: BooleanOp, W: number): Promise<PathContour[]> {
  const paper = await loadPaper();
  const toPaper = (contours: PathContour[], nonzero?: boolean) => {
    const item = new paper.CompoundPath({
      children: contours.map(
        (c) =>
          new paper.Path({
            segments: c.nodes.map(
              (n) =>
                new paper.Segment(
                  new paper.Point(n.x * SCALE, n.y * SCALE),
                  n.in ? new paper.Point(n.in[0] * SCALE, n.in[1] * SCALE) : undefined,
                  n.out ? new paper.Point(n.out[0] * SCALE, n.out[1] * SCALE) : undefined,
                ),
            ),
            // Paper only does booleans on closed outlines.
            closed: true,
          }),
      ),
    });
    item.fillRule = nonzero ? 'nonzero' : 'evenodd';
    return item;
  };
  // Paper resolves each one by its own fill rule first, so overlapping letters count once.
  const items = layers.map((l) => toPaper(worldContours(l, W), l.shape?.nonzero));
  let result: paper.PathItem = items[0];
  if (op === 'subtract') {
    const cutter = items.slice(2).reduce<paper.PathItem>((a, b) => a.unite(b), items[1]);
    result = result.subtract(cutter);
  } else {
    for (const item of items.slice(1)) result = result[op](item);
  }
  const paths = result instanceof paper.CompoundPath ? (result.children as paper.Path[]) : [result as paper.Path];
  const point = (p: paper.Point) => [p.x / SCALE, p.y / SCALE] as [number, number];
  return paths
    .filter((path) => path.segments.length > 1)
    .map((path) => ({
      closed: path.closed,
      nodes: path.segments.map((s) => makeNode(point(s.point), point(s.handleIn), point(s.handleOut))),
    }));
}

/** A path layer for combined shapes, painted like the bottom one. */
export function combinedLayer(base: StudioLayer, contours: PathContour[], op: BooleanOp, W: number): StudioLayer {
  const stroke = base.shape!.stroke;
  const fit = fitContours(contours);
  const w = Math.max(MIN_SIDE, fit.w + stroke);
  const h = Math.max(MIN_SIDE, fit.h + stroke);
  const fill = base.shape!.fill || stroke === 0;
  return {
    id: uid(),
    emblemId: 'shape',
    name: op === 'unite' ? 'Merged shape' : `${BOOLEAN_LABELS[op]}ed shape`,
    src: '',
    shape: { kind: 'path', fill, stroke, contours: fit.contours },
    aspect: w / h,
    palette: [...base.colors],
    colors: [...base.colors],
    x: fit.cx / W,
    y: fit.cy,
    size: h,
    rotation: 0,
    flipX: false,
    flipY: false,
    outline: base.outline,
    repeat: null,
  };
}
