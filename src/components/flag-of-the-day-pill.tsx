'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFlagOfTheDay, toggleFavoriteFlag } from '@/actions/flags';
import { ArrowRight, ChevronDown, Heart } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import FlagImage from '@/components/FlagImage';
import { toastErrorWithLogin } from '@/lib/toast-auth';
import { cn } from '@/lib/utils';

/** "FOTD · Bhutan" in the header, opening a small preview of the flag of the day. */
export function FlagOfTheDayPill({ className }: { className?: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);
  const { data: flag } = useQuery({
    queryKey: ['flagOfTheDay'],
    queryFn: getFlagOfTheDay,
    staleTime: 10 * 60 * 1000,
  });
  const [isFavorite, setIsFavorite] = React.useState(false);

  React.useEffect(() => {
    setIsFavorite(Boolean(flag?.isFavorite));
  }, [flag?.isFavorite, flag?.id]);

  if (!flag) return <div className={cn('h-[38px] w-[150px]', className)} />;

  const href = `/flag/${encodeURIComponent(flag.name)}`;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const toggleFavorite = async () => {
    if (!session?.user) {
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
    queryClient.invalidateQueries({ queryKey: ['flags'], refetchType: 'none' });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={`Flag of the day: ${flag.name}`}
          className={cn(
            'vx-key flex h-[38px] min-w-0 cursor-pointer items-center gap-2 rounded-full py-0 pl-1.5 pr-2.5 text-[13px] transition-shadow hover:shadow-key-press',
            isOpen && 'shadow-[var(--sh-key),0_0_0_3px_var(--main-soft)]',
            className,
          )}
        >
          <span className='flag-stage grid h-[26px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-[6px] bg-stage'>
            <FlagImage src={flag.image} alt='' maxHeight={20} area={30 * 20} />
          </span>
          <span className='min-w-0 truncate'>
            <span className='text-muted-foreground'>FOTD</span>{' '}
            <span className='hidden font-medium sm:inline'>{flag.name}</span>
          </span>
          <ChevronDown className='size-3.5 shrink-0 text-muted-foreground' />
        </button>
      </PopoverTrigger>
      <PopoverContent align='end' sideOffset={8} className='w-[320px] p-2'>
        <Link href={href} onClick={() => setIsOpen(false)} className='flag-stage block h-[170px] rounded-[11px] bg-stage p-6'>
          <FlagImage src={flag.image} alt={flag.name} maxHeight={110} area={165 * 110} eager />
        </Link>
        <div className='px-2 pb-1.5 pt-3'>
          <p className='text-xs text-muted-foreground'>Flag of the day · {today}</p>
          <Link href={href} onClick={() => setIsOpen(false)} className='mt-0.5 block text-[19px] font-semibold tracking-[-0.02em] hover:underline hover:underline-offset-4'>
            {flag.name}
          </Link>
          {flag.description && <p className='mt-1 line-clamp-2 text-[13px] leading-relaxed text-subtle'>{flag.description}</p>}
        </div>
        <div className='flex gap-2 px-2 pb-1.5 pt-1.5'>
          <Button asChild size='sm' className='flex-1'>
            <Link href={href} onClick={() => setIsOpen(false)}>
              Open
              <ArrowRight />
            </Link>
          </Button>
          <Button
            variant='neutral'
            size='icon-sm'
            onClick={toggleFavorite}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
          >
            <Heart weight={isFavorite ? 'fill' : 'bold'} className={cn(isFavorite && 'text-main')} />
          </Button>
          <Button asChild variant='neutral' size='sm'>
            <Link href='/flag-of-the-day' onClick={() => setIsOpen(false)}>
              Past days
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
