'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Check,
  Copy,
  Link as LinkIcon,
  Loader2,
  Pencil,
  RotateCw,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { BatchFlagIssue, BatchFlagItem } from './use-batch-flags';

type BatchFlagCardProps = {
  item: BatchFlagItem;
  issues: BatchFlagIssue[];
  selected: boolean;
  highlighted: boolean;
  usesOwnSource: boolean;
  canRetry: boolean;
  onNameChange: (name: string) => void;
  onNameEnter: () => void;
  onOpenDetails: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onKeepDuplicate: () => void;
  onApplySuggestion: (suggestion: string) => void;
  onDismissSuggestion: () => void;
};

const calloutClassName =
  'rounded-xl border px-3 py-2 text-xs border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100';

export default function BatchFlagCard({
  item,
  issues,
  selected,
  highlighted,
  usesOwnSource,
  canRetry,
  onNameChange,
  onNameEnter,
  onOpenDetails,
  onRemove,
  onRetry,
  onKeepDuplicate,
  onApplySuggestion,
  onDismissSuggestion,
}: BatchFlagCardProps) {
  const uploading = issues.find((issue) => issue.kind === 'uploading');
  const uploadError = issues.find((issue) => issue.kind === 'upload-error');
  const duplicate = issues.find((issue) => issue.kind === 'duplicate');
  const batchDuplicate = issues.find((issue) => issue.kind === 'batch-duplicate');
  const suggestion = issues.find((issue) => issue.kind === 'file-like-name');
  const needsLook = Boolean(uploadError || duplicate || batchDuplicate || suggestion);

  return (
    <Card
      data-batch-flag-id={item.id}
      className={cn(
        'group p-3 gap-0 transition-shadow before:hidden',
        needsLook && 'ring-2 ring-amber-400',
        selected && 'ring-2 ring-main',
        highlighted && 'animate-pulse',
      )}
    >
      <div className='relative h-32 rounded-xl bg-foreground/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] flex items-center justify-center overflow-hidden'>
        {item.previewUrl ? (
          <Image
            src={item.previewUrl}
            alt={item.name || 'Flag preview'}
            width={240}
            height={160}
            className={cn(
              'max-h-[88px] w-auto max-w-[85%] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)]',
              uploading && 'opacity-60',
            )}
          />
        ) : (
          <div className='h-16 w-[70%] rounded bg-foreground/10 animate-pulse' />
        )}
        <button
          type='button'
          onClick={onOpenDetails}
          className='absolute top-2 left-2 h-7 px-2 rounded-full bg-secondary-background/90 border border-border flex items-center gap-1 text-[11px] font-semibold text-foreground/70 shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity cursor-pointer'
        >
          <SlidersHorizontal className='size-3.5' />
          Details
        </button>
        <button
          type='button'
          onClick={onRemove}
          aria-label={`Remove ${item.name || 'flag'}`}
          className='absolute top-2 right-2 size-7 rounded-full bg-secondary-background/90 border border-border flex items-center justify-center text-foreground/60 shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity cursor-pointer'
        >
          <X className='size-4' />
        </button>
      </div>

      <div className='mt-2.5 space-y-2'>
        <textarea
          data-batch-name-input
          rows={1}
          value={item.name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              onNameEnter();
            }
          }}
          placeholder='Flag name'
          aria-label='Flag name'
          className={cn(
            'w-full resize-none [field-sizing:content] rounded-lg px-2.5 py-1.5 text-sm font-semibold leading-snug bg-transparent border border-transparent hover:border-border focus:border-main focus:bg-secondary-background focus:outline-none transition-colors placeholder:text-foreground/40',
            (suggestion || !item.name.trim()) && 'border-amber-300 dark:border-amber-700/60',
          )}
        />

        <div className='px-2.5 pb-1 space-y-2'>
          {uploading && item.upload.state === 'uploading' && (
            <div className='flex items-center gap-1.5 text-xs text-foreground/60'>
              <Loader2 className='size-3.5 animate-spin' />
              {item.upload.label}
              {item.upload.progress !== null && `… ${item.upload.progress}%`}
            </div>
          )}

          {uploadError && uploadError.kind === 'upload-error' && (
            <div className='rounded-xl border px-3 py-2 text-xs border-red-300 bg-red-50 text-red-900 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-100'>
              <div className='font-bold flex items-center gap-1'>
                <TriangleAlert className='size-3.5' />
                {uploadError.message}
              </div>
              <div className='flex gap-2 mt-1.5 font-semibold'>
                {canRetry && (
                  <button type='button' onClick={onRetry} className='flex items-center gap-1 underline cursor-pointer'>
                    <RotateCw className='size-3' />
                    Retry
                  </button>
                )}
                <button type='button' onClick={onRemove} className='underline cursor-pointer'>
                  Remove
                </button>
              </div>
            </div>
          )}

          {duplicate && duplicate.kind === 'duplicate' && (
            <div className={calloutClassName}>
              <div className='font-bold flex items-center gap-1'>
                <Copy className='size-3.5' />
                {duplicate.status === 'live' ? 'Already on Vexilo' : 'Already waiting for review'}
              </div>
              <div className='flex flex-wrap gap-x-2 gap-y-1 mt-1.5 font-semibold whitespace-nowrap'>
                {duplicate.status === 'live' && (
                  <>
                    <Link
                      href={`/flag/${encodeURIComponent(duplicate.name)}`}
                      target='_blank'
                      className='underline'
                    >
                      View it
                    </Link>
                    <span className='opacity-50'>·</span>
                  </>
                )}
                <button type='button' onClick={onRemove} className='cursor-pointer hover:underline'>
                  Remove
                </button>
                <span className='opacity-50'>·</span>
                <button type='button' onClick={onKeepDuplicate} className='cursor-pointer opacity-70 hover:underline'>
                  Keep anyway
                </button>
              </div>
            </div>
          )}

          {batchDuplicate && batchDuplicate.kind === 'batch-duplicate' && (
            <div className={calloutClassName}>
              <div className='font-bold flex items-center gap-1'>
                <Copy className='size-3.5' />
                Also in this batch
              </div>
              <div className='flex gap-2 mt-1.5 font-semibold whitespace-nowrap'>
                <button type='button' onClick={onRemove} className='cursor-pointer hover:underline'>
                  Remove
                </button>
                <span className='opacity-50'>·</span>
                <button type='button' onClick={onKeepDuplicate} className='cursor-pointer opacity-70 hover:underline'>
                  Keep both
                </button>
              </div>
            </div>
          )}

          {suggestion && suggestion.kind === 'file-like-name' && (
            <div className={calloutClassName}>
              <div className='font-bold flex items-center gap-1'>
                <Pencil className='size-3.5' />
                Looks like a file name
              </div>
              <div className='mt-1'>
                {suggestion.suggestion ? (
                  <>
                    Did you mean{' '}
                    <button
                      type='button'
                      onClick={() => onApplySuggestion(suggestion.suggestion!)}
                      className='font-bold underline cursor-pointer'
                    >
                      {suggestion.suggestion}
                    </button>
                    ?
                  </>
                ) : (
                  'Give it the flag’s real name.'
                )}{' '}
                <button
                  type='button'
                  onClick={onDismissSuggestion}
                  className='opacity-70 hover:underline cursor-pointer'
                >
                  Keep mine
                </button>
              </div>
            </div>
          )}

          {!needsLook && !uploading && (
            <div className='flex items-center gap-1.5 text-xs text-foreground/60'>
              {usesOwnSource ? (
                <>
                  <LinkIcon className='size-3.5 text-main' />
                  Own source
                </>
              ) : (
                <>
                  <Check className='size-3.5 text-green-600' />
                  Ready
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
