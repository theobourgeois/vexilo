'use client';

import { signIn } from 'next-auth/react';

/** Open the provider chooser without losing an editor draft or the current page. */
export const openSignIn = () =>
  signIn(undefined, { callbackUrl: window.location.href });

export function safeCallbackUrl(value: string | null, origin: string) {
  try {
    const url = new URL(value || '/', origin);
    if (url.origin !== origin || url.pathname === '/signin') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
