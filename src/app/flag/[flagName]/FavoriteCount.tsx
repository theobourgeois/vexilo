'use client';

import { useLiveFavorites } from '@/hooks/useLiveFavorites';

/** The flag's favorite count: the cached one from the page, or the live one for a signed-in visitor. */
export default function FavoriteCount({ flagId, cached }: { flagId: string; cached: number }) {
  const { live } = useLiveFavorites([flagId]);
  return <span className='tabular-nums'>{live?.get(flagId)?.favorites ?? cached}</span>;
}
