'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect } from 'react';
import Logo from '@/components/Logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { PostFlagButton } from '@/components/post-flag-button';
import { AuthHeader } from '@/components/auth-header';
import { HamburgerMenu } from '@/components/hamburger-menu';
import NotificationsBell from '@/components/community/NotificationsBell';
import { cn } from '@/lib/utils';
import { PendingDot, useDailyPending } from '@/components/games/shared';
import { FOCUS_SEARCH_KEY, NAV_LINKS } from '@/lib/nav';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const dailyPending = useDailyPending();

  // Search lives on the browse page; "/" or ⌘K from anywhere else goes there with the box focused.
  // Home has its own search box, which handles the keys itself.
  useEffect(() => {
    if (pathname === '/' || pathname === '/browse') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        sessionStorage.setItem(FOCUS_SEARCH_KEY, '1');
        router.push('/browse');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname, router]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-xl backdrop-saturate-150',
        // The flag maker is full-screen on phones, with its own top bar.
        pathname.startsWith('/create') && 'max-md:hidden',
      )}
    >
      <div className='mx-auto flex h-16 max-w-[1312px] items-center gap-3 px-4 md:gap-7 md:px-8'>
        <Logo />
        <nav className='hidden items-center gap-0.5 lg:flex'>
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Fragment key={href}>
              {/* Browse and Community are things to look at; the rest are things to do. */}
              {href === '/create' && <span aria-hidden className='mx-1.5 h-4 w-px bg-line' />}
              <Link
                href={href}
                className={cn(
                  'relative whitespace-nowrap rounded-[9px] px-3 py-[7px] text-sm font-medium text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground',
                  active && 'bg-foreground/[0.07] text-foreground',
                )}
              >
                {label}
                {href === '/play' && dailyPending && <PendingDot className='absolute right-[5px] top-[6px]' />}
              </Link>
              </Fragment>
            );
          })}
        </nav>
        <div className='flex-1' />
        <div className='hidden items-center gap-2 lg:flex'>
          <ThemeToggle />
          <PostFlagButton />
          <NotificationsBell />
          <AuthHeader />
        </div>
        <NotificationsBell className='lg:hidden' />
        <HamburgerMenu />
      </div>
    </header>
  );
}
