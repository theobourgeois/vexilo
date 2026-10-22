'use client';

import React from 'react';
import type { ToolKind } from './draw';
import { alignScopes } from './regions';
import { MAX_ZOOM, type View } from './StudioCanvas';
import type { Studio } from './use-studio';
import { canEditPoints } from './vector';

export type Panel = 'layout' | 'emblems' | 'colors' | 'layers';
const PANELS: Panel[] = ['layout', 'emblems', 'colors', 'layers'];

/**
 * Design-tool keyboard shortcuts: undo/redo, clipboard, duplicate, delete, nudge, arrange,
 * flip, resize, zoom, select all, cycle selection, tools, point editing and panel switching.
 */
export function useShortcuts(
  studio: Studio,
  options: {
    setView: React.Dispatch<React.SetStateAction<View>>;
    onExport: () => void;
    /** Images pasted from the system clipboard. Returns whether it used them. */
    onPasteFiles?: (files: File[]) => Promise<boolean>;
    setPanel?: (panel: Panel) => void;
    tool?: ToolKind;
    setTool?: (tool: ToolKind) => void;
    /** How far an arrow key nudges, in flag units; shift goes ten times as far. */
    nudgeStep?: () => number;
    enabled: boolean;
  },
) {
  const latest = React.useRef({ studio, options });
  latest.current = { studio, options };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { studio, options } = latest.current;
      if (!options.enabled) return;
      // Key events can target the document itself when nothing has focus.
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const { actions, history } = studio;
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };

      // Editing a path's points: keys move, drop and pick its nodes rather than whole emblems.
      const editing = studio.pathEdit;
      if (editing) {
        if (mod && key === 'a') return run(actions.selectAllNodes);
        if (!mod && (key === 'backspace' || key === 'delete')) return run(actions.deleteNodes);
        if (key === 'escape' || key === 'enter') return run(actions.stopEditing);
        const step = (options.nudgeStep?.() ?? 0.004) * (e.shiftKey ? 10 : 1);
        const nudge = ({ arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] } as const)[key as 'arrowleft'];
        if (nudge && editing.nodes.length) return run(() => actions.nudgeNodes(nudge[0], nudge[1]));
      }

      if (mod) {
        if (key === 'z') return run(e.shiftKey ? history.redo : history.undo);
        if (key === 'y') return run(history.redo);
        if (key === 'c') return run(actions.copy);
        if (key === 'x') return run(actions.cut);
        // ⌘V is left to the paste event, which can also bring in images.
        if (key === 'v') return;
        if (key === 'd') return run(() => actions.duplicateSelected());
        if (key === 'a') return run(actions.selectAll);
        if (key === 'e') return run(options.onExport);
        if (key === 's') return run(() => undefined);
        if (key === ']') return run(() => actions.arrange(e.shiftKey ? 'front' : 1));
        if (key === '[') return run(() => actions.arrange(e.shiftKey ? 'back' : -1));
        if (key === '0') return run(() => options.setView({ zoom: 1, panX: 0, panY: 0 }));
        if (key === '=' || key === '+') {
          return run(() => options.setView((v) => {
            const zoom = Math.min(MAX_ZOOM, v.zoom * 1.25);
            return { zoom, panX: (v.panX * zoom) / v.zoom, panY: (v.panY * zoom) / v.zoom };
          }));
        }
        if (key === '-') return run(() => options.setView((v) => ({ zoom: Math.max(0.2, v.zoom / 1.25), panX: v.panX / 1.25, panY: v.panY / 1.25 })));
        return;
      }

      // Alt + WASD/H/V aligns: several emblems to each other, one to the region it's in.
      if (e.altKey) {
        const edge = ({ KeyA: 'left', KeyD: 'right', KeyW: 'top', KeyS: 'bottom', KeyH: 'centre', KeyV: 'middle' } as const)[e.code as 'KeyA'];
        if (edge && studio.selectedLayers.length) {
          const scope = alignScopes(studio.design, studio.selectedLayers.filter((l) => !l.locked && !l.hidden))[0];
          return run(() => actions.align(edge, scope.box));
        }
      }
      if (key === 'backspace' || key === 'delete') return run(actions.deleteSelected);
      if (key === 'enter' && studio.selectedLayers.length === 1 && canEditPoints(studio.selectedLayers[0])) return run(() => actions.editPoints());
      if (key === 'escape') return run(() => (options.tool && options.tool !== 'select' ? options.setTool?.('select') : studio.setSelection([])));
      if (options.setTool && !e.shiftKey && !e.altKey) {
        const tool = ({ v: 'select', u: 'shape', b: 'brush', p: 'pen' } as const)[key as 'v'];
        if (tool) return run(() => options.setTool!(tool));
      }
      if (key === 'tab') return run(() => actions.selectNext(e.shiftKey ? -1 : 1));
      if (e.shiftKey && key === 'h') return run(() => actions.flip('x'));
      if (e.shiftKey && key === 'v') return run(() => actions.flip('y'));
      if (key === ']') return run(() => actions.scaleBy(1.08));
      if (key === '[') return run(() => actions.scaleBy(1 / 1.08));
      const step = (options.nudgeStep?.() ?? 0.004) * (e.shiftKey ? 10 : 1);
      if (key === 'arrowleft') return run(() => actions.nudge(-step, 0));
      if (key === 'arrowright') return run(() => actions.nudge(step, 0));
      if (key === 'arrowup') return run(() => actions.nudge(0, -step));
      if (key === 'arrowdown') return run(() => actions.nudge(0, step));
      const panel = PANELS[Number(key) - 1];
      if (panel && options.setPanel) return run(() => options.setPanel!(panel));
    };
    const onPaste = async (e: ClipboardEvent) => {
      const { studio, options } = latest.current;
      if (!options.enabled) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      e.preventDefault();
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length && options.onPasteFiles && (await options.onPasteFiles(files))) return;
      studio.actions.paste();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, []);
}
