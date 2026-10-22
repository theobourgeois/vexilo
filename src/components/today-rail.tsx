'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle } from '@/components/icons';
import { ContestLink } from '@/components/contest-link';
import { FlagOfTheDayLink } from '@/components/flag-of-the-day-link';
import { TopContributorsLink } from '@/components/top-contributors-link';
import { GridArt, UnfurlArt } from '@/components/games/art';
import { useDoneToday } from '@/components/games/shared';
import { TODAY_CARD, TODAY_THUMB, TodayCardText } from '@/components/today-card';
import { localDate, puzzleNumber } from '@/lib/games/daily';
import { cn } from '@/lib/utils';

const PUZZLES = [
  { game: 'unfurl', href: '/play/unfurl', title: 'Unfurl', art: <UnfurlArt className='h-[30px]' /> },
  { game: 'grid', href: '/play/grid', title: 'Vexigrid', art: <span className='scale-[0.72]'><GridArt small /></span> },
] as const;

const CARD = 'w-[244px] shrink-0 snap-start lg:w-auto';

function PuzzleCard({ puzzle, number }: { puzzle: (typeof PUZZLES)[number]; number: number | null }) {
  const done = useDoneToday(`vexilo-${puzzle.game}`);
  return (
    <Link href={puzzle.href} className={cn(TODAY_CARD, CARD)}>
      <span className={TODAY_THUMB}>{puzzle.art}</span>
      <TodayCardText label={number ? `Daily #${number}` : 'Daily puzzle'} title={puzzle.title} />
      {done ? (
        <CheckCircle aria-label='Done' className='size-4 shrink-0 text-good' />
      ) : (
        <ArrowRight className='size-4 shrink-0 text-main transition-transform group-hover:translate-x-0.5' />
      )}
    </Link>
  );
}

/** Flag of the day, the design contest, today's puzzles and the week's top contributors, between the Browse title and search. */
export function TodayRail({ className }: { className?: string }) {
  // The puzzle number follows the player's own day, which the server can't know.
  const [number, setNumber] = React.useState<number | null>(null);
  React.useEffect(() => setNumber(puzzleNumber(localDate())), []);

  return (
    <div
      className={cn(
        // A swipeable strip on phones and tablets; one even row on desktop.
        '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8 lg:mx-0 lg:grid lg:auto-cols-fr lg:grid-flow-col lg:gap-3 lg:overflow-visible lg:px-0',
        className,
      )}
    >
      <FlagOfTheDayLink className={CARD} />
      <ContestLink className={CARD} />
      {PUZZLES.map((puzzle) => (
        <PuzzleCard key={puzzle.game} puzzle={puzzle} number={number} />
      ))}
      <TopContributorsLink className={CARD} />
    </div>
  );
}
