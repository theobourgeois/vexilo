'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import Logo from '@/components/Logo';
import { HeaderSearch } from '@/components/header-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { PostFlagButton } from '@/components/post-flag-button';
import { AuthHeader } from '@/components/auth-header';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { cn } from '@/lib/utils';
import { NAV_LINKS } from '@/lib/nav';

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className='sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-xl backdrop-saturate-150'>
      <div className='mx-auto flex h-16 max-w-[1312px] items-center gap-3 px-4 md:gap-7 md:px-8'>
        <Logo />
        <nav className='hidden items-center gap-0.5 md:flex'>
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-[9px] px-3 py-[7px] text-sm font-medium text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground',
                  active && 'bg-foreground/[0.07] text-foreground',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Suspense fallback={<div className='ml-auto h-[38px] max-w-[440px] flex-1' />}>
          <HeaderSearch className='ml-auto max-w-[440px] flex-1' />
        </Suspense>
        <div className='hidden items-center gap-2 md:flex'>
          <ThemeToggle />
          <PostFlagButton />
          <AuthHeader />
        </div>
        <HamburgerMenu />
      </div>
    </header>
  );
}
