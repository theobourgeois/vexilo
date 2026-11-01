'use client';

import React from 'react';
import { formatContestDate, PHASE_LABEL, timeLeft, type ContestPhase, type ContestTiming } from '@/lib/contest';
import { cn } from '@/lib/utils';

const PHASE_TONE: Record<ContestPhase, string> = {
  draft: 'bg-foreground/[0.07] text-subtle',
  upcoming: 'bg-foreground/[0.07] text-subtle',
  open: 'bg-good-soft text-good',
  voting: 'bg-main-soft text-main',
  judging: 'bg-[rgb(217_154_11/0.14)] text-[#9a6a00] dark:text-[#f2c14e]',
  results: 'bg-[rgb(217_154_11/0.14)] text-[#9a6a00] dark:text-[#f2c14e]',
};

export function PhasePill({ phase, className }: { phase: ContestPhase; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold', PHASE_TONE[phase], className)}>
      {(phase === 'open' || phase === 'voting') && <span className='size-1.5 animate-pulse rounded-full bg-current' />}
      {PHASE_LABEL[phase]}
    </span>
  );
}

/** The current time, updated every 30 seconds; null until mounted so server and browser agree. */
function useNow() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** A contest date in the viewer's time zone, so it only renders in the browser. */
export function ContestDate({ date }: { date: Date }) {
  return useNow() && formatContestDate(date);
}

const DAY_MS = 86_400_000;
// The winner is announced by hand, so this stretch of the bar is just a short fixed one.
const WINNER_DAYS = 3;

function dateRange(from: Date, to: Date) {
  const end = from.getMonth() === to.getMonth() ? to.getDate() : formatContestDate(to);
  return `${formatContestDate(from)} – ${end}`;
}

type TimelineContest = Pick<ContestTiming, 'startsAt' | 'votingStartsAt' | 'endsAt'> & { phase: ContestPhase };

/** The schedule as a bar: each stage sized by its length, filled up to today. */
export function ContestTimeline({ contest }: { contest: TimelineContest }) {
  const now = useNow();
  const { phase, startsAt, votingStartsAt, endsAt } = contest;
  const elapsed = (from: Date, to: Date) => (now ? Math.min(1, Math.max(0, (now.getTime() - from.getTime()) / (to.getTime() - from.getTime()))) : 0);
  const closed = phase === 'voting' || phase === 'judging';

  const stages = [
    {
      days: (votingStartsAt.getTime() - startsAt.getTime()) / DAY_MS,
      fill: closed ? 1 : phase === 'open' ? elapsed(startsAt, votingStartsAt) : 0,
      active: phase === 'open',
      title: phase === 'open' ? 'Entries open now' : 'Entries',
      note:
        now &&
        (phase === 'open'
          ? `Until ${formatContestDate(votingStartsAt)} · ${timeLeft(votingStartsAt, now)} left`
          : closed
            ? `Closed ${formatContestDate(votingStartsAt)}`
            : `Opens ${formatContestDate(startsAt)}`),
    },
    {
      days: (endsAt.getTime() - votingStartsAt.getTime()) / DAY_MS,
      fill: phase === 'judging' ? 1 : phase === 'voting' ? elapsed(votingStartsAt, endsAt) : 0,
      active: phase === 'voting',
      title: phase === 'voting' ? 'Voting now' : 'Voting',
      note:
        now &&
        (phase === 'voting' ? `${timeLeft(endsAt, now)} left` : phase === 'judging' ? `Closed ${formatContestDate(endsAt)}` : dateRange(votingStartsAt, endsAt)),
    },
    {
      days: WINNER_DAYS,
      fill: 0,
      active: phase === 'judging',
      title: 'Winner',
      note: now && (phase === 'judging' ? 'Coming soon' : formatContestDate(new Date(endsAt.getTime() + DAY_MS))),
    },
  ];

  return (
    <ol className='mt-[22px] grid gap-[3px]' style={{ gridTemplateColumns: stages.map(({ days }) => `minmax(min-content, ${Math.max(days, 1)}fr)`).join(' ') }}>
      {stages.map(({ title, note, fill, active }, index) => (
        // Only the first stage is wide enough to wrap on a phone.
        <li key={title} className={cn('group text-[12.5px] text-subtle', index > 0 && 'whitespace-nowrap')}>
          <span className='block h-2 overflow-hidden bg-foreground/10 group-first:rounded-l group-last:rounded-r'>
            <span className='block h-full bg-main transition-[width] duration-500' style={{ width: `${fill * 100}%` }} />
          </span>
          <span className={cn('mt-2 block pr-2 font-semibold', active ? 'text-main' : 'text-foreground')}>{title}</span>
          <span className='block pr-2'>{note || '\u00a0'}</span>
        </li>
      ))}
    </ol>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
