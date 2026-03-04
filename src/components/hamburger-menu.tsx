'use client';

import { Menu, Gamepad2, Heart, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from './ui/drawer';
import { AuthHeader } from './auth-header';
import Logo from './Logo';
import Link from 'next/link';

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Drawer direction='right' open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant='neutral' size='icon' className='md:hidden'>
          <Menu className='h-6 w-6' />
        </Button>
      </DrawerTrigger>
      <DrawerContent className='data-[vaul-drawer-direction=right]:w-[86vw] data-[vaul-drawer-direction=right]:max-w-[320px] p-0'>
        <div className='flex min-h-dvh flex-col px-4 pb-4 pt-6'>
          <div className='flex items-start justify-between gap-3 border-b border-border/60 pb-5'>
            <Logo
              showText
              textClassName='hidden [@media(min-width:300px)]:flex'
            />
            <div className='shrink-0 pt-1'>
              <AuthHeader />
            </div>
          </div>

          <nav className='space-y-1 py-3'>
            <Link
              href='/quiz'
              onClick={() => setOpen(false)}
              className='flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground'
            >
              <Gamepad2 className='h-4 w-4' />
              Quiz
            </Link>
            <a
              href='https://buymeacoffee.com/theobourgeois'
              target='_blank'
              rel='noopener noreferrer'
              onClick={() => setOpen(false)}
              className='flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground'
            >
              <Heart className='h-4 w-4 fill-red-500 text-red-500' />
              Donate
            </a>
          </nav>

          <div className='mt-auto border-t border-border/60 pt-4'>
            <Link href='/post-flag' onClick={() => setOpen(false)} className='block'>
              <Button size='lg' className='w-full justify-center'>
                <Plus className='h-4 w-4' />
                Post Flag
              </Button>
            </Link>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
