import type { StudioDesign, StudioLayer } from '@/lib/studio-design';
import { layerPlacements, placedBounds } from './groups';
import { clamp, layerCopies, layerWidth, scaleRepeat, unionBox, type Box } from './model';

/** The box the transform handles sit on, in flag units: centre, size and rotation (degrees). */
export type Frame = { cx: number; cy: number; w: number; h: number; rotation: number };

/** Handles as signs along the frame's own axes: four corners, then the top, right, bottom and left edges. */
export const HANDLES: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const rad = (degrees: number) => (degrees * Math.PI) / 180;
export const normAngle = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

/**
 * One emblem turns with its own box; several (or a repeated one, or one in a repeated group)
 * share the box around them all.
 */
export function selectionFrame(design: StudioDesign, layers: StudioLayer[], W: number): Frame | null {
  if (layers.length === 0) return null;
  const [only] = layers;
  if (layers.length === 1 && layerCopies(only, W).length === 1 && layerPlacements(design, only, W).length === 1) {
    return { cx: only.x * W, cy: only.y, w: layerWidth(only), h: only.size, rotation: only.rotation };
  }
  const box = unionBox(layers.map((l) => placedBounds(design, l, W)));
  return { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, w: box.x1 - box.x0, h: box.y1 - box.y0, rotation: 0 };
}

export function toLocal(frame: Frame, [u, v]: [number, number]): [number, number] {
  const a = rad(-frame.rotation);
  const [dx, dy] = [u - frame.cx, v - frame.cy];
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

export function fromLocal(frame: Frame, [x, y]: [number, number]): [number, number] {
  const a = rad(frame.rotation);
  return [frame.cx + x * Math.cos(a) - y * Math.sin(a), frame.cy + x * Math.sin(a) + y * Math.cos(a)];
}

export const handlePoint = (frame: Frame, [sx, sy]: [number, number]) => fromLocal(frame, [(sx * frame.w) / 2, (sy * frame.h) / 2]);

/** Whether the frame lines up with the flag, so its edges can snap to straight guides. */
export const upright = (frame: Frame) => Math.abs(normAngle(frame.rotation)) < 0.01;

export type LayerPose = Pick<StudioLayer, 'id' | 'x' | 'y' | 'size' | 'stretch' | 'aspect' | 'rotation' | 'repeat' | 'shape'>;

export const poseOf = (layer: StudioLayer): LayerPose => ({
  id: layer.id,
  x: layer.x,
  y: layer.y,
  size: layer.size,
  stretch: layer.stretch,
  aspect: layer.aspect,
  rotation: layer.rotation,
  repeat: layer.repeat,
  shape: layer.shape,
});

const MIN_SIZE = 0.012;

/**
 * Scales layers by fx, fy along the frame's axes, about a point given in frame coordinates.
 * Each emblem is stretched along its own axes by however much those axes grow.
 */
export function scalePoses(poses: LayerPose[], frame: Frame, about: [number, number], fx: number, fy: number, W: number) {
  return poses.map((pose) => {
    const q = toLocal(frame, [pose.x * W, pose.y]);
    const [u, v] = fromLocal(frame, [about[0] + fx * (q[0] - about[0]), about[1] + fy * (q[1] - about[1])]);
    const theta = rad(pose.rotation - frame.rotation);
    const [c, s] = [Math.cos(theta), Math.sin(theta)];
    const height = clamp(pose.size * Math.hypot(fx * s, fy * c), MIN_SIZE, 3);
    const width = Math.max(MIN_SIZE, layerWidth(pose) * Math.hypot(fx * c, fy * s));
    const stretch = width / (height * pose.aspect);
    const repeat = scaleRepeat(pose.repeat, Math.sqrt(fx * fy));
    // A stroke grows with the shape, but a stretch along one side alone leaves it be.
    const shape = pose.shape?.stroke ? { ...pose.shape, stroke: pose.shape.stroke * Math.min(height / pose.size, width / layerWidth(pose)) } : pose.shape;
    return { ...pose, x: u / W, y: v, size: height, stretch: Math.abs(stretch - 1) < 1e-3 ? undefined : stretch, repeat, shape };
  });
}

/** Turns layers about a point (flag units), each emblem turning with them. */
export function rotatePoses(poses: LayerPose[], centre: [number, number], degrees: number, W: number) {
  const a = rad(degrees);
  return poses.map((pose) => {
    const [dx, dy] = [pose.x * W - centre[0], pose.y - centre[1]];
    return {
      ...pose,
      x: (centre[0] + dx * Math.cos(a) - dy * Math.sin(a)) / W,
      y: centre[1] + dx * Math.sin(a) + dy * Math.cos(a),
      rotation: normAngle(pose.rotation + degrees),
    };
  });
}

/** Writes changed poses back onto the layers they came from. */
export function applyPoses(layers: StudioLayer[], poses: LayerPose[]): StudioLayer[] {
  const byId = new Map(poses.map((pose) => [pose.id, pose]));
  return layers.map((layer) => {
    const pose = byId.get(layer.id);
    if (!pose) return layer;
    const next = { ...layer, ...pose };
    if (next.stretch === undefined) delete next.stretch;
    if (next.shape === undefined) delete next.shape;
    return next;
  });
}

export const boxCentre = (box: Box): [number, number] => [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
