'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getFlagOfTheDay } from '@/actions/flags';
import { ArrowRight } from '@/components/icons';
import FlagImage from '@/components/FlagImage';
import { cn } from '@/lib/utils';

/** Flag of the day beside the Browse title, linking to its flag page. */
export function FlagOfTheDayLink({ className }: { className?: string }) {
  const { data: flag } = useQuery({
    queryKey: ['flagOfTheDay'],
    queryFn: getFlagOfTheDay,
    staleTime: 10 * 60 * 1000,
  });

  if (!flag) return <div className={cn('h-[64px] w-[240px]', className)} />;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <Link
      href={`/flag/${encodeURIComponent(flag.name)}`}
      aria-label={`Flag of the day: ${flag.name}`}
      className={cn(
        'group flex min-w-0 items-center gap-3.5 rounded-[12px] p-1.5 pr-2.5 transition-colors hover:bg-foreground/[0.05]',
        className,
      )}
    >
      <span className='flag-stage grid h-[52px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-[9px] bg-stage'>
        <FlagImage src={flag.image} alt='' maxHeight={38} area={58 * 38} />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block text-xs text-muted-foreground'>Flag of the day · {today}</span>
        <span className='mt-0.5 block truncate text-[15px] font-medium'>{flag.name}</span>
      </span>
      <ArrowRight className='ml-1 size-4 shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-foreground' />
    </Link>
  );
}
