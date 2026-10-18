'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Logo from '@/components/Logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { PostFlagButton } from '@/components/post-flag-button';
import { AuthHeader } from '@/components/auth-header';
import { HamburgerMenu } from '@/components/hamburger-menu';
import { cn } from '@/lib/utils';
import { FOCUS_SEARCH_KEY, NAV_LINKS } from '@/lib/nav';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  // Search lives on the browse page; "/" or ⌘K from anywhere else goes there with the box focused.
  useEffect(() => {
    if (pathname === '/') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        sessionStorage.setItem(FOCUS_SEARCH_KEY, '1');
        router.push('/');
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
        <div className='flex-1' />
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
