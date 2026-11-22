'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getCurrentContest } from '@/actions/contests';
import { ArrowRight, Trophy, X } from '@/components/icons';
import FlagImage from '@/components/FlagImage';
import { PhasePill } from '@/components/contest/contest-ui';
import { Button } from '@/components/ui/button';
import { TODAY_CARD, TODAY_THUMB, TodayCardText } from '@/components/today-card';
import { CONTEST_ART, formatContestDate, timeLeft } from '@/lib/contest';
import { cn } from '@/lib/utils';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const HIDDEN_KEY = 'vexilo-vote-banner-hidden';

type CurrentContest = NonNullable<Awaited<ReturnType<typeof getCurrentContest>>>;

export function useCurrentContest() {
  const { data } = useQuery({ queryKey: ['currentContest'], queryFn: getCurrentContest, staleTime: 5 * 60 * 1000 });
  return data ?? null;
}

/**
 * Whether the voting banner shows for this contest. Hiding it lasts until the final day of voting.
 * Null until the browser has been read, so the banner doesn't flash for people who hid it.
 */
export function useVoteBanner(contest: CurrentContest | null) {
  const [hiddenFor, setHiddenFor] = React.useState<string | null | undefined>(undefined);
  React.useEffect(() => {
    try {
      setHiddenFor(localStorage.getItem(HIDDEN_KEY));
    } catch {
      setHiddenFor(null);
    }
  }, []);

  const hide = React.useCallback(() => {
    if (!contest) return;
    setHiddenFor(contest.slug);
    try {
      localStorage.setItem(HIDDEN_KEY, contest.slug);
    } catch {
      // Private browsing can refuse storage; it just comes back next visit.
    }
  }, [contest]);

  if (!contest || contest.phase !== 'voting' || hiddenFor === undefined) return { show: false, hide };
  const lastDay = contest.endsAt.getTime() - Date.now() < DAY;
  return { show: hiddenFor !== contest.slug || lastDay, hide };
}

/** A wide banner above the Today row on Browse while the contest is taking votes. */
export function ContestVoteBanner({ contest, onHide }: { contest: CurrentContest; onHide: () => void }) {
  const art = CONTEST_ART[contest.slug];
  const href = `/contest/${contest.slug}`;
  const picks = contest.votesPerVoter === 1 ? 'pick your favorite' : `pick your ${contest.votesPerVoter} favorites`;

  return (
    <div className='vx-tile group relative flex flex-col gap-3 p-2 transition-[box-shadow] duration-300 hover:shadow-tile-hover sm:flex-row sm:items-center sm:gap-5 sm:pr-3'>
      <Link href={href} aria-label={`Vote in ${contest.theme}`} className='absolute inset-0 rounded-[16px]' />

      <div className='flex h-[84px] shrink-0 items-center justify-center gap-2.5 overflow-hidden rounded-[11px] bg-stage px-4 sm:w-[300px]'>
        {contest.previews.length ? (
          contest.previews.map((src) => (
            <span key={src} className='flag-stage h-[44px] w-[60px] shrink-0'>
              <FlagImage src={src} alt='' maxHeight={44} area={60 * 40} />
            </span>
          ))
        ) : art ? (
          <Image src={art} alt='' width={300} height={158} className='-mx-4 h-full w-[calc(100%+2rem)] max-w-none object-cover object-top' />
        ) : (
          <Trophy className='size-6 text-[#b07c00] dark:text-[#f2c14e]' />
        )}
      </div>

      <div className='min-w-0 flex-1 px-1.5 sm:px-0'>
        <div className='flex items-center gap-2'>
          <PhasePill phase='voting' />
          <span className='text-[12.5px] tabular-nums text-muted-foreground'>{timeLeft(contest.endsAt)} left</span>
        </div>
        <p className='mt-1.5 truncate text-[17px] font-semibold tracking-[-0.01em]'>{contest.theme}</p>
        <p className='truncate text-[13px] text-subtle'>
          {contest.entryCount} {contest.entryCount === 1 ? 'flag' : 'flags'} entered · {picks}
        </p>
      </div>

      <Button asChild size='lg' className='relative w-full sm:w-auto'>
        <Link href={href}>
          Vote now <ArrowRight />
        </Link>
      </Button>

      <button
        type='button'
        onClick={onHide}
        aria-label='Hide'
        className='absolute right-3.5 top-3.5 grid size-7 cursor-pointer place-items-center rounded-full bg-surface/80 text-muted-foreground hover:text-foreground sm:static sm:bg-transparent'
      >
        <X className='size-4' />
      </button>
    </div>
  );
}

/** The design contest in the Today row on Browse, from a week before it opens until a week after the winner. */
export function ContestLink({ contest, className }: { contest: CurrentContest | null; className?: string }) {
  if (!contest) return null;

  const now = new Date();
  const { phase } = contest;
  const art = CONTEST_ART[contest.slug];
  if (phase === 'upcoming' && contest.startsAt.getTime() - now.getTime() > WEEK) return null;
  if (phase === 'results' && (!contest.announcedAt || now.getTime() - contest.announcedAt.getTime() > WEEK)) return null;

  const label =
    phase === 'upcoming'
      ? `Contest opens ${formatContestDate(contest.startsAt)}`
      : phase === 'open'
        ? `Design contest · ${timeLeft(contest.votingStartsAt, now)} left`
        : phase === 'voting'
          ? `Vote now · ${timeLeft(contest.endsAt, now)} left`
          : phase === 'judging'
            ? 'Contest · winner soon'
            : 'Contest winner';

  return (
    <Link href={`/contest/${contest.slug}`} className={cn(TODAY_CARD, className)}>
      <span className={cn(TODAY_THUMB, !contest.winnerImage && !art && 'bg-[rgb(217_154_11/0.14)]', contest.winnerImage && 'flag-stage')}>
        {contest.winnerImage ? (
          <FlagImage src={contest.winnerImage} alt='' maxHeight={30} area={46 * 30} />
        ) : art ? (
          <Image src={art} alt='' width={105} height={55} className='h-[55px] w-[105px] max-w-none self-start justify-self-start' />
        ) : (
          <Trophy className='size-5 text-[#b07c00] dark:text-[#f2c14e]' />
        )}
      </span>
      <TodayCardText label={label} title={contest.theme} />
      <ArrowRight className='size-4 shrink-0 text-main transition-transform group-hover:translate-x-0.5' />
    </Link>
  );
}
