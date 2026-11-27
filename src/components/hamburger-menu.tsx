'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Coffee, Flag, Gamepad2, Home, Menu, PaintBrush, Plus, SquaresFour, Trophy, TrendUp, Users } from '@/components/icons';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from './ui/drawer';
import { AuthHeader } from './auth-header';
import { ThemeToggle } from './theme-toggle';
import Logo from './Logo';
import { useCurrentContest } from './contest-link';
import { PendingDot, useDailyPending } from '@/components/games/shared';
import { timeLeft } from '@/lib/contest';
import { cn } from '@/lib/utils';

const ROW =
  'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-muted-foreground';
const ACTIVE = 'bg-foreground/[0.07] text-foreground';

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const dailyPending = useDailyPending();

  return (
    <Drawer direction='right' open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant='neutral' size='icon' className='relative shrink-0 lg:hidden' aria-label='Open menu'>
          <Menu />
          {dailyPending && <PendingDot className='absolute right-[7px] top-[7px]' />}
        </Button>
      </DrawerTrigger>
      <DrawerContent className='p-0 data-[vaul-drawer-direction=right]:w-[86vw] data-[vaul-drawer-direction=right]:max-w-[320px]'>
        <DrawerTitle className='sr-only'>Menu</DrawerTitle>
        <MenuBody close={() => setOpen(false)} dailyPending={dailyPending} />
      </DrawerContent>
    </Drawer>
  );
}

/** Mounted only while the drawer is open, so the contest lookup doesn't run on every page. */
function MenuBody({ close, dailyPending }: { close: () => void; dailyPending: boolean }) {
  const pathname = usePathname();
  const { status } = useSession();
  const contest = useCurrentContest();

  const contestNote = !contest
    ? 'Design contests'
    : contest.phase === 'open'
      ? `Taking entries, ${timeLeft(contest.votingStartsAt)} left`
      : contest.phase === 'voting'
        ? `Voting, ${timeLeft(contest.endsAt)} left`
        : contest.phase === 'upcoming'
          ? `Next one starts in ${timeLeft(contest.startsAt)}`
          : 'Past winners';

  const items = [
    { href: '/', label: 'Home', icon: <Home /> },
    { href: '/browse', label: 'Browse flags', note: 'Real flags', icon: <SquaresFour /> },
    { href: '/community', label: 'Community', note: 'Member designs', icon: <Users /> },
    { href: '/create', label: 'Create', note: 'Flag maker', icon: <PaintBrush /> },
    { href: '/play', label: 'Play', note: 'Unfurl, Vexigrid, quiz', icon: <Gamepad2 />, dot: dailyPending },
    { href: '/contest', label: 'Contest', note: contestNote, icon: <Trophy /> },
    { href: '/leaderboard', label: 'Leaderboard', note: 'Top creators', icon: <TrendUp /> },
    ...(status === 'authenticated' ? [{ href: '/my-flags', label: 'My flags', icon: <Flag /> }] : []),
  ];

  return (
    <div className='flex min-h-dvh flex-col px-4 pb-4 pt-5'>
      <div className='flex items-center justify-between gap-3 border-b border-line pb-4'>
        <Logo />
        <div className='flex items-center gap-2'>
          <ThemeToggle />
          <AuthHeader />
        </div>
      </div>

      <nav className='space-y-0.5 py-3'>
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={close} className={cn(ROW, active && ACTIVE)}>
              {item.icon}
              <span className='min-w-0 flex-1'>
                <span className='flex items-center gap-2'>
                  {item.label}
                  {item.dot && <PendingDot />}
                </span>
                {item.note && <span className='block truncate text-[12.5px] font-normal text-muted-foreground'>{item.note}</span>}
              </span>
            </Link>
          );
        })}
        <a href='https://buymeacoffee.com/theobourgeois' target='_blank' rel='noopener noreferrer' onClick={close} className={ROW}>
          <Coffee />
          Donate
        </a>
      </nav>

      <div className='mt-auto grid gap-2 border-t border-line pt-4'>
        <Button asChild size='lg' className='w-full'>
          <Link href='/create' onClick={close}>
            <Plus />
            Post your design
          </Link>
        </Button>
        <Button asChild size='lg' variant='neutral' className='w-full'>
          <Link href='/post-flag' onClick={close}>
            Add a real flag
          </Link>
        </Button>
      </div>
    </div>
  );
}
