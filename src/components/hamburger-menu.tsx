'use client';

import { Menu, Gamepad2, Heart } from 'lucide-react';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from './ui/drawer';
import { AuthHeader } from './auth-header';
import { PostFlagButton } from './post-flag-button';
import Logo from './Logo';
import Link from 'next/link';

export function HamburgerMenu() {
  return (
    <Drawer direction='right'>
      <DrawerTrigger asChild>
        <Button variant='neutral' size='icon' className='md:hidden'>
          <Menu className='h-6 w-6' />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className='p-4 space-y-4'>
          <div className='flex flex-col gap-4 justify-start'>
            <Logo showText />
            <AuthHeader />
            <Link
              href='/quiz'
              className='flex items-center gap-2 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors'
            >
              <Gamepad2 className='w-4 h-4' />
              Quiz
            </Link>
            <Link
              href='https://buymeacoffee.com/theobourgeois'
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-2 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors'
            >
              <Heart className='w-4 h-4 fill-red-500 text-red-500' />
              Donate
            </Link>
            <PostFlagButton />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
