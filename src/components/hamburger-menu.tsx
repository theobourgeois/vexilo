'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coffee, Menu, Plus } from '@/components/icons';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from './ui/drawer';
import { AuthHeader } from './auth-header';
import { ThemeToggle } from './theme-toggle';
import Logo from './Logo';
import { NAV_LINKS } from '@/lib/nav';
import { cn } from '@/lib/utils';

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Drawer direction='right' open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant='neutral' size='icon' className='shrink-0 md:hidden' aria-label='Open menu'>
          <Menu />
        </Button>
      </DrawerTrigger>
      <DrawerContent className='p-0 data-[vaul-drawer-direction=right]:w-[86vw] data-[vaul-drawer-direction=right]:max-w-[320px]'>
        <DrawerTitle className='sr-only'>Menu</DrawerTitle>
        <div className='flex min-h-dvh flex-col px-4 pb-4 pt-5'>
          <div className='flex items-center justify-between gap-3 border-b border-line pb-4'>
            <Logo />
            <div className='flex items-center gap-2'>
              <ThemeToggle />
              <AuthHeader />
            </div>
          </div>

          <nav className='space-y-0.5 py-3'>
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground',
                    active && 'bg-foreground/[0.07] text-foreground',
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <a
              href='https://buymeacoffee.com/theobourgeois'
              target='_blank'
              rel='noopener noreferrer'
              onClick={() => setOpen(false)}
              className='flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground'
            >
              <Coffee className='size-4' />
              Donate
            </a>
          </nav>

          <div className='mt-auto border-t border-line pt-4'>
            <Button asChild size='lg' className='w-full'>
              <Link href='/post-flag' onClick={() => setOpen(false)}>
                <Plus />
                Post flag
              </Link>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
