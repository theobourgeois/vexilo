'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getCurrentContest } from '@/actions/contests';
import { ArrowRight, Trophy } from '@/components/icons';
import FlagImage from '@/components/FlagImage';
import { TODAY_CARD, TODAY_THUMB, TodayCardText } from '@/components/today-card';
import { formatContestDate, timeLeft } from '@/lib/contest';
import { cn } from '@/lib/utils';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** The design contest in the Today row on Browse, from a week before it opens until a week after the winner. */
export function ContestLink({ className }: { className?: string }) {
  const { data: contest } = useQuery({ queryKey: ['currentContest'], queryFn: getCurrentContest, staleTime: 5 * 60 * 1000 });
  if (!contest) return null;

  const now = new Date();
  const { phase } = contest;
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
      <span className={cn(TODAY_THUMB, !contest.winnerImage && 'bg-[rgb(217_154_11/0.14)]', contest.winnerImage && 'flag-stage')}>
        {contest.winnerImage ? (
          <FlagImage src={contest.winnerImage} alt='' maxHeight={30} area={46 * 30} />
        ) : (
          <Trophy className='size-5 text-[#b07c00] dark:text-[#f2c14e]' />
        )}
      </span>
      <TodayCardText label={label} title={contest.theme} />
      <ArrowRight className='size-4 shrink-0 text-main transition-transform group-hover:translate-x-0.5' />
    </Link>
  );
}
