'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { getLiveFavorites } from '@/actions/collections';

/**
 * The signed-in visitor's favorites for these flags, fetched from the browser. Pages that are
 * rendered once and shared between visitors (the flag page) carry the cached counts and nobody's
 * marks; this fills in the rest.
 *
 * `live` is null for visitors who aren't signed in. `pending` is true while a signed-in visitor's
 * marks are still loading, when a heart can't yet be trusted.
 */
export function useLiveFavorites(flagIds: string[]) {
  const { status } = useSession();
  const enabled = status === 'authenticated' && flagIds.length > 0;
  const { data, isPending } = useQuery({
    // Under 'flags' so a favorite toggle marks it stale, like the flag lists.
    queryKey: ['flags', 'liveFavorites', flagIds],
    queryFn: () => getLiveFavorites(flagIds),
    enabled,
    // Not kept after leaving the page: a remembered answer could predate a toggle.
    gcTime: 0,
  });

  return { live: (enabled && data) || null, pending: enabled && isPending };
}
