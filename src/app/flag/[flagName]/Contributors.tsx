'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type Contributor = {
  userNumber: string;
  name: string | null;
  image: string | null;
  edits: number;
  lastEditedAt: Date;
};

const MAX_STACK = 5;

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function ContributorAvatar({ contributor, className }: { contributor: Contributor; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={contributor.image || ''} alt={contributor.name || 'User'} />
      <AvatarFallback className='text-[10.5px]'>{contributor.name?.charAt(0) || 'U'}</AvatarFallback>
    </Avatar>
  );
}

/** Avatar stack that opens the full contributor list on hover or click. */
export default function Contributors({ contributors, totalEdits }: { contributors: Contributor[]; totalEdits: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerType = useRef<string | null>(null);

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsOpen(true);
  };
  // A short delay lets the pointer travel from the stack into the popover.
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setIsOpen(false), 150);
  };

  const shown = contributors.slice(0, MAX_STACK);
  const hidden = contributors.length - shown.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        onPointerEnter={(event) => event.pointerType === 'mouse' && open()}
        onPointerLeave={(event) => event.pointerType === 'mouse' && scheduleClose()}
        onPointerDown={(event) => (pointerType.current = event.pointerType)}
        onClick={(event) => {
          // Hover already opened it for mouse users; a click shouldn't toggle it shut.
          if (pointerType.current === 'mouse') {
            event.preventDefault();
            open();
          }
          pointerType.current = null;
        }}
        className='group flex cursor-pointer flex-col items-start gap-2 rounded-[10px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring'
        aria-label={`${contributors.length} contributor${contributors.length === 1 ? '' : 's'}`}
      >
        <span className='flex -space-x-2'>
          {shown.map((contributor) => (
            <ContributorAvatar
              key={contributor.userNumber}
              contributor={contributor}
              className='size-[30px] shadow-[0_0_0_2.5px_var(--background)]'
            />
          ))}
          {hidden > 0 && (
            <span className='z-10 grid size-[30px] place-items-center rounded-full bg-muted text-[11px] font-medium text-subtle shadow-[0_0_0_2.5px_var(--background)]'>
              +{hidden}
            </span>
          )}
        </span>
        <span className='text-xs text-muted-foreground group-hover:text-subtle'>
          {contributors.length} {contributors.length === 1 ? 'person' : 'people'} · {totalEdits} edit{totalEdits === '1' ? '' : 's'}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-[300px] p-1.5'
        onPointerEnter={(event) => event.pointerType === 'mouse' && open()}
        onPointerLeave={(event) => event.pointerType === 'mouse' && scheduleClose()}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <ul className='max-h-[320px] overflow-y-auto'>
          {contributors.map((contributor) => (
            <li key={contributor.userNumber}>
              <Link
                href={`/profile/${contributor.userNumber}`}
                className='flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-[13px] hover:bg-foreground/[0.05]'
              >
                <ContributorAvatar contributor={contributor} className='size-[26px] shadow-none' />
                <span className='min-w-0 flex-1 truncate font-medium'>{contributor.name || 'Unknown user'}</span>
                <span className='shrink-0 tabular-nums text-[11.5px] text-muted-foreground'>
                  {contributor.edits} edit{contributor.edits === 1 ? '' : 's'} · {formatDate(contributor.lastEditedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
