'use client';

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
} from '@/components/icons';
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
  'rounded-[10px] bg-main-soft px-3 py-2 text-xs text-foreground';
const calloutTitleClassName =
  'flex items-center gap-1.5 font-semibold [&_svg]:text-main';
const calloutActionClassName =
  'cursor-pointer font-medium text-subtle underline-offset-2 hover:text-foreground hover:underline';

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
  const batchDuplicate = issues.find(
    (issue) => issue.kind === 'batch-duplicate',
  );
  const suggestion = issues.find((issue) => issue.kind === 'file-like-name');
  const needsLook = Boolean(
    uploadError || duplicate || batchDuplicate || suggestion,
  );

  return (
    <div
      data-batch-flag-id={item.id}
      className={cn(
        'vx-tile group flex flex-col p-2.5 outline-offset-2 transition-[outline-color]',
        needsLook && 'outline-1 outline-main/50',
        selected && 'outline-2 outline-main',
        highlighted && 'animate-pulse',
      )}
    >
      <div className='relative grid h-32 place-items-center overflow-hidden rounded-xl bg-stage'>
        {item.previewUrl ? (
          <Image
            src={item.previewUrl}
            alt={item.name || 'Flag preview'}
            width={240}
            height={160}
            className={cn(
              'max-h-[84px] w-auto max-w-[80%] object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.18)]',
              uploading && 'opacity-50',
            )}
          />
        ) : (
          <div className='h-16 w-[70%] animate-pulse rounded bg-foreground/[0.06]' />
        )}
        <button
          type='button'
          onClick={onOpenDetails}
          className='vx-key absolute left-2 top-2 flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium text-subtle opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
        >
          <SlidersHorizontal className='size-3.5' />
          Details
        </button>
        <button
          type='button'
          onClick={onRemove}
          aria-label={`Remove ${item.name || 'flag'}`}
          className='vx-key absolute right-2 top-2 grid size-7 cursor-pointer place-items-center rounded-full text-subtle opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
        >
          <X className='size-3.5' />
        </button>
      </div>

      <div className='mt-2 space-y-2'>
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
            'w-full resize-none rounded-[9px] bg-transparent px-2.5 py-1.5 text-sm font-semibold leading-snug transition-[background-color,box-shadow] [field-sizing:content] placeholder:font-normal placeholder:text-muted-foreground hover:bg-foreground/[0.04] focus:bg-well focus:shadow-[var(--sh-well),0_0_0_2px_var(--main)] focus:outline-none',
            (suggestion || !item.name.trim()) &&
              'shadow-[inset_0_0_0_1px_var(--main)]',
          )}
        />

        <div className='space-y-2 px-2.5 pb-1.5'>
          {uploading && item.upload.state === 'uploading' && (
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Loader2 className='size-3.5 animate-spin' />
              {item.upload.label}
              {item.upload.progress !== null && (
                <span className='tabular-nums'>{item.upload.progress}%</span>
              )}
            </div>
          )}

          {uploadError && uploadError.kind === 'upload-error' && (
            <div className='rounded-[10px] bg-bad-soft px-3 py-2 text-xs text-foreground'>
              <div className='flex items-center gap-1.5 font-semibold'>
                <TriangleAlert className='size-3.5 shrink-0 text-bad' />
                {uploadError.message}
              </div>
              <div className='mt-1.5 flex gap-3'>
                {canRetry && (
                  <button
                    type='button'
                    onClick={onRetry}
                    className={cn(
                      calloutActionClassName,
                      'flex items-center gap-1',
                    )}
                  >
                    <RotateCw className='size-3' />
                    Retry
                  </button>
                )}
                <button
                  type='button'
                  onClick={onRemove}
                  className={calloutActionClassName}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {duplicate && duplicate.kind === 'duplicate' && (
            <div className={calloutClassName}>
              <div className={calloutTitleClassName}>
                <Copy className='size-3.5 shrink-0' />
                {duplicate.status === 'live'
                  ? 'Already on Vexilo'
                  : 'Already waiting for review'}
              </div>
              <div className='mt-1.5 flex flex-wrap gap-x-3 gap-y-1 whitespace-nowrap'>
                {duplicate.status === 'live' && (
                  <Link
                    href={`/flag/${encodeURIComponent(duplicate.name)}`}
                    target='_blank'
                    className={calloutActionClassName}
                  >
                    View it
                  </Link>
                )}
                <button
                  type='button'
                  onClick={onRemove}
                  className={calloutActionClassName}
                >
                  Remove
                </button>
                <button
                  type='button'
                  onClick={onKeepDuplicate}
                  className={calloutActionClassName}
                >
                  Keep anyway
                </button>
              </div>
            </div>
          )}

          {batchDuplicate && batchDuplicate.kind === 'batch-duplicate' && (
            <div className={calloutClassName}>
              <div className={calloutTitleClassName}>
                <Copy className='size-3.5 shrink-0' />
                Also in this batch
              </div>
              <div className='mt-1.5 flex gap-3 whitespace-nowrap'>
                <button
                  type='button'
                  onClick={onRemove}
                  className={calloutActionClassName}
                >
                  Remove
                </button>
                <button
                  type='button'
                  onClick={onKeepDuplicate}
                  className={calloutActionClassName}
                >
                  Keep both
                </button>
              </div>
            </div>
          )}

          {suggestion && suggestion.kind === 'file-like-name' && (
            <div className={calloutClassName}>
              <div className={calloutTitleClassName}>
                <Pencil className='size-3.5 shrink-0' />
                Looks like a file name
              </div>
              <div className='mt-1 text-subtle'>
                {suggestion.suggestion ? (
                  <>
                    Did you mean{' '}
                    <button
                      type='button'
                      onClick={() => onApplySuggestion(suggestion.suggestion!)}
                      className='cursor-pointer font-semibold text-foreground underline underline-offset-2'
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
                  className={calloutActionClassName}
                >
                  Keep mine
                </button>
              </div>
            </div>
          )}

          {!needsLook && !uploading && (
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              {usesOwnSource ? (
                <>
                  <LinkIcon className='size-3.5' />
                  Own source
                </>
              ) : (
                <>
                  <Check className='size-3.5 text-good' />
                  Ready
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
