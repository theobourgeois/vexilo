'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getTopContributorsThisWeek, type TopContributor } from '@/actions/leaderboard';
import { ArrowRight } from '@/components/icons';
import FlagImage from '@/components/FlagImage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TODAY_CARD, TodayCardText } from '@/components/today-card';
import { cn } from '@/lib/utils';

const MEDAL_COLORS = ['bg-[#d99a0b]', 'bg-[#9a9fa8]', 'bg-[#c0743f]'];
const CLOSE_DELAY_MS = 150;

function initials(name: string, count: number) {
  return name
    .split(/\s+/)
    .slice(0, count)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function ContributorAvatar({
  contributor,
  stacked,
  covered,
  className,
}: {
  contributor: TopContributor;
  /** In the overlapping stack, where only one initial fits. */
  stacked?: boolean;
  /** The next avatar in the stack covers its right edge. */
  covered?: boolean;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {contributor.image && <AvatarImage src={contributor.image} alt='' className='object-cover' />}
      <AvatarFallback className={cn(covered && 'pr-1')}>{initials(contributor.name, stacked ? 1 : 2)}</AvatarFallback>
    </Avatar>
  );
}

/** "Oct 15 – 21", or "Sep 28 – Oct 4" across a month. */
function weekRange() {
  const until = new Date();
  const since = new Date(until);
  since.setDate(until.getDate() - 6);
  const day = (date: Date) => date.toLocaleDateString('en-US', { day: 'numeric' });
  const monthDay = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${monthDay(since)} – ${since.getMonth() === until.getMonth() ? day(until) : monthDay(until)}`;
}

/** This week's top three contributors in the Today row on Browse; hover or tap to see who they are. */
export function TopContributorsLink({ className }: { className?: string }) {
  const { data: contributors } = useQuery({
    queryKey: ['topContributorsWeek'],
    queryFn: getTopContributorsThisWeek,
    staleTime: 10 * 60 * 1000,
  });
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointerType = React.useRef('');

  React.useEffect(() => () => clearTimeout(closeTimer.current), []);

  if (!contributors?.length) return null;

  const hoverOpen = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const firstNames = contributors.map((contributor) => contributor.name.split(/\s+/)[0]);
  const names = `${firstNames.slice(0, -1).join(', ')} & ${firstNames.at(-1)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Top contributors this week: ${names}`}
        className={cn(TODAY_CARD, 'cursor-pointer', className)}
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
        onClick={(event) => {
          // A mouse already opened it on hover, so a click shouldn't close it again.
          event.preventDefault();
          if (pointerType.current === 'mouse') setOpen(true);
          else setOpen((wasOpen) => !wasOpen);
          pointerType.current = '';
        }}
      >
        <span className='flex w-[62px] shrink-0 items-center justify-center'>
          {contributors.map((contributor, index) => (
            <ContributorAvatar
              key={contributor.userNumber}
              contributor={contributor}
              stacked
              covered={index < contributors.length - 1}
              className={cn('size-[28px] shadow-[0_0_0_2.5px_var(--surface)]', index > 0 && '-ml-[9px]')}
            />
          ))}
        </span>
        <TodayCardText label='Top this week' title={names} />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        sideOffset={8}
        className='w-[360px] max-w-[calc(100vw-24px)] bg-surface-hi p-1.5'
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className='flex items-baseline justify-between px-2.5 pb-1.5 pt-2 text-xs text-muted-foreground'>
          <span className='text-[13px] font-semibold text-foreground'>Top contributors</span>
          <span>{weekRange()}</span>
        </div>
        <ol>
          {contributors.map((contributor, index) => (
            <li key={contributor.userNumber}>
              <Link
                href={`/profile/${contributor.userNumber}`}
                className='flex items-center gap-3 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-foreground/[0.05]'
              >
                <span className='relative shrink-0'>
                  <ContributorAvatar contributor={contributor} className='size-[34px]' />
                  <span
                    className={cn(
                      'absolute -bottom-[3px] -right-[3px] grid size-4 place-items-center rounded-full text-[9.5px] font-bold text-white shadow-[0_0_0_2px_var(--surface-hi)]',
                      MEDAL_COLORS[index],
                    )}
                  >
                    {index + 1}
                  </span>
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-medium'>{contributor.name}</span>
                  <span className='block whitespace-nowrap text-[11.5px] text-muted-foreground'>
                    {contributor.contributions} {contributor.contributions === 1 ? 'contribution' : 'contributions'}
                  </span>
                </span>
                <span className='flex shrink-0 items-center gap-1'>
                  {contributor.flags.map((flag) => (
                    <FlagImage key={flag.image} src={flag.image} alt={flag.name} maxHeight={18} fixed />
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <Link
          href='/leaderboard'
          className='mt-1 flex items-center gap-1.5 border-t border-line px-2.5 pb-1.5 pt-2.5 text-[13px] font-medium text-main hover:underline'
        >
          Full leaderboard
          <ArrowRight className='size-[13px]' />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
