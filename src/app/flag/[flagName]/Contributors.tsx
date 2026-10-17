'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type EditChange, summarizeEdit } from '@/lib/edit-changes';
import { cn } from '@/lib/utils';

export type Contributor = {
  userNumber: string;
  name: string | null;
  image: string | null;
  edits: number;
  lastEditedAt: Date;
};

export type EditEntry = {
  id: string;
  user: { userNumber: string; name: string | null; image: string | null };
  createdAt: Date;
  changes: EditChange[];
};

const MAX_STACK = 5;

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function ContributorAvatar({
  contributor,
  className,
}: {
  contributor: Pick<Contributor, 'name' | 'image'>;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={contributor.image || ''} alt={contributor.name || 'User'} />
      <AvatarFallback className='text-[10.5px]'>{contributor.name?.charAt(0) || 'U'}</AvatarFallback>
    </Avatar>
  );
}

const added = 'rounded-full bg-good-soft px-2 py-0.5 text-good';
const removed = 'rounded-full bg-bad-soft px-2 py-0.5 text-bad line-through decoration-bad/60';

function ChangeDetail({ change }: { change: EditChange }) {
  switch (change.kind) {
    case 'name':
      return (
        <p className='rounded-[10px] bg-foreground/[0.03] px-3 py-2 text-[13px] shadow-[inset_0_0_0_1px_var(--line)]'>
          <span className='text-muted-foreground'>Name: </span>
          <span className='rounded bg-bad-soft px-1 text-bad line-through decoration-bad/60'>{change.before}</span>{' '}
          <span className='rounded bg-good-soft px-1 text-good'>{change.after}</span>
        </p>
      );
    case 'image':
      return (
        <div className='flex items-center gap-2.5'>
          {[change.before, change.after].map((src, index) => (
            <div key={index} className='flex items-center gap-2.5'>
              {index === 1 && <ArrowRight className='size-4 text-muted-foreground' />}
              <div className='grid h-12 w-[72px] place-items-center rounded-[8px] bg-stage'>
                <Image src={src} alt={index === 0 ? 'Before' : 'After'} width={64} height={40} className={cn('max-h-8 w-auto max-w-[60px] object-contain', index === 0 && 'opacity-60')} />
              </div>
            </div>
          ))}
        </div>
      );
    case 'tags':
    case 'sources':
      return (
        <div className='flex flex-wrap gap-1.5 text-[12.5px]'>
          {change.added.map((value) => (
            <span key={`a-${value}`} className={cn(added, 'max-w-full truncate')}>
              + {change.kind === 'sources' ? value.replace(/^https?:\/\/(www\.)?/, '') : value}
            </span>
          ))}
          {change.removed.map((value) => (
            <span key={`r-${value}`} className={cn(removed, 'max-w-full truncate')}>
              {change.kind === 'sources' ? value.replace(/^https?:\/\/(www\.)?/, '') : value}
            </span>
          ))}
        </div>
      );
    case 'description':
      return (
        <p className='rounded-[10px] bg-foreground/[0.03] px-3 py-2 text-[13px] leading-relaxed text-subtle shadow-[inset_0_0_0_1px_var(--line)]'>
          {change.parts.map((part, index) => (
            <span
              key={index}
              className={cn(
                part.type === 'added' && 'rounded bg-good-soft px-0.5 text-good',
                part.type === 'removed' && 'rounded bg-bad-soft px-0.5 text-bad line-through decoration-bad/60',
              )}
            >
              {part.text}
            </span>
          ))}
        </p>
      );
  }
}

function EditTimeline({ edits }: { edits: EditEntry[] }) {
  return (
    <ol className='relative pl-[26px] before:absolute before:bottom-3 before:left-2 before:top-3 before:w-[1.5px] before:bg-line'>
      {edits.map((edit, index) => (
        <li key={edit.id} className='relative pb-5 last:pb-1'>
          <span
            className={cn(
              'absolute -left-[23px] top-1.5 size-[11px] rounded-full',
              index === 0 ? 'bg-main' : 'bg-background shadow-[0_0_0_2px_var(--border)]',
            )}
          />
          <div className='flex items-center gap-2 text-[13.5px]'>
            <ContributorAvatar contributor={edit.user} className='size-[22px] shadow-none' />
            <Link href={`/profile/${edit.user.userNumber}`} className='font-medium hover:underline'>
              {edit.user.name || 'Unknown user'}
            </Link>
            <span className='min-w-0 truncate text-muted-foreground'>{summarizeEdit(edit.changes)}</span>
            <time className='ml-auto shrink-0 tabular-nums text-xs text-muted-foreground'>{formatDate(edit.createdAt)}</time>
          </div>
          {edit.changes.length > 0 && (
            <div className='mt-2 space-y-2'>
              {edit.changes.map((change) => (
                <ChangeDetail key={change.kind} change={change} />
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Avatar stack that opens the full contributor list on hover or click. */
export default function Contributors({
  contributors,
  totalEdits,
  edits,
}: {
  contributors: Contributor[];
  totalEdits: string;
  edits: EditEntry[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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

  const openHistory = () => {
    setIsOpen(false);
    setIsHistoryOpen(true);
  };

  return (
    <>
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
        <button
          type='button'
          onClick={openHistory}
          className='mt-1 flex w-full cursor-pointer items-center justify-between border-t border-line px-2 pb-1 pt-2.5 text-[12.5px] font-medium text-main hover:brightness-110'
        >
          View all edits
          <ArrowRight className='size-3.5' />
        </button>
      </PopoverContent>
    </Popover>
    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
      <DialogContent className='max-h-[min(720px,calc(100dvh-4rem))] gap-0 overflow-hidden p-0 sm:max-w-[600px]'>
        <div className='border-b border-line px-6 pb-4 pt-5'>
          <DialogTitle className='text-[17px] font-semibold tracking-[-0.02em]'>Edit history</DialogTitle>
          <DialogDescription className='mt-0.5 text-[13px] text-muted-foreground'>
            {totalEdits} approved edit{totalEdits === '1' ? '' : 's'}, newest first
          </DialogDescription>
        </div>
        <div className='overflow-y-auto px-6 py-5'>
          <EditTimeline edits={edits} />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
