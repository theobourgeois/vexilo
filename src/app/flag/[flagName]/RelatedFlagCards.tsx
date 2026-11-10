'use client';

import FlagCard from '@/components/FlagCard';
import { useLiveFavorites } from '@/hooks/useLiveFavorites';
import type { Flag } from '@/lib/types';

/** The related flags as the page has them (the same for everyone), with the visitor's own favorites added. */
export default function RelatedFlagCards({ flags }: { flags: Flag[] }) {
  const { live, pending } = useLiveFavorites(flags.map((flag) => flag.id));

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {flags.map((flag) => {
        const mine = live?.get(flag.id);
        return (
          <FlagCard
            key={flag.id}
            {...flag}
            favorites={mine?.favorites ?? flag.favorites}
            isFavorite={mine?.isFavorite ?? false}
            favoritesPending={pending}
          />
        );
      })}
    </div>
  );
}
