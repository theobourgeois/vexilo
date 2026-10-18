'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { FlagArt } from './FlagArt';
import { snapAnchors, type Anchor } from './layouts';
import { clamp, fieldSlotAt, hitsLayer, layerBounds, unionBox, type Box } from './model';
import { fieldGuides, type Region } from './regions';
import {
  applyPoses,
  fromLocal,
  handlePoint,
  HANDLES,
  normAngle,
  poseOf,
  rotatePoses,
  scalePoses,
  selectionFrame,
  toLocal,
  upright,
  type Frame,
  type LayerPose,
} from './transform';
import { FIELD, type Studio } from './use-studio';

export type View = { zoom: number; panX: number; panY: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

export const EMBLEM_MIME = 'application/x-vexilo-emblem';

/** Something to snap to along one axis. Centre-only targets don't catch edges; gap targets sit midway between two emblems. */
type Target = { at: number; centreOnly?: boolean; gap?: [number, number] };
type Targets = { x: Target[]; y: Target[] };

type Gesture =
  | { kind: 'move'; ids: string[]; start: [number, number]; origin: Map<string, [number, number]>; box: Box; targets: Targets; moved: boolean }
  | { kind: 'transform'; handle: number; frame: Frame; poses: LayerPose[]; targets: Targets }
  | { kind: 'rotate'; poses: LayerPose[]; centre: [number, number]; centreScreen: [number, number]; startAngle: number; rotation: number }
  | { kind: 'pan'; start: [number, number]; origin: View }
  | { kind: 'marquee'; start: [number, number]; current: [number, number]; additive: boolean; onFlag: boolean }
  | { kind: 'pinch'; poses: LayerPose[]; centre: [number, number]; startDist: number; startAngle: number; startMid: [number, number]; origin: View };

/** A guide line at `at`; for an equal-gap snap, the two gaps (from, to, from, to) drawn across at `across`. */
type Guide = { at: number; gaps?: [number, number, number, number]; across?: number };
type Guides = { x?: Guide; y?: Guide; label?: string; region?: Region };

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** The closest target any of the features (start edge, centre, end edge) is within reach of. */
function snapAxis(features: [number, number, number], targets: Target[], tol: number) {
  let best: { delta: number; target: Target } | null = null;
  features.forEach((feature, i) => {
    for (const target of targets) {
      if ((target.centreOnly || target.gap) && i !== 1) continue;
      const delta = target.at - feature;
      if (Math.abs(delta) < tol && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, target };
    }
  });
  return best as { delta: number; target: Target } | null;
}

/** Resize cursor for a handle, turned with the frame. */
function resizeCursor(frame: Frame, [sx, sy]: [number, number]) {
  const angle = ((Math.atan2(sy * frame.h, sx * frame.w) * 180) / Math.PI + frame.rotation + 360) % 180;
  const bucket = Math.round(angle / 45) % 4;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][bucket];
}

export function StudioCanvas({
  studio,
  view,
  setView,
  insets,
  touch = false,
  onContextMenu,
  onDoubleClickLayer,
  onDoubleClickField,
  onDropEmblem,
  renderOverlay,
}: {
  studio: Studio;
  view: View;
  setView: React.Dispatch<React.SetStateAction<View>>;
  insets: Insets;
  touch?: boolean;
  onContextMenu?: (at: { x: number; y: number; onLayer: boolean }) => void;
  onDoubleClickLayer?: (id: string, at: { x: number; y: number }) => void;
  onDoubleClickField?: (slot: number, at: { x: number; y: number }) => void;
  onDropEmblem?: (emblemId: string, at: { x: number; y: number }) => void;
  renderOverlay?: (rects: { selection: Rect | null; flag: Rect; container: { w: number; h: number }; busy: boolean }) => React.ReactNode;
}) {
  const { design, W, selection, selectedLayers, fieldSelected, setSelection, update, history } = studio;
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [gesture, setGesture] = React.useState<Gesture | null>(null);
  const gestureRef = React.useRef<Gesture | null>(null);
  const [guides, setGuides] = React.useState<Guides>({});
  const [hover, setHover] = React.useState<string | null>(null);
  const [dropAnchor, setDropAnchor] = React.useState<Anchor | null>(null);
  const [angleReadout, setAngleReadout] = React.useState<{ x: number; y: number; angle: number } | null>(null);
  const space = React.useRef(false);
  const pointers = React.useRef(new Map<number, [number, number]>());

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Geometry: flag units → screen.
  const availW = Math.max(1, size.w - insets.left - insets.right);
  const availH = Math.max(1, size.h - insets.top - insets.bottom);
  const fit = Math.max(4, Math.min((availW * 0.86) / W, availH * 0.86));
  const scale = fit * view.zoom;
  const ox = insets.left + availW / 2 - (W * scale) / 2 + view.panX;
  const oy = insets.top + availH / 2 - scale / 2 + view.panY;
  const toScreen = (u: number, v: number): [number, number] => [ox + u * scale, oy + v * scale];
  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const toUnits = ([sx, sy]: [number, number]): [number, number] => [(sx - ox) / scale, (sy - oy) / scale];

  const anchors = React.useMemo(
    () => snapAnchors(design.field.kind === 'layout' ? design.field.layout : null, W, design.field.kind === 'layout' ? design.field.params : {}),
    [design.field, W],
  );

  const hitTest = (u: number, v: number) => {
    for (let i = design.layers.length - 1; i >= 0; i--) {
      const layer = design.layers[i];
      if (!layer.hidden && !layer.locked && hitsLayer(layer, W, u, v)) return layer;
    }
    return null;
  };

  const onFlag = (u: number, v: number) => u >= 0 && u <= W && v >= 0 && v <= 1;

  const field = fieldGuides(design);

  /** Everything a moving selection can line up with: the field's lines and regions, anchors, and other emblems. */
  function snapTargets(exclude: string[]): Targets {
    const x: Target[] = field.xs.map((at) => ({ at }));
    const y: Target[] = field.ys.map((at) => ({ at }));
    for (const r of field.regions) {
      x.push({ at: (r.x0 + r.x1) / 2 });
      y.push({ at: (r.y0 + r.y1) / 2 });
    }
    for (const a of anchors) {
      x.push({ at: a.x, centreOnly: true });
      y.push({ at: a.y, centreOnly: true });
    }
    const others = design.layers.filter((l) => !exclude.includes(l.id) && !l.hidden).map((l) => layerBounds(l, W));
    for (const b of others) {
      x.push({ at: b.x0 }, { at: (b.x0 + b.x1) / 2 }, { at: b.x1 });
      y.push({ at: b.y0 }, { at: (b.y0 + b.y1) / 2 }, { at: b.y1 });
    }
    // Midway between two neighbours, for even spacing.
    for (const a of others) {
      for (const b of others) {
        if (a.x1 < b.x0 && overlaps(a.y0, a.y1, b.y0, b.y1)) x.push({ at: (a.x1 + b.x0) / 2, gap: [a.x1, b.x0] });
        if (a.y1 < b.y0 && overlaps(a.x0, a.x1, b.x0, b.x1)) y.push({ at: (a.y1 + b.y0) / 2, gap: [a.y1, b.y0] });
      }
    }
    return { x, y };
  }

  // Space-drag pans, like every design tool.
  React.useEffect(() => {
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable]');
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e)) {
        space.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') space.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Wheel: pinch/⌘ zooms around the cursor, otherwise pans.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [sx, sy] = local(e);
      if (e.ctrlKey || e.metaKey) {
        setView((v) => {
          const zoom = clamp(v.zoom * Math.exp(-e.deltaY * 0.01), 0.2, 12);
          const k = zoom / v.zoom;
          // Keep the point under the cursor still.
          return { zoom, panX: sx - (sx - v.panX - centreX()) * k - centreX(), panY: sy - (sy - v.panY - centreY()) * k - centreY() };
        });
      } else {
        setView((v) => ({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY }));
      }
    };
    const centreX = () => insets.left + (el.clientWidth - insets.left - insets.right) / 2;
    const centreY = () => insets.top + (el.clientHeight - insets.top - insets.bottom) / 2;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [insets, setView]);

  const begin = (g: Gesture | null) => {
    gestureRef.current = g;
    setGesture(g);
  };

  // Handles act on every selected emblem that can move.
  const transformable = selectedLayers.filter((l) => !l.locked && !l.hidden);
  const frame = selectionFrame(transformable, W);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button === 2) return;
    const point = local(e);
    pointers.current.set(e.pointerId, point);
    ref.current?.setPointerCapture(e.pointerId);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      // A pinch that began as a drag picks up from where the drag left the emblems.
      const poses = studio.design.layers.filter((l) => transformable.some((t) => t.id === l.id)).map(poseOf);
      const start = selectionFrame(studio.design.layers.filter((l) => poses.some((p) => p.id === l.id)), W);
      begin({
        kind: 'pinch',
        poses,
        centre: start ? [start.cx, start.cy] : [W / 2, 0.5],
        startDist: Math.hypot(b[0] - a[0], b[1] - a[1]),
        startAngle: Math.atan2(b[1] - a[1], b[0] - a[0]),
        startMid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        origin: view,
      });
      return;
    }

    if (e.button === 1 || space.current) {
      begin({ kind: 'pan', start: point, origin: view });
      return;
    }

    const handle = (e.target as Element).closest?.('[data-handle]')?.getAttribute('data-handle');
    if (handle && frame) {
      const poses = transformable.map(poseOf);
      if (handle === 'rotate') {
        const centreScreen = toScreen(frame.cx, frame.cy);
        begin({
          kind: 'rotate',
          poses,
          centre: [frame.cx, frame.cy],
          centreScreen,
          startAngle: Math.atan2(point[1] - centreScreen[1], point[0] - centreScreen[0]),
          rotation: frame.rotation,
        });
      } else {
        begin({ kind: 'transform', handle: Number(handle), frame, poses, targets: snapTargets(poses.map((p) => p.id)) });
      }
      return;
    }

    const [u, v] = toUnits(point);
    const hit = hitTest(u, v);
    if (hit) {
      if (e.shiftKey) {
        setSelection(selection.includes(hit.id) ? selection.filter((id) => id !== hit.id) : [...selection.filter((id) => id !== FIELD), hit.id]);
        return;
      }
      const ids = selection.includes(hit.id) ? selectedLayers.filter((l) => !l.locked).map((l) => l.id) : [hit.id];
      if (!selection.includes(hit.id)) setSelection([hit.id]);
      // Alt-drag leaves the originals behind and drags copies.
      const moving = e.altKey ? studio.actions.duplicateInPlace(ids) : design.layers.filter((l) => ids.includes(l.id));
      if (moving.length === 0) return;
      begin({
        kind: 'move',
        ids: moving.map((l) => l.id),
        start: point,
        origin: new Map(moving.map((l) => [l.id, [l.x, l.y]])),
        box: unionBox(moving.map((l) => layerBounds(l, W))),
        targets: snapTargets(moving.map((l) => l.id)),
        moved: false,
      });
      return;
    }
    begin({ kind: 'marquee', start: point, current: point, additive: e.shiftKey, onFlag: onFlag(u, v) });
  }

  function onPointerMove(e: React.PointerEvent) {
    const point = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, point);
    const g = gestureRef.current;

    if (!g) {
      if (e.pointerType === 'mouse') {
        const [u, v] = toUnits(point);
        setHover(hitTest(u, v)?.id ?? null);
      }
      return;
    }

    switch (g.kind) {
      case 'pan':
        setView({ ...g.origin, panX: g.origin.panX + point[0] - g.start[0], panY: g.origin.panY + point[1] - g.start[1] });
        return;
      case 'marquee':
        begin({ ...g, current: point });
        return;
      case 'move': {
        let du = (point[0] - g.start[0]) / scale;
        let dv = (point[1] - g.start[1]) / scale;
        if (!g.moved && Math.hypot(du * scale, dv * scale) < 3) return;
        let lock: 'x' | 'y' | null = null;
        if (e.shiftKey) {
          lock = Math.abs(du) > Math.abs(dv) ? 'x' : 'y';
          if (lock === 'x') dv = 0;
          else du = 0;
        }
        const b = g.box;
        const next: Guides = {};
        if (!(e.metaKey || e.ctrlKey)) {
          const tol = 6 / scale;
          const sx = lock === 'y' ? null : snapAxis([b.x0 + du, (b.x0 + b.x1) / 2 + du, b.x1 + du], g.targets.x, tol);
          const sy = lock === 'x' ? null : snapAxis([b.y0 + dv, (b.y0 + b.y1) / 2 + dv, b.y1 + dv], g.targets.y, tol);
          if (sx) du += sx.delta;
          if (sy) dv += sy.delta;
          const box = { x0: b.x0 + du, x1: b.x1 + du, y0: b.y0 + dv, y1: b.y1 + dv };
          if (sx) {
            const gap = sx.target.gap;
            next.x = gap ? { at: sx.target.at, gaps: [gap[0], box.x0, box.x1, gap[1]], across: (box.y0 + box.y1) / 2 } : { at: sx.target.at };
          }
          if (sy) {
            const gap = sy.target.gap;
            next.y = gap ? { at: sy.target.at, gaps: [gap[0], box.y0, box.y1, gap[1]], across: (box.x0 + box.x1) / 2 } : { at: sy.target.at };
          }
          // The part of the field the selection is in, and its name once centred there.
          const cx = (box.x0 + box.x1) / 2;
          const cy = (box.y0 + box.y1) / 2;
          const region = field.containerAt(cx, cy);
          if (region !== field.regions[0]) next.region = region;
          if (next.x && next.y && !next.x.gaps && !next.y.gaps) {
            const near = (p: number, q: number) => Math.abs(p - q) < 1e-6;
            const named = anchors.find((a) => near(a.x, next.x!.at) && near(a.y, next.y!.at));
            if (named) next.label = named.label;
            else if (near((region.x0 + region.x1) / 2, cx) && near((region.y0 + region.y1) / 2, cy)) next.label = region.label;
          }
        }
        setGuides(next);
        update(
          (d) => ({
            ...d,
            layers: d.layers.map((l) => {
              const origin = g.origin.get(l.id);
              return origin ? { ...l, x: origin[0] + du / W, y: origin[1] + dv } : l;
            }),
          }),
          { transient: true },
        );
        if (!g.moved) gestureRef.current = { ...g, moved: true };
        return;
      }
      case 'transform': {
        const f = g.frame;
        const [hx, hy] = HANDLES[g.handle];
        const corner = hx !== 0 && hy !== 0;
        // Corners keep proportions and edges stretch; shift swaps the two. Alt works from the centre.
        const proportional = corner ? !e.shiftKey : e.shiftKey;
        const about: [number, number] = e.altKey ? [0, 0] : [(-hx * f.w) / 2, (-hy * f.h) / 2];
        const span: [number, number] = [(hx * f.w) / 2 - about[0], (hy * f.h) / 2 - about[1]];
        const p = toLocal(f, toUnits(point));
        const factor = (i: 0 | 1) => (span[i] === 0 ? 1 : (p[i] - about[i]) / span[i]);
        let fx = factor(0);
        let fy = factor(1);
        if (proportional) {
          const k = corner
            ? ((p[0] - about[0]) * span[0] + (p[1] - about[1]) * span[1]) / (span[0] ** 2 + span[1] ** 2)
            : hx !== 0
              ? fx
              : fy;
          fx = fy = k;
        }
        const next: Guides = {};
        // Upright boxes snap the edges being dragged.
        if (upright(f) && !(e.metaKey || e.ctrlKey)) {
          const tol = 6 / scale;
          const centre = [f.cx, f.cy];
          const snaps = ([0, 1] as const)
            .filter((i) => span[i] !== 0)
            .map((i) => {
              const edge = centre[i] + about[i] + (i === 0 ? fx : fy) * span[i];
              const hit = snapAxis([edge, edge, edge], (i === 0 ? g.targets.x : g.targets.y).filter((t) => !t.gap && !t.centreOnly), tol);
              return hit && { i, at: hit.target.at, d: Math.abs(hit.delta), f: (hit.target.at - centre[i] - about[i]) / span[i] };
            })
            .filter((hit) => hit !== null && hit.f > 0);
          if (proportional) {
            const best = snaps.sort((a, b) => a!.d - b!.d)[0];
            if (best) {
              fx = fy = best.f;
              next[best.i === 0 ? 'x' : 'y'] = { at: best.at };
            }
          } else {
            for (const hit of snaps) {
              if (hit!.i === 0) fx = hit!.f;
              else fy = hit!.f;
              next[hit!.i === 0 ? 'x' : 'y'] = { at: hit!.at };
            }
          }
        }
        const min = 0.012;
        fx = Math.max(fx, min / Math.max(f.w, min));
        fy = Math.max(fy, min / Math.max(f.h, min));
        const region = field.containerAt(...fromLocal(f, [about[0] * (1 - fx), about[1] * (1 - fy)]));
        if (region !== field.regions[0]) next.region = region;
        setGuides(next);
        update((d) => ({ ...d, layers: applyPoses(d.layers, scalePoses(g.poses, f, about, fx, fy, W)) }), { transient: true });
        return;
      }
      case 'rotate': {
        let angle = g.rotation + ((Math.atan2(point[1] - g.centreScreen[1], point[0] - g.centreScreen[0]) - g.startAngle) * 180) / Math.PI;
        if (e.shiftKey) angle = Math.round(angle / 15) * 15;
        else if (Math.abs(angle - Math.round(angle / 90) * 90) < 3) angle = Math.round(angle / 90) * 90;
        setAngleReadout({ x: point[0], y: point[1], angle: normAngle(angle) });
        const turned = rotatePoses(g.poses, g.centre, angle - g.rotation, W);
        update((d) => ({ ...d, layers: applyPoses(d.layers, turned) }), { transient: true });
        return;
      }
      case 'pinch': {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const k = dist / g.startDist;
        if (g.poses.length) {
          // Pinch scales and turns the selection about its centre while the midpoint carries it.
          const [cx, cy] = g.centre;
          const scaled = scalePoses(g.poses, { cx, cy, w: 1, h: 1, rotation: 0 }, [0, 0], k, k, W);
          const turned = rotatePoses(scaled, g.centre, ((angle - g.startAngle) * 180) / Math.PI, W);
          const du = (mid[0] - g.startMid[0]) / scale;
          const dv = (mid[1] - g.startMid[1]) / scale;
          const moved = turned.map((pose) => ({ ...pose, x: pose.x + du / W, y: pose.y + dv }));
          update((d) => ({ ...d, layers: applyPoses(d.layers, moved) }), { transient: true });
        } else {
          const zoom = clamp(g.origin.zoom * k, 0.3, 8);
          setView({ zoom, panX: g.origin.panX + mid[0] - g.startMid[0], panY: g.origin.panY + mid[1] - g.startMid[1] });
        }
        return;
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (g?.kind === 'pinch' && pointers.current.size > 0) {
      // One finger lifted: end the pinch and wait for the other.
      history.commit();
      begin(null);
      return;
    }
    if (g?.kind === 'marquee') {
      const [x0, y0] = [Math.min(g.start[0], g.current[0]), Math.min(g.start[1], g.current[1])];
      const [x1, y1] = [Math.max(g.start[0], g.current[0]), Math.max(g.start[1], g.current[1])];
      if (x1 - x0 < 4 && y1 - y0 < 4) {
        if (!g.additive) setSelection(g.onFlag ? [FIELD] : []);
      } else {
        const [u0, v0] = toUnits([x0, y0]);
        const [u1, v1] = toUnits([x1, y1]);
        const inside = design.layers
          .filter((l) => !l.hidden && !l.locked)
          .filter((l) => {
            const b = layerBounds(l, W);
            return b.x1 >= u0 && b.x0 <= u1 && b.y1 >= v0 && b.y0 <= v1;
          })
          .map((l) => l.id);
        setSelection(g.additive ? [...new Set([...selection.filter((id) => id !== FIELD), ...inside])] : inside);
      }
    }
    if (g && g.kind !== 'pan' && g.kind !== 'marquee') history.commit();
    setGuides({});
    setAngleReadout(null);
    begin(null);
  }

  function onDoubleClick(e: React.MouseEvent) {
    const point = local(e);
    const [u, v] = toUnits(point);
    const hit = hitTest(u, v);
    if (hit) onDoubleClickLayer?.(hit.id, { x: e.clientX, y: e.clientY });
    else if (onFlag(u, v)) {
      setSelection([FIELD]);
      onDoubleClickField?.(fieldSlotAt(design, u, v), { x: e.clientX, y: e.clientY });
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const [u, v] = toUnits(local(e));
    const hit = hitTest(u, v);
    if (hit && !selection.includes(hit.id)) setSelection([hit.id]);
    if (!hit && onFlag(u, v) && selection.length === 0) setSelection([FIELD]);
    onContextMenu?.({ x: e.clientX, y: e.clientY, onLayer: Boolean(hit) });
  }

  function nearestAnchor(u: number, v: number) {
    const near = anchors.map((a) => ({ a, d: Math.hypot(a.x - u, a.y - v) })).sort((p, q) => p.d - q.d)[0];
    return near && near.d < 0.1 ? near.a : null;
  }

  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(EMBLEM_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const [u, v] = toUnits(local(e));
    setDropAnchor(nearestAnchor(u, v));
  }

  function onDrop(e: React.DragEvent) {
    const id = e.dataTransfer.getData(EMBLEM_MIME);
    setDropAnchor(null);
    if (!id) return;
    e.preventDefault();
    const [u, v] = toUnits(local(e));
    onDropEmblem?.(id, { x: clamp(u / W, 0, 1), y: clamp(v, 0, 1) });
  }

  // ---- overlay geometry (screen space) ----
  const busy = gesture !== null && gesture.kind !== 'marquee' && gesture.kind !== 'pan';
  const visibleSelected = selectedLayers.filter((l) => !l.hidden);
  const selBox: Box | null = visibleSelected.length ? unionBox(visibleSelected.map((l) => layerBounds(l, W))) : null;
  const selectionRect: Rect | null = selBox
    ? (() => {
        const [x0, y0] = toScreen(selBox.x0, selBox.y0);
        const [x1, y1] = toScreen(selBox.x1, selBox.y1);
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      })()
    : fieldSelected
      ? { x: ox, y: oy, w: W * scale, h: scale }
      : null;
  const flagRect = { x: ox, y: oy, w: W * scale, h: scale };
  const handleSize = touch ? 18 : 10;
  // The box drawn around the selection; locked emblems get it without handles.
  const shownFrame = frame ?? selectionFrame(visibleSelected, W);
  const corners = shownFrame ? HANDLES.slice(0, 4).map((h) => toScreen(...handlePoint(shownFrame, h))) : [];
  const edges = frame
    ? HANDLES.slice(4).map((h, i) => {
        const [a, b] = [corners[i], corners[(i + 1) % 4]];
        return { i: i + 4, a, b, mid: toScreen(...handlePoint(frame, h)), length: Math.hypot(b[0] - a[0], b[1] - a[1]), cursor: resizeCursor(frame, h) };
      })
    : [];
  const rotateHandle = (() => {
    if (!frame) return null;
    const mid = toScreen(...handlePoint(frame, [0, -1]));
    const a = (frame.rotation * Math.PI) / 180;
    const out = touch ? 34 : 24;
    return { from: mid, to: [mid[0] + Math.sin(a) * out, mid[1] - Math.cos(a) * out] };
  })();
  const hovered = hover && !selection.includes(hover) ? design.layers.find((l) => l.id === hover) : null;
  const marquee = gesture?.kind === 'marquee' ? gesture : null;
  const cursor =
    gesture?.kind === 'pan' || space.current
      ? 'grabbing'
      : gesture?.kind === 'move'
        ? 'move'
        : hovered || (hover && selection.includes(hover))
          ? 'move'
          : 'default';

  return (
    <div
      ref={ref}
      className='absolute inset-0 touch-none select-none overflow-hidden outline-none'
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={handleContextMenu}
      onDragOver={onDragOver}
      onDragLeave={() => setDropAnchor(null)}
      onDrop={onDrop}
    >
      <div className='pointer-events-none absolute' style={{ left: ox, top: oy, width: W * scale, height: scale, visibility: size.w ? 'visible' : 'hidden' }}>
        <FlagArt design={design} className='studio-flag block size-full' />
      </div>

      <svg className='pointer-events-none absolute inset-0 size-full overflow-visible'>
        {fieldSelected && selectedLayers.length === 0 && (
          <rect x={ox - 1} y={oy - 1} width={W * scale + 2} height={scale + 2} fill='none' stroke='var(--main)' strokeWidth={2} rx={1} />
        )}
        {hovered && (() => {
          const b = layerBounds(hovered, W);
          const [x0, y0] = toScreen(b.x0, b.y0);
          const [x1, y1] = toScreen(b.x1, b.y1);
          return <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill='none' stroke='var(--main)' strokeWidth={1} opacity={0.6} />;
        })()}
        {guides.region && (() => {
          const r = guides.region;
          const [x0, y0] = toScreen(r.x0, r.y0);
          const [x1, y1] = toScreen(r.x1, r.y1);
          return <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill='rgb(255 79 163 / 0.06)' stroke='#ff4fa3' strokeWidth={1} strokeDasharray='5 4' />;
        })()}
        {visibleSelected.length > 1 &&
          visibleSelected.map((l) => {
            const b = layerBounds(l, W);
            const [x0, y0] = toScreen(b.x0, b.y0);
            const [x1, y1] = toScreen(b.x1, b.y1);
            return <rect key={l.id} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill='none' stroke='var(--main)' strokeWidth={1} strokeDasharray='3 3' />;
          })}
        {corners.length === 4 && (
          <g>
            <polygon points={corners.map((c) => c.join(',')).join(' ')} fill='none' stroke='var(--main)' strokeWidth={1.5} />
            {rotateHandle && (
              <>
                <line x1={rotateHandle.from[0]} y1={rotateHandle.from[1]} x2={rotateHandle.to[0]} y2={rotateHandle.to[1]} stroke='var(--main)' strokeWidth={1.5} />
                <circle
                  data-handle='rotate'
                  cx={rotateHandle.to[0]}
                  cy={rotateHandle.to[1]}
                  r={handleSize / 2 + 1}
                  fill='#fff'
                  stroke='var(--main)'
                  strokeWidth={1.5}
                  className='pointer-events-auto'
                  style={{ cursor: 'grab' }}
                />
              </>
            )}
            {/* Whole edges stretch; the marks show where on boxes big enough to hold them. */}
            {edges.map((edge) => (
              <g key={edge.i} data-handle={String(edge.i)} className='pointer-events-auto' style={{ cursor: edge.cursor }}>
                <line x1={edge.a[0]} y1={edge.a[1]} x2={edge.b[0]} y2={edge.b[1]} stroke='transparent' strokeWidth={touch ? 22 : 10} />
                {edge.length > (touch ? 64 : 44) && (
                  <circle cx={edge.mid[0]} cy={edge.mid[1]} r={touch ? 6 : 3.5} fill='#fff' stroke='var(--main)' strokeWidth={1.5} />
                )}
              </g>
            ))}
            {frame &&
              corners.map((c, i) => (
                <rect
                  key={i}
                  data-handle={String(i)}
                  x={c[0] - handleSize / 2}
                  y={c[1] - handleSize / 2}
                  width={handleSize}
                  height={handleSize}
                  rx={touch ? handleSize / 2 : 2.5}
                  fill='#fff'
                  stroke='var(--main)'
                  strokeWidth={1.5}
                  className='pointer-events-auto'
                  style={{ cursor: resizeCursor(frame, HANDLES[i]) }}
                />
              ))}
          </g>
        )}
        {guides.x && !guides.x.gaps && (
          <line x1={toScreen(guides.x.at, 0)[0]} y1={oy - 16} x2={toScreen(guides.x.at, 0)[0]} y2={oy + scale + 16} stroke='#ff4fa3' strokeWidth={1} strokeDasharray='4 3' />
        )}
        {guides.y && !guides.y.gaps && (
          <line x1={ox - 16} y1={toScreen(0, guides.y.at)[1]} x2={ox + W * scale + 16} y2={toScreen(0, guides.y.at)[1]} stroke='#ff4fa3' strokeWidth={1} strokeDasharray='4 3' />
        )}
        {guides.x?.gaps && <GapMarks gaps={guides.x.gaps} across={guides.x.across!} toScreen={toScreen} axis='x' />}
        {guides.y?.gaps && <GapMarks gaps={guides.y.gaps} across={guides.y.across!} toScreen={toScreen} axis='y' />}
        {dropAnchor && (() => {
          const [x0, y0] = toScreen(dropAnchor.x - dropAnchor.w / 2, dropAnchor.y - dropAnchor.h / 2);
          return (
            <rect x={x0} y={y0} width={dropAnchor.w * scale} height={dropAnchor.h * scale} rx={6} fill='rgb(255 79 163 / 0.08)' stroke='#ff4fa3' strokeWidth={1.5} strokeDasharray='5 4' />
          );
        })()}
        {marquee && (
          <rect
            x={Math.min(marquee.start[0], marquee.current[0])}
            y={Math.min(marquee.start[1], marquee.current[1])}
            width={Math.abs(marquee.current[0] - marquee.start[0])}
            height={Math.abs(marquee.current[1] - marquee.start[1])}
            fill='color-mix(in srgb, var(--main) 10%, transparent)'
            stroke='var(--main)'
            strokeWidth={1}
          />
        )}
      </svg>

      {guides.label && selectionRect && (
        <span
          className='pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-[#ff4fa3] px-2 py-0.5 text-[11px] font-semibold text-white'
          style={{ left: selectionRect.x + selectionRect.w / 2, top: selectionRect.y + selectionRect.h + 10 }}
        >
          {guides.label}
        </span>
      )}
      {dropAnchor && (
        <span
          className='pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-[#ff4fa3] px-2 py-0.5 text-[11px] font-semibold text-white'
          style={{ left: toScreen(dropAnchor.x, 0)[0], top: toScreen(0, dropAnchor.y + dropAnchor.h / 2)[1] + 8 }}
        >
          {dropAnchor.label}
        </span>
      )}
      {angleReadout && (
        <span
          className={cn('pointer-events-none absolute rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-background')}
          style={{ left: angleReadout.x + 14, top: angleReadout.y + 14 }}
        >
          {Math.round(angleReadout.angle)}°
        </span>
      )}

      {renderOverlay?.({ selection: selectionRect, flag: flagRect, container: size, busy })}
    </div>
  );
}

/** Two equal gaps either side of the selection, as measured spans. */
function GapMarks({
  gaps,
  across,
  toScreen,
  axis,
}: {
  gaps: [number, number, number, number];
  across: number;
  toScreen: (u: number, v: number) => [number, number];
  axis: 'x' | 'y';
}) {
  const at = (along: number) => (axis === 'x' ? toScreen(along, across) : toScreen(across, along));
  const spans: [number, number][] = [
    [gaps[0], gaps[1]],
    [gaps[2], gaps[3]],
  ];
  return (
    <g stroke='#ff4fa3' strokeWidth={1.25}>
      {spans.map(([from, to], i) => {
        const [a, b] = [at(from), at(to)];
        const tick = axis === 'x' ? ([0, 5] as const) : ([5, 0] as const);
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            <line x1={a[0] - tick[0]} y1={a[1] - tick[1]} x2={a[0] + tick[0]} y2={a[1] + tick[1]} />
            <line x1={b[0] - tick[0]} y1={b[1] - tick[1]} x2={b[0] + tick[0]} y2={b[1] + tick[1]} />
          </g>
        );
      })}
    </g>
  );
}
