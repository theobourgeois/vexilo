'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFlagOfTheDay, toggleFavoriteFlag } from '@/actions/flags';
import { ArrowRight, Heart } from '@/components/icons';
import { Button } from '@/components/ui/button';
import FlagImage from '@/components/FlagImage';
import { toastErrorWithLogin } from '@/lib/toast-auth';
import { cn } from '@/lib/utils';

/** Featured first tile of the browse grid. */
export function FlagOfTheDayTile({ className }: { className?: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: flag } = useQuery({
    queryKey: ['flagOfTheDay'],
    queryFn: getFlagOfTheDay,
  });
  const [isFavorite, setIsFavorite] = React.useState(false);

  React.useEffect(() => {
    setIsFavorite(Boolean(flag?.isFavorite));
  }, [flag?.isFavorite, flag?.id]);

  const toggleFavorite = async () => {
    if (!session?.user || !flag) {
      toastErrorWithLogin('You must be logged in to favorite a flag');
      return;
    }
    const previous = isFavorite;
    setIsFavorite(!previous);
    const ok = await toggleFavoriteFlag(flag.id, true);
    if (!ok) {
      setIsFavorite(previous);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['flagOfTheDay'] });
    queryClient.invalidateQueries({ queryKey: ['flags'] });
  };

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const href = flag ? `/flag/${encodeURIComponent(flag.name)}` : '#';

  return (
    <article className={cn('vx-tile flex flex-col overflow-hidden', className)}>
      <div className='bg-stage relative min-h-[300px] flex-1 lg:min-h-[360px]'>
        {flag ? (
          <Link href={href} className='flag-stage absolute inset-0 p-10 sm:p-14' aria-label={flag.name}>
            <FlagImage src={flag.image} alt={flag.name} maxHeight={300} area={460 * 300} eager />
          </Link>
        ) : (
          <div className='absolute inset-0 grid place-items-center'>
            <div className='h-[200px] w-[300px] animate-pulse rounded bg-foreground/[0.06]' />
          </div>
        )}
      </div>
      <div className='flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end'>
        <div className='min-w-0 flex-1'>
          <p className='text-[13px] text-muted-foreground'>Flag of the day, {today}</p>
          {flag ? (
            <>
              <Link href={href} className='mt-0.5 block text-[26px] font-semibold tracking-[-0.02em] hover:underline hover:underline-offset-4'>
                {flag.name}
              </Link>
              <p className='mt-0.5 tabular-nums text-[13px] text-muted-foreground'>
                #{String(flag.index).padStart(4, '0')}
                {flag.tags?.[0] ? ` · ${flag.tags[0]}` : ''}
              </p>
              {flag.description && (
                <p className='mt-2.5 line-clamp-2 max-w-[56ch] text-subtle'>{flag.description}</p>
              )}
            </>
          ) : (
            <div className='mt-1.5 space-y-2'>
              <div className='h-6 w-40 animate-pulse rounded bg-foreground/[0.06]' />
              <div className='h-4 w-64 animate-pulse rounded bg-foreground/[0.06]' />
            </div>
          )}
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button variant='ghost' asChild>
            <Link href='/flag-of-the-day'>Past days</Link>
          </Button>
          <Button
            variant='neutral'
            onClick={toggleFavorite}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
          >
            <Heart weight={isFavorite ? 'fill' : 'bold'} className={cn(isFavorite && 'text-main')} />
            {isFavorite ? 'Saved' : 'Save'}
          </Button>
          <Button variant='neutral' asChild>
            <Link href={href}>
              Open
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
