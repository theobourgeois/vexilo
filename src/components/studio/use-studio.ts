'use client';

import React from 'react';
import type { StudioDesign, StudioLayer, StudioOutline, StudioRepeat, StudioShape } from '@/lib/studio-design';
import { contrastRatio, luminance, matchToPalette } from './colors';
import { useHistory } from './history';
import { defaultParams, LAYOUTS, snapAnchors, type LayoutPreset } from './layouts';
import {
  clamp,
  defaultRepeat,
  fieldColorAt,
  fitSize,
  flagWidth,
  layerBounds,
  newLayer,
  REPEAT_SIZE,
  replaceColor,
  uid,
  unionBox,
  type Box,
  layerWidth,
  type StudioDoc,
  type StudioEmblem,
} from './model';
import { applyPoses, poseOf, scalePoses } from './transform';

export const FIELD = 'field';

export type AlignEdge = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';

/** How far an emblem fills a region it's fitted to. */
const FIT_FILL = 0.8;

type Opts = { transient?: boolean };

let clipboard: StudioLayer[] = [];
let pasteCount = 0;

export function useStudio(initial: StudioDoc) {
  const history = useHistory<StudioDoc>(initial);
  const doc = history.present;
  const design = doc.design;
  const W = flagWidth(design);
  const [selection, setSelectionState] = React.useState<string[]>([]);

  // Drop ids that no longer exist (after undo, delete…).
  const ids = React.useMemo(() => new Set(design.layers.map((l) => l.id)), [design.layers]);
  const liveSelection = React.useMemo(
    () => selection.filter((id) => id === FIELD || ids.has(id)),
    [selection, ids],
  );
  const selectedLayers = design.layers.filter((l) => liveSelection.includes(l.id));
  const fieldSelected = liveSelection.includes(FIELD);

  const setSelection = React.useCallback((next: string[]) => setSelectionState(next), []);

  const update = React.useCallback(
    (fn: (d: StudioDesign) => StudioDesign, opts?: Opts) => history.set((d) => ({ ...d, design: fn(d.design) }), opts),
    [history],
  );

  const updateLayers = React.useCallback(
    (targets: string[], fn: (layer: StudioLayer) => StudioLayer, opts?: Opts) =>
      update((d) => ({ ...d, layers: d.layers.map((l) => (targets.includes(l.id) ? fn(l) : l)) }), opts),
    [update],
  );

  const editable = selectedLayers.filter((l) => !l.locked).map((l) => l.id);

  const actions = {
    setName: (name: string) => history.set((d) => ({ ...d, name })),

    addEmblem(emblem: StudioEmblem, at?: { x: number; y: number }) {
      const params = design.field.kind === 'layout' ? design.field.params : {};
      const anchors = snapAnchors(design.field.kind === 'layout' ? design.field.layout : null, W, params);
      let place: { x: number; y: number; size: number };
      if (at) {
        const near = anchors
          .map((a) => ({ a, d: Math.hypot(a.x - at.x * W, a.y - at.y) }))
          .sort((p, q) => p.d - q.d)[0];
        place =
          near && near.d < 0.1
            ? { x: near.a.x / W, y: near.a.y, size: fitSize(emblem.aspect, near.a) }
            : { x: at.x, y: at.y, size: fitSize(emblem.aspect, { w: W * 0.4, h: 0.4 }) };
      } else {
        // The first free spot the layout suggests, so repeated adds don't stack.
        const free = anchors.find((a) => !design.layers.some((l) => Math.hypot(l.x * W - a.x, l.y - a.y) < 0.05)) ?? anchors[0];
        place = { x: free.x / W, y: free.y, size: fitSize(emblem.aspect, free) };
      }
      const layer = newLayer(emblem, place);
      // A simple emblem that would vanish into what's behind it starts in a contrasting flag colour.
      const behind = fieldColorAt(design, place.x * W, place.y);
      if (layer.colors.length <= 2 && contrastRatio(layer.colors[0], behind) < 1.6) {
        // Prefer the flag's own colours; fall back to white or black.
        const byContrast = (colors: string[]) => [...colors].sort((a, b) => contrastRatio(b, behind) - contrastRatio(a, behind));
        const own = byContrast(design.field.colors).filter((c) => contrastRatio(c, behind) >= 2.5);
        layer.colors = [own[0] ?? byContrast(['#FFFFFF', '#000000'])[0], ...layer.colors.slice(1)];
      }
      update((d) => ({ ...d, layers: [...d.layers, layer] }));
      setSelectionState([layer.id]);
      return layer.id;
    },

    /** Adds a drawn shape or stroke on top. */
    addLayer(layer: StudioLayer, opts?: Opts & { select?: boolean }) {
      update((d) => ({ ...d, layers: [...d.layers, layer] }), opts);
      if (opts?.select !== false) setSelectionState([layer.id]);
    },

    /** Changes the selected shapes; a brush stroke is never filled. */
    setShape: (patch: Partial<StudioShape>, opts?: Opts) =>
      updateLayers(
        editable,
        (l) => (l.shape ? { ...l, shape: { ...l.shape, ...patch, fill: l.shape.kind === 'brush' ? false : (patch.fill ?? l.shape.fill) } } : l),
        opts,
      ),
    /** Paints the selected shapes' fill (0) or stroke (1). A brush's one colour is both. */
    setShapeColor: (index: 0 | 1, color: string, opts?: Opts) =>
      updateLayers(
        editable,
        (l) => (l.shape ? { ...l, colors: l.shape.kind === 'brush' ? [color, color] : l.colors.map((c, i) => (i === index ? color : c)) } : l),
        opts,
      ),
    /** How thick the selected lines and arrows are, keeping their length. */
    setWeight: (size: number, opts?: Opts) =>
      updateLayers(editable, (l) => (l.shape ? { ...l, size, aspect: layerWidth(l) / size, stretch: undefined } : l), opts),

    deleteSelected() {
      const targets = editable;
      if (targets.length === 0) return;
      update((d) => ({ ...d, layers: d.layers.filter((l) => !targets.includes(l.id)) }));
      setSelectionState([]);
    },

    duplicateSelected(offset = 0.04) {
      const sources = selectedLayers;
      if (sources.length === 0) return [];
      const copies = sources.map((l) => ({ ...l, id: uid(), x: clamp(l.x + offset / W, 0, 1), y: clamp(l.y + offset, 0, 1), locked: false }));
      update((d) => {
        const layers = [...d.layers];
        const top = Math.max(...sources.map((s) => layers.findIndex((l) => l.id === s.id)));
        layers.splice(top + 1, 0, ...copies);
        return { ...d, layers };
      });
      setSelectionState(copies.map((c) => c.id));
      return copies.map((c) => c.id);
    },

    /** Copies in place for alt-drag; the drag then moves them. */
    duplicateInPlace(targets: string[]) {
      const sources = design.layers.filter((l) => targets.includes(l.id) && !l.locked);
      const copies = sources.map((l) => ({ ...l, id: uid() }));
      update((d) => {
        const layers = [...d.layers];
        const top = Math.max(...sources.map((s) => layers.findIndex((l) => l.id === s.id)));
        layers.splice(top + 1, 0, ...copies);
        return { ...d, layers };
      }, { transient: true });
      setSelectionState(copies.map((c) => c.id));
      return copies;
    },

    copy() {
      if (selectedLayers.length === 0) return;
      clipboard = selectedLayers.map((l) => ({ ...l }));
      pasteCount = 0;
    },
    cut() {
      actions.copy();
      actions.deleteSelected();
    },
    paste() {
      if (clipboard.length === 0) return;
      pasteCount += 1;
      const shift = 0.03 * pasteCount;
      const copies = clipboard.map((l) => ({ ...l, id: uid(), x: clamp(l.x + shift / W, 0, 1), y: clamp(l.y + shift, 0, 1), locked: false }));
      update((d) => ({ ...d, layers: [...d.layers, ...copies] }));
      setSelectionState(copies.map((c) => c.id));
    },
    canPaste: () => clipboard.length > 0,

    selectAll: () => setSelectionState(design.layers.filter((l) => !l.hidden && !l.locked).map((l) => l.id)),
    selectNext(direction: 1 | -1) {
      const layers = design.layers.filter((l) => !l.hidden);
      if (layers.length === 0) return;
      const current = layers.findIndex((l) => l.id === selectedLayers[selectedLayers.length - 1]?.id);
      const next = current < 0 ? (direction > 0 ? 0 : layers.length - 1) : (current + direction + layers.length) % layers.length;
      setSelectionState([layers[next].id]);
    },

    nudge(dx: number, dy: number) {
      updateLayers(editable, (l) => ({ ...l, x: l.x + dx / W, y: l.y + dy }));
    },

    /** Layer order: +1 forward, -1 backward, 'front', 'back'. */
    arrange(to: 1 | -1 | 'front' | 'back') {
      const targets = new Set(editable);
      if (targets.size === 0) return;
      update((d) => {
        const moving = d.layers.filter((l) => targets.has(l.id));
        const rest = d.layers.filter((l) => !targets.has(l.id));
        if (to === 'front') return { ...d, layers: [...rest, ...moving] };
        if (to === 'back') return { ...d, layers: [...moving, ...rest] };
        const layers = [...d.layers];
        const order = to === 1 ? [...layers.keys()].reverse() : [...layers.keys()];
        for (const i of order) {
          const j = i + to;
          if (!targets.has(layers[i].id) || j < 0 || j >= layers.length || targets.has(layers[j].id)) continue;
          [layers[i], layers[j]] = [layers[j], layers[i]];
        }
        return { ...d, layers };
      });
    },

    move(id: string, toIndex: number) {
      update((d) => {
        const layers = [...d.layers];
        const from = layers.findIndex((l) => l.id === id);
        if (from < 0) return d;
        const [layer] = layers.splice(from, 1);
        layers.splice(clamp(toIndex, 0, layers.length), 0, layer);
        return { ...d, layers };
      });
    },

    flip: (axis: 'x' | 'y') =>
      updateLayers(editable, (l) => (axis === 'x' ? { ...l, flipX: !l.flipX } : { ...l, flipY: !l.flipY })),
    rotateBy: (degrees: number) => updateLayers(editable, (l) => ({ ...l, rotation: ((l.rotation + degrees + 540) % 360) - 180 })),
    scaleBy: (factor: number) =>
      updateLayers(editable, (l) => ({
        ...l,
        size: clamp(l.size * factor, 0.015, 3),
        repeat: l.repeat && (l.repeat.mode === 'ring' || l.repeat.mode === 'arc') ? { ...l.repeat, spacing: l.repeat.spacing * factor } : l.repeat,
        ...(l.shape && { shape: { ...l.shape, stroke: l.shape.stroke * factor } }),
      })),

    /**
     * Lines the selection up with a box. Without one, each emblem lines up with the selection's
     * edges; with one (a region, the flag), the selection moves there as a group.
     */
    align(edge: AlignEdge, target: Box | null) {
      const layers = design.layers.filter((l) => editable.includes(l.id) && !l.hidden);
      if (layers.length === 0) return;
      const bounds = new Map(layers.map((l) => [l.id, layerBounds(l, W)]));
      const group = unionBox([...bounds.values()]);
      const into = target ?? group;
      const shift = (b: Box): [number, number] => {
        switch (edge) {
          case 'left':
            return [into.x0 - b.x0, 0];
          case 'centre':
            return [(into.x0 + into.x1 - b.x0 - b.x1) / 2, 0];
          case 'right':
            return [into.x1 - b.x1, 0];
          case 'top':
            return [0, into.y0 - b.y0];
          case 'middle':
            return [0, (into.y0 + into.y1 - b.y0 - b.y1) / 2];
          case 'bottom':
            return [0, into.y1 - b.y1];
        }
      };
      const together = shift(group);
      updateLayers(
        layers.map((l) => l.id),
        (l) => {
          const [dx, dy] = target ? together : shift(bounds.get(l.id)!);
          return { ...l, x: l.x + dx / W, y: l.y + dy };
        },
      );
    },

    /** Spaces three or more emblems evenly between the outermost two. */
    distribute(axis: 'x' | 'y') {
      const items = design.layers
        .filter((l) => editable.includes(l.id) && !l.hidden)
        .map((l) => ({ id: l.id, box: layerBounds(l, W) }))
        .map(({ id, box }) => ({ id, start: axis === 'x' ? box.x0 : box.y0, end: axis === 'x' ? box.x1 : box.y1 }))
        .sort((a, b) => a.start + a.end - b.start - b.end);
      if (items.length < 3) return;
      const span = items[items.length - 1].end - items[0].start;
      const gap = (span - items.reduce((sum, item) => sum + item.end - item.start, 0)) / (items.length - 1);
      const shifts = new Map<string, number>();
      let at = items[0].start;
      for (const item of items) {
        shifts.set(item.id, at - item.start);
        at += item.end - item.start + gap;
      }
      updateLayers([...shifts.keys()], (l) =>
        axis === 'x' ? { ...l, x: l.x + shifts.get(l.id)! / W } : { ...l, y: l.y + shifts.get(l.id)! },
      );
    },

    /** Sizes the selection to sit snugly in a box, centred in it. */
    fitTo(target: Box) {
      const layers = design.layers.filter((l) => editable.includes(l.id) && !l.hidden);
      if (layers.length === 0) return;
      const group = unionBox(layers.map((l) => layerBounds(l, W)));
      const [w, h] = [group.x1 - group.x0, group.y1 - group.y0];
      const k = Math.min(((target.x1 - target.x0) * FIT_FILL) / w, ((target.y1 - target.y0) * FIT_FILL) / h);
      const frame = { cx: (group.x0 + group.x1) / 2, cy: (group.y0 + group.y1) / 2, w, h, rotation: 0 };
      const [dx, dy] = [(target.x0 + target.x1) / 2 - frame.cx, (target.y0 + target.y1) / 2 - frame.cy];
      const poses = scalePoses(layers.map(poseOf), frame, [0, 0], k, k, W).map((p) => ({ ...p, x: p.x + dx / W, y: p.y + dy }));
      update((d) => ({ ...d, layers: applyPoses(d.layers, poses) }));
    },

    /** Puts stretched emblems back in their own proportions, keeping their height. */
    unstretch: () =>
      updateLayers(editable, (l) => {
        const next = { ...l };
        delete next.stretch;
        return next;
      }),

    /** Repaints the selected emblems in the field's colours, avoiding the colour behind each. */
    matchPalette() {
      updateLayers(editable, (l) => {
        const behind = fieldColorAt(design, l.x * W, l.y);
        const targets = [...design.field.colors, ...design.layers.filter((o) => o.id !== l.id && !o.hidden).flatMap((o) => o.colors)];
        return { ...l, colors: matchToPalette(l.palette, design.field.colors.length > 1 ? design.field.colors : targets, behind) };
      });
    },

    toggleOutline() {
      const on = selectedLayers.some((l) => !l.outline);
      updateLayers(editable, (l) => {
        if (!on) return { ...l, outline: null };
        if (l.outline) return l;
        // A contrasting edge against what's behind the emblem.
        const behind = fieldColorAt(design, l.x * W, l.y);
        const options = [...design.field.colors, '#FFFFFF', '#000000'];
        const color = options.sort((a, b) => contrastRatio(b, behind) - contrastRatio(a, behind))[0];
        return { ...l, outline: { color, width: Math.max(0.006, l.size * 0.035) } };
      });
    },
    setOutline: (patch: Partial<StudioOutline>, opts?: Opts) =>
      updateLayers(editable, (l) => (l.outline ? { ...l, outline: { ...l.outline, ...patch } } : l), opts),

    setRepeatMode(mode: StudioRepeat['mode'] | null) {
      updateLayers(editable, (l) => {
        if (mode === null) return { ...l, repeat: null };
        if (l.repeat?.mode === mode) return l;
        // A new pattern starts from its own defaults, with the emblem shrunk to suit it.
        return { ...l, size: Math.min(l.size, REPEAT_SIZE[mode]), repeat: { ...defaultRepeat(mode, l), facing: l.repeat?.facing ?? false } };
      });
    },
    setRepeat: (patch: Partial<StudioRepeat>, opts?: Opts) =>
      updateLayers(editable, (l) => (l.repeat ? { ...l, repeat: { ...l.repeat, ...patch } } : l), opts),

    setLayerColor: (id: string, index: number, color: string, opts?: Opts) =>
      updateLayers([id], (l) => ({ ...l, colors: l.colors.map((c, i) => (i === index ? color : c)) }), opts),
    resetLayerColors: (targets: string[]) => updateLayers(targets, (l) => ({ ...l, colors: [...l.palette] })),

    toggleHidden: (id: string) => updateLayers([id], (l) => ({ ...l, hidden: !l.hidden })),
    toggleLocked: (id: string) => updateLayers([id], (l) => ({ ...l, locked: !l.locked })),
    rename: (id: string, name: string) => updateLayers([id], (l) => ({ ...l, name: name.trim() || l.name })),

    setFieldColor: (slot: number, color: string, opts?: Opts) =>
      update((d) => ({ ...d, field: { ...d.field, colors: d.field.colors.map((c, i) => (i === slot ? color : c)) } }), opts),

    /** Switches layout, keeping the colours already in use where there are slots for them. */
    setLayout(preset: LayoutPreset) {
      const def = LAYOUTS[preset.layout];
      update((d) => {
        const current = d.field.colors;
        const colors = def.colors.map((fallback, i) => current[i] ?? fallback);
        return { ...d, field: { kind: 'layout', layout: preset.layout, colors, params: defaultParams(preset.layout, preset.params) } };
      });
    },
    setParam: (key: string, value: number, opts?: Opts) =>
      update((d) => (d.field.kind === 'layout' ? { ...d, field: { ...d.field, params: { ...d.field.params, [key]: value } } } : d), opts),

    setRatio: (ratio: [number, number]) => update((d) => ({ ...d, ratio })),

    /** Applies a palette to the field, then pulls the emblems onto it. */
    applyPalette(colors: string[]) {
      update((d) => {
        const fieldColors = d.field.colors.map((_, i) => colors[i % colors.length]);
        const next = { ...d, field: { ...d.field, colors: fieldColors } };
        const Wn = flagWidth(next);
        return {
          ...next,
          layers: next.layers.map((l) => ({ ...l, colors: matchToPalette(l.palette, colors, fieldColorAt(next, l.x * Wn, l.y)) })),
        };
      });
    },
    /** Rotates the field's colours one slot along. */
    cycleFieldColors() {
      update((d) => ({ ...d, field: { ...d.field, colors: [...d.field.colors.slice(1), d.field.colors[0]] } }));
    },
    replaceColor: (from: string, to: string, opts?: Opts) => update((d) => replaceColor(d, from, to), opts),

    reset(next: StudioDoc) {
      history.reset(next);
      setSelectionState([]);
    },
    /** Replaces the whole design as one undoable step (start over). */
    restore(next: StudioDoc) {
      history.set(next);
      setSelectionState([]);
    },
  };

  return {
    doc,
    design,
    W,
    selection: liveSelection,
    selectedLayers,
    fieldSelected,
    setSelection,
    update,
    updateLayers,
    actions,
    history,
  };
}


export type Studio = ReturnType<typeof useStudio>;

/** Light emblems read best with a dark outline and the other way round. */
export const outlineFor = (hex: string) => (luminance(hex) > 0.4 ? '#000000' : '#FFFFFF');
