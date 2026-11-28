'use client';

import Link from 'next/link';
import { BookOpen, PaintBrush, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** "Post flag": your own design goes to the community, a real flag to the encyclopedia. */
export function PostFlagButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus />
          Post flag
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-72 p-1.5'>
        <DropdownMenuItem asChild className='items-start gap-3 rounded-[10px] p-2.5'>
          <Link href='/create'>
            <PaintBrush className='mt-0.5 size-5 shrink-0' />
            <span>
              <b className='block text-[14px] font-semibold'>Something I designed</b>
              <span className='block text-[12.5px] leading-snug text-muted-foreground'>
                Make it in the flag maker and post it to your profile and the community.
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className='items-start gap-3 rounded-[10px] p-2.5'>
          <Link href='/post-flag'>
            <BookOpen className='mt-0.5 size-5 shrink-0' />
            <span>
              <b className='block text-[14px] font-semibold'>A flag that exists</b>
              <span className='block text-[12.5px] leading-snug text-muted-foreground'>
                A real flag missing from the encyclopedia. Moderators check it first.
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
