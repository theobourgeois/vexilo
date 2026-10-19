'use client';

import React from 'react';

const LIMIT = 200;

type State<T> = { past: T[]; present: T; future: T[]; /** Where an in-progress gesture started. */ base: T | null };

/**
 * Undoable state. Transient updates (a drag, a slider) change the present without a history
 * entry; `commit` then records the whole gesture as one step.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = React.useState<State<T>>({ past: [], present: initial, future: [], base: null });

  const set = React.useCallback((updater: T | ((prev: T) => T), options?: { transient?: boolean }) => {
    setState((s) => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(s.present) : updater;
      if (next === s.present) return s;
      if (options?.transient) return { ...s, present: next, base: s.base ?? s.present };
      return { past: [...s.past, s.base ?? s.present].slice(-LIMIT), present: next, future: [], base: null };
    });
  }, []);

  const commit = React.useCallback(() => {
    setState((s) => {
      if (s.base === null) return s;
      if (s.base === s.present) return { ...s, base: null };
      return { past: [...s.past, s.base].slice(-LIMIT), present: s.present, future: [], base: null };
    });
  }, []);

  const undo = React.useCallback(() => {
    setState((s) => {
      const past = s.base === null ? s.past : [...s.past, s.base];
      if (past.length === 0) return s;
      return { past: past.slice(0, -1), present: past[past.length - 1], future: [s.present, ...s.future], base: null };
    });
  }, []);

  const redo = React.useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      return { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), base: null };
    });
  }, []);

  const reset = React.useCallback((value: T) => setState({ past: [], present: value, future: [], base: null }), []);

  return {
    present: state.present,
    set,
    commit,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0 || state.base !== null,
    canRedo: state.future.length > 0,
  };
}
