'use client';

import React from 'react';
import { alignScopes } from './regions';
import type { View } from './StudioCanvas';
import type { Studio } from './use-studio';

export type Panel = 'layout' | 'emblems' | 'colors' | 'layers';
const PANELS: Panel[] = ['layout', 'emblems', 'colors', 'layers'];

/**
 * Design-tool keyboard shortcuts: undo/redo, clipboard, duplicate, delete, nudge, arrange,
 * flip, resize, zoom, select all, cycle selection and panel switching.
 */
export function useShortcuts(
  studio: Studio,
  options: {
    setView: React.Dispatch<React.SetStateAction<View>>;
    onExport: () => void;
    setPanel?: (panel: Panel) => void;
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

      if (mod) {
        if (key === 'z') return run(e.shiftKey ? history.redo : history.undo);
        if (key === 'y') return run(history.redo);
        if (key === 'c') return run(actions.copy);
        if (key === 'x') return run(actions.cut);
        if (key === 'v') return run(actions.paste);
        if (key === 'd') return run(() => actions.duplicateSelected());
        if (key === 'a') return run(actions.selectAll);
        if (key === 'e') return run(options.onExport);
        if (key === 's') return run(() => undefined);
        if (key === ']') return run(() => actions.arrange(e.shiftKey ? 'front' : 1));
        if (key === '[') return run(() => actions.arrange(e.shiftKey ? 'back' : -1));
        if (key === '0') return run(() => options.setView({ zoom: 1, panX: 0, panY: 0 }));
        if (key === '=' || key === '+') return run(() => options.setView((v) => ({ zoom: Math.min(12, v.zoom * 1.25), panX: v.panX * 1.25, panY: v.panY * 1.25 })));
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
      if (key === 'escape') return run(() => studio.setSelection([]));
      if (key === 'tab') return run(() => actions.selectNext(e.shiftKey ? -1 : 1));
      if (e.shiftKey && key === 'h') return run(() => actions.flip('x'));
      if (e.shiftKey && key === 'v') return run(() => actions.flip('y'));
      if (key === ']') return run(() => actions.scaleBy(1.08));
      if (key === '[') return run(() => actions.scaleBy(1 / 1.08));
      const step = e.shiftKey ? 0.025 : 0.004;
      if (key === 'arrowleft') return run(() => actions.nudge(-step, 0));
      if (key === 'arrowright') return run(() => actions.nudge(step, 0));
      if (key === 'arrowup') return run(() => actions.nudge(0, -step));
      if (key === 'arrowdown') return run(() => actions.nudge(0, step));
      const panel = PANELS[Number(key) - 1];
      if (panel && options.setPanel) return run(() => options.setPanel!(panel));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
