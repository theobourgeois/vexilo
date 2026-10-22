'use client';

import React from 'react';
import { countdownParts, PHASE_LABEL, type ContestPhase } from '@/lib/contest';
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

/** The current time, ticking every second; null until mounted so server and browser agree. */
function useNow() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** A big "13 : 06 : 22" clock. Seconds only show on the last day. */
export function Countdown({ to, className }: { to: Date; className?: string }) {
  const now = useNow();
  const parts = now ? countdownParts(to, now) : null;
  const cells: [string, number | undefined][] =
    parts && parts.days === 0
      ? [
          ['hrs', parts.hours],
          ['min', parts.minutes],
          ['sec', parts.seconds],
        ]
      : [
          ['days', parts?.days],
          ['hrs', parts?.hours],
          ['min', parts?.minutes],
        ];
  return (
    <div className={cn('flex items-start gap-2.5 sm:gap-3.5', className)} role='timer'>
      {cells.map(([label, value], index) => (
        <React.Fragment key={label}>
          {index > 0 && <span className='pt-0.5 text-[22px] leading-none opacity-35 sm:text-[28px]'>:</span>}
          <span className='flex flex-col items-center'>
            <span className='text-[28px] font-semibold leading-none tabular-nums tracking-[-0.03em] sm:text-[34px]'>
              {value === undefined ? '––' : String(value).padStart(2, '0')}
            </span>
            <span className='mt-1.5 text-[10.5px] uppercase tracking-[0.08em] opacity-60'>{label}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/** "3d 14h 22m" until `to`. */
export function CountdownText({ to, className }: { to: Date; className?: string }) {
  const now = useNow();
  const parts = now ? countdownParts(to, now) : null;
  const text = !parts
    ? '–'
    : parts.days > 0
      ? `${parts.days}d ${parts.hours}h ${parts.minutes}m`
      : `${parts.hours}h ${parts.minutes}m ${parts.seconds}s`;
  return (
    <span className={cn('tabular-nums', className)} role='timer'>
      {text}
    </span>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
