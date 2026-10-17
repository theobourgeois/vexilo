'use client';

import { type ReviewQueueItem, updatePendingFlagRequest } from '@/actions/requests';
import SourcesInput from '@/components/SourcesInput';
import TagInput from '@/components/TagInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Check, Copy, Loader2, Pencil, X } from '@/components/icons';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChipList, EditDiff, FieldLabel } from './EditDiff';
import { isTypingTarget, needsLook, timeAgo } from './review-utils';

type RequestPanelProps = {
  item: ReviewQueueItem;
  position: number;
  total: number;
  /** Position within this creator's submission (the group the item belongs to). */
  groupPosition: number;
  groupTotal: number;
  onPrevious: () => void;
  onNext: () => void;
  onPreviousInGroup: () => void;
  onNextInGroup: () => void;
  onClose: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onPatched: (patch: Partial<ReviewQueueItem['flag']>) => void;
};

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-5 justify-center rounded-[6px] px-1.5 py-px tabular-nums text-[10.5px] font-medium leading-4',
        className ?? 'vx-key text-subtle',
      )}
    >
      {children}
    </kbd>
  );
}

function FlagWell({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={cn(
        'h-32 rounded-[14px] bg-well shadow-well flex items-center justify-center',
        className,
      )}
    >
      {src && (
        <Image
          src={src}
          alt={alt}
          width={240}
          height={160}
          className='max-h-20 w-auto max-w-[85%] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)]'
        />
      )}
    </div>
  );
}

export function RequestPanel({
  item,
  position,
  total,
  groupPosition,
  groupTotal,
  onPrevious,
  onNext,
  onPreviousInGroup,
  onNextInGroup,
  onClose,
  onApprove,
  onDecline,
  onPatched,
}: RequestPanelProps) {
  const [isTweaking, setIsTweaking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(item.flag);
  const warning = needsLook(item);

  useEffect(() => {
    setIsTweaking(false);
    setDraft(item.flag);
    // Reset only when switching requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const saveTweak = async () => {
    setIsSaving(true);
    const patch = {
      flagName: draft.flagName.trim(),
      description: draft.description,
      tags: draft.tags,
      sources: draft.sources,
    };
    const result = await updatePendingFlagRequest(item.id, patch).catch(() => null);
    setIsSaving(false);
    if (!result) {
      toast.error('Could not save changes.');
      return;
    }
    onPatched(patch);
    setIsTweaking(false);
    toast.success('Saved. Approve when ready.');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isTweaking) setIsTweaking(false);
        else onClose();
        return;
      }
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === 'a') onApprove();
      else if (key === 'd') onDecline();
      else if (key === 'e') {
        event.preventDefault();
        setIsTweaking(true);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        onNextInGroup();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        onPreviousInGroup();
      } else if (key === 'j') onNext();
      else if (key === 'k') onPrevious();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTweaking, onApprove, onClose, onDecline, onNext, onNextInGroup, onPrevious, onPreviousInGroup]);

  const before = item.oldFlag;
  const after = item.flag;
  return (
    <aside
      aria-label='Request details'
      className='fixed z-40 inset-0 sm:inset-auto sm:top-20 sm:right-4 sm:bottom-4 sm:w-[520px] flex flex-col overflow-hidden sm:rounded-[18px] bg-secondary-background shadow-pop'
    >
      <div className='px-6 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-line'>
        <div className='min-w-0'>
          <p className={cn('tabular-nums text-xs font-medium', item.isEdit ? 'text-main' : 'text-good')}>
            {item.isEdit ? 'Edit' : 'New flag'} · by {item.user.name || 'Anonymous'}
            {groupTotal > 1 && `, ${groupPosition} of ${groupTotal}`} · {timeAgo(item.createdAt)}
          </p>
          <p className='mt-1.5 text-[17px] font-semibold tracking-[-0.02em] truncate'>{after.flagName}</p>
        </div>
        <div className='flex items-center gap-1.5 text-sm text-muted-foreground shrink-0'>
          {groupTotal > 1 && (
            <>
              <button
                type='button'
                onClick={onPreviousInGroup}
                disabled={groupPosition === 1}
                className='cursor-pointer disabled:cursor-default disabled:opacity-40'
                aria-label={`Previous from ${item.user.name || 'this creator'}`}
              >
                <Kbd>↑</Kbd>
              </button>
              <button
                type='button'
                onClick={onNextInGroup}
                disabled={groupPosition === groupTotal}
                className='cursor-pointer disabled:cursor-default disabled:opacity-40'
                aria-label={`Next from ${item.user.name || 'this creator'}`}
              >
                <Kbd>↓</Kbd>
              </button>
              <span className='mx-1 h-4 w-px bg-line' />
            </>
          )}
          <span className='tabular-nums text-[13px] mr-1'>
            {position} of {total}
          </span>
          <button type='button' onClick={onNext} className='cursor-pointer' aria-label='Next request'>
            <Kbd>J</Kbd>
          </button>
          <button type='button' onClick={onPrevious} className='cursor-pointer' aria-label='Previous request'>
            <Kbd>K</Kbd>
          </button>
          <button type='button' onClick={onClose} aria-label='Close' className='ml-2 cursor-pointer hover:text-foreground'>
            <X className='size-5' />
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto px-6 py-5 space-y-5'>
        {warning && (
          <div className='rounded-[11px] px-3 py-2.5 text-sm bg-main-soft text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--main)_30%,transparent)] flex items-center gap-2'>
            <Copy className='size-4 shrink-0 text-main' />
            <span>
              {warning}
              {item.duplicateOf && (
                <>
                  :{' '}
                  <Link href={`/flag/${encodeURIComponent(item.duplicateOf)}`} target='_blank' className='font-semibold underline'>
                    {item.duplicateOf}
                  </Link>
                </>
              )}
            </span>
          </div>
        )}

        {item.isEdit && before && before.flagImage !== after.flagImage ? (
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <FieldLabel>Before</FieldLabel>
              <FlagWell src={before.flagImage} alt='Before' />
            </div>
            <div>
              <FieldLabel className='text-good'>After</FieldLabel>
              <FlagWell src={after.flagImage} alt='After' className='ring-2 ring-good' />
            </div>
          </div>
        ) : (
          <FlagWell src={after.flagImage} alt={after.flagName} className='h-40' />
        )}

        {isTweaking ? (
          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <label htmlFor='tweak-name' className='text-sm font-semibold'>
                Name
              </label>
              <Input
                id='tweak-name'
                autoFocus
                value={draft.flagName}
                onChange={(event) => setDraft({ ...draft, flagName: event.target.value })}
              />
            </div>
            <TagInput tags={draft.tags} onTagsChange={(tags) => setDraft({ ...draft, tags })} placeholder='Enter tags...' />
            <div className='space-y-1.5'>
              <label htmlFor='tweak-description' className='text-sm font-semibold'>
                Description
              </label>
              <Textarea
                id='tweak-description'
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>
            <SourcesInput
              sources={draft.sources}
              onSourcesChange={(sources) => setDraft({ ...draft, sources })}
              placeholder='Enter URL (must start with http:// or https://)...'
              label='Sources'
            />
          </div>
        ) : item.isEdit && before ? (
          <EditDiff before={before} after={after} />
        ) : (
          <>
            <div>
              <FieldLabel>Sources</FieldLabel>
              {(after.sources ?? []).length > 0 ? (
                <ul className='space-y-1 text-sm'>
                  {after.sources.map((source) => (
                    <li key={source} className='truncate'>
                      <a href={source} target='_blank' rel='noopener noreferrer' className='text-main underline'>
                        {source}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='text-sm text-main font-medium'>No source</p>
              )}
            </div>
            <div>
              <FieldLabel>Tags</FieldLabel>
              <ChipList before={after.tags ?? []} after={after.tags ?? []} />
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <p className='text-sm text-subtle whitespace-pre-wrap'>
                {after.description || <span className='text-muted-foreground'>None</span>}
              </p>
            </div>
            {(after.relatedFlags ?? []).length > 0 && (
              <div>
                <FieldLabel>Related flags</FieldLabel>
                <ChipList
                  before={after.relatedFlags!.map((flag) => flag.name)}
                  after={after.relatedFlags!.map((flag) => flag.name)}
                />
              </div>
            )}
          </>
        )}

        {item.userMessage && (
          <div className='rounded-[11px] bg-foreground/[0.04] border border-line px-3 py-2.5 text-sm text-subtle'>
            <b className='font-semibold text-foreground'>Note from {item.user.name || 'the creator'}:</b> {item.userMessage}
          </div>
        )}
      </div>

      <div className='px-6 py-4 border-t border-line flex items-center gap-3'>
        {isTweaking ? (
          <>
            <Button variant='neutral' size='sm' onClick={() => setIsTweaking(false)}>
              Cancel
            </Button>
            <div className='flex-1' />
            <Button size='sm' onClick={saveTweak} disabled={isSaving}>
              {isSaving ? <Loader2 className='animate-spin' /> : <Check />}
              Save changes
            </Button>
          </>
        ) : (
          <>
            <Button variant='neutral' size='sm' onClick={onDecline} className='text-bad'>
              <X />
              Decline <Kbd>D</Kbd>
            </Button>
            <Button variant='neutral' size='sm' onClick={() => setIsTweaking(true)}>
              <Pencil />
              Tweak <Kbd>E</Kbd>
            </Button>
            <div className='flex-1' />
            <Button size='sm' onClick={onApprove}>
              <Check />
              Approve <Kbd className='bg-main-foreground/20 text-main-foreground'>A</Kbd>
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
