'use client';

import { type ReviewQueueItem, updatePendingFlagRequest } from '@/actions/requests';
import SourcesInput from '@/components/SourcesInput';
import TagInput from '@/components/TagInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { diffLists, diffWords } from '@/lib/text-diff';
import { cn } from '@/lib/utils';
import { Check, Copy, Equal, Loader2, Pencil, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isTypingTarget, needsLook, timeAgo } from './review-utils';

type RequestPanelProps = {
  item: ReviewQueueItem;
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onPatched: (patch: Partial<ReviewQueueItem['flag']>) => void;
};

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'text-[11px] font-bold px-1.5 py-px rounded-md border border-border bg-secondary-background text-foreground/70 shadow-[0_2px_0_var(--border)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[11px] font-bold uppercase tracking-wider text-foreground/50 mb-1.5', className)}>
      {children}
    </p>
  );
}

function FlagWell({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={cn(
        'h-32 rounded-xl bg-foreground/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] flex items-center justify-center',
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

function TextDiff({ before, after }: { before: string; after: string }) {
  return (
    <div className='text-sm rounded-lg bg-secondary-background border border-border px-3 py-2 leading-relaxed whitespace-pre-wrap'>
      {diffWords(before, after).map((part, index) => (
        <span
          key={index}
          className={cn(
            part.type === 'added' && 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 rounded px-0.5',
            part.type === 'removed' && 'bg-red-100 text-red-700 line-through dark:bg-red-900/40 dark:text-red-200 rounded px-0.5',
          )}
        >
          {part.text}
        </span>
      ))}
    </div>
  );
}

function ChipList({ before, after }: { before: string[]; after: string[] }) {
  const { kept, added, removed } = diffLists(before, after);
  if (kept.length + added.length + removed.length === 0) {
    return <p className='text-sm text-foreground/50'>None</p>;
  }
  return (
    <div className='flex flex-wrap gap-1.5'>
      {kept.map((value) => (
        <span key={`k-${value}`} className='text-xs font-semibold rounded-full bg-foreground/5 px-2.5 py-1 break-all'>
          {value}
        </span>
      ))}
      {added.map((value) => (
        <span key={`a-${value}`} className='text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 px-2.5 py-1 break-all'>
          + {value}
        </span>
      ))}
      {removed.map((value) => (
        <span key={`r-${value}`} className='text-xs font-semibold rounded-full bg-red-100 text-red-700 line-through dark:bg-red-900/40 dark:text-red-200 px-2.5 py-1 break-all'>
          {value}
        </span>
      ))}
    </div>
  );
}

export function RequestPanel({
  item,
  position,
  total,
  onPrevious,
  onNext,
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
      } else if (key === 'j' || event.key === 'ArrowDown') onNext();
      else if (key === 'k' || event.key === 'ArrowUp') onPrevious();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTweaking, onApprove, onClose, onDecline, onNext, onPrevious]);

  const before = item.oldFlag;
  const after = item.flag;
  const unchanged: string[] = [];
  if (item.isEdit && before) {
    if ((before.sources ?? []).join() === (after.sources ?? []).join()) unchanged.push('sources');
    if ((before.relatedFlags ?? []).map((f) => f.id).join() === (after.relatedFlags ?? []).map((f) => f.id).join())
      unchanged.push('related flags');
    if ((before.tags ?? []).slice().sort().join() === (after.tags ?? []).slice().sort().join()) unchanged.push('tags');
    if ((before.description ?? '') === (after.description ?? '')) unchanged.push('description');
  }

  return (
    <aside
      aria-label='Request details'
      className='fixed z-40 inset-0 sm:inset-auto sm:top-20 sm:right-4 sm:bottom-4 sm:w-[520px] flex flex-col overflow-hidden sm:rounded-2xl border border-white/90 dark:border-white/20 bg-[image:var(--background-image-noise),var(--background-image-glossy-card)] dark:bg-[image:var(--background-image-noise),var(--background-image-glossy-card-dark)] bg-[size:256px,auto] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]'
    >
      <div className='px-6 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-border/70'>
        <div className='min-w-0'>
          <p className={cn('text-xs font-bold uppercase tracking-wider', item.isEdit ? 'text-main' : 'text-green-600 dark:text-green-400')}>
            {item.isEdit ? 'Edit' : 'New flag'} · by {item.user.name || 'Anonymous'} · {timeAgo(item.createdAt)}
          </p>
          <p className='text-lg font-bold truncate'>{after.flagName}</p>
        </div>
        <div className='flex items-center gap-1.5 text-sm text-foreground/60 shrink-0'>
          <span className='font-semibold mr-1'>
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
          <div className='rounded-xl border px-3 py-2.5 text-sm border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 flex items-center gap-2'>
            <Copy className='size-4 shrink-0' />
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
              <FieldLabel className='text-green-700 dark:text-green-400'>After</FieldLabel>
              <FlagWell src={after.flagImage} alt='After' className='ring-2 ring-green-400' />
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
          <>
            {before.flagName !== after.flagName && (
              <div>
                <FieldLabel>Name</FieldLabel>
                <TextDiff before={before.flagName} after={after.flagName} />
              </div>
            )}
            {!unchanged.includes('tags') && (
              <div>
                <FieldLabel>Tags</FieldLabel>
                <ChipList before={before.tags ?? []} after={after.tags ?? []} />
              </div>
            )}
            {!unchanged.includes('description') && (
              <div>
                <FieldLabel>Description</FieldLabel>
                <TextDiff before={before.description ?? ''} after={after.description ?? ''} />
              </div>
            )}
            {!unchanged.includes('sources') && (
              <div>
                <FieldLabel>Sources</FieldLabel>
                <ChipList before={before.sources ?? []} after={after.sources ?? []} />
              </div>
            )}
            {!unchanged.includes('related flags') && (
              <div>
                <FieldLabel>Related flags</FieldLabel>
                <ChipList
                  before={(before.relatedFlags ?? []).map((flag) => flag.name)}
                  after={(after.relatedFlags ?? []).map((flag) => flag.name)}
                />
              </div>
            )}
            {unchanged.length > 0 && (
              <p className='flex items-center gap-2 text-xs text-foreground/50'>
                <Equal className='size-3.5' />
                {unchanged.join(', ')} unchanged
              </p>
            )}
          </>
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
                <p className='text-sm text-amber-700 dark:text-amber-400 font-semibold'>No source</p>
              )}
            </div>
            <div>
              <FieldLabel>Tags</FieldLabel>
              <ChipList before={after.tags ?? []} after={after.tags ?? []} />
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <p className='text-sm text-foreground/80 whitespace-pre-wrap'>
                {after.description || <span className='text-foreground/40'>None</span>}
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
          <div className='rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 px-3 py-2.5 text-sm text-blue-900 dark:text-blue-100'>
            <b>Note from {item.user.name || 'the creator'}:</b> {item.userMessage}
          </div>
        )}
      </div>

      <div className='px-6 py-4 border-t border-border/70 flex items-center gap-3'>
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
            <Button variant='neutral' size='sm' onClick={onDecline} className='text-red-600'>
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
              Approve <Kbd className='bg-white/20 border-white/30 shadow-none text-white'>A</Kbd>
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
