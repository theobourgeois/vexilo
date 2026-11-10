'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while React is attaching to HTML the server sent, true from then on (and from the start
 * for anything rendered in the browser). Lets a component hold back what the server couldn't have
 * rendered, such as signed-in controls, until its markup has been matched. Parts of a page that
 * stream in late can otherwise meet a session that loaded first, fail to match and be rebuilt.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
