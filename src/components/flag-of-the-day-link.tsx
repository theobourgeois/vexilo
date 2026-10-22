'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getFlagOfTheDay } from '@/actions/flags';
import FlagImage from '@/components/FlagImage';
import { TODAY_CARD, TODAY_THUMB, TodayCardText } from '@/components/today-card';
import { cn } from '@/lib/utils';

/** Flag of the day in the Today row on Browse, linking to its flag page. */
export function FlagOfTheDayLink({ className }: { className?: string }) {
  const { data: flag } = useQuery({
    queryKey: ['flagOfTheDay'],
    queryFn: getFlagOfTheDay,
    staleTime: 10 * 60 * 1000,
  });

  if (!flag) return <div className={cn('vx-tile h-[60px] animate-pulse', className)} />;

  return (
    <Link
      href={`/flag/${encodeURIComponent(flag.name)}`}
      aria-label={`Flag of the day: ${flag.name}`}
      className={cn(TODAY_CARD, className)}
    >
      <span className={cn(TODAY_THUMB, 'flag-stage')}>
        <FlagImage src={flag.image} alt='' maxHeight={30} area={46 * 30} />
      </span>
      <TodayCardText label='Flag of the day' title={flag.name} />
    </Link>
  );
}
