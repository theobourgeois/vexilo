'use client';

import RelatedFlagInput from '@/components/related-flag-input';
import SourcesInput from '@/components/SourcesInput';
import TagInput from '@/components/TagInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, CornerDownRight, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { BatchFlagItem } from './use-batch-flags';

type BatchFlagDetailsProps = {
  item: BatchFlagItem;
  position: number;
  total: number;
  sharedSource: string;
  onChange: (patch: Partial<Omit<BatchFlagItem, 'id'>>) => void;
  onPrevious: () => void;
  onNext: () => void;
  onRemove: () => void;
  onClose: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export default function BatchFlagDetails({
  item,
  position,
  total,
  sharedSource,
  onChange,
  onPrevious,
  onNext,
  onRemove,
  onClose,
}: BatchFlagDetailsProps) {
  const [overrideSource, setOverrideSource] = useState(item.ownSources.length > 0);

  useEffect(() => {
    setOverrideSource(item.ownSources.length > 0);
    // Only reset when switching to a different flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        onPrevious();
      } else if (event.key === 'ArrowRight') {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  return (
    <aside
      aria-label='Flag details'
      className='fixed z-40 inset-0 sm:inset-auto sm:top-20 sm:right-4 sm:bottom-4 sm:w-[440px] flex flex-col overflow-hidden sm:rounded-2xl border border-white/90 dark:border-white/20 bg-[image:var(--background-image-noise),var(--background-image-glossy-card)] dark:bg-[image:var(--background-image-noise),var(--background-image-glossy-card-dark)] bg-[size:256px,auto] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]'
    >
      <div className='px-6 pt-5 pb-4 flex items-center justify-between border-b border-border/70'>
        <div className='flex items-center gap-2 text-sm font-semibold text-foreground/60'>
          <span>
            {position} of {total}
          </span>
          <button
            type='button'
            onClick={onPrevious}
            aria-label='Previous flag'
            className='size-7 rounded-md border border-border flex items-center justify-center hover:bg-foreground/5 cursor-pointer'
          >
            <ArrowLeft className='size-3.5' />
          </button>
          <button
            type='button'
            onClick={onNext}
            aria-label='Next flag'
            className='size-7 rounded-md border border-border flex items-center justify-center hover:bg-foreground/5 cursor-pointer'
          >
            <ArrowRight className='size-3.5' />
          </button>
        </div>
        <button
          type='button'
          onClick={onClose}
          aria-label='Close details'
          className='text-foreground/60 hover:text-foreground cursor-pointer'
        >
          <X className='size-5' />
        </button>
      </div>

      <div className='flex-1 overflow-y-auto px-6 py-5 space-y-5'>
        <div className='h-44 rounded-xl bg-foreground/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] flex items-center justify-center'>
          {item.previewUrl && (
            <Image
              src={item.previewUrl}
              alt={item.name || 'Flag preview'}
              width={320}
              height={200}
              className='max-h-32 w-auto max-w-[85%] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)]'
            />
          )}
        </div>

        <div className='space-y-1.5'>
          <label htmlFor='batch-flag-name' className='text-sm font-semibold'>
            Name
          </label>
          <Input
            id='batch-flag-name'
            value={item.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder='Flag name'
          />
          {item.origin && (
            <p className='text-xs text-foreground/60 truncate'>
              From <span className='font-mono'>{item.origin}</span>
            </p>
          )}
        </div>

        <div className='space-y-1.5'>
          {overrideSource ? (
            <SourcesInput
              sources={item.ownSources}
              onSourcesChange={(sources) => onChange({ ownSources: sources })}
              placeholder='Enter URL (must start with http:// or https://)...'
              label='Sources'
            />
          ) : (
            <>
              <p className='text-sm font-semibold'>Source</p>
              <div className='min-h-10 rounded-lg border border-dashed border-border px-3 py-2 flex items-center gap-2 text-sm text-foreground/60'>
                <CornerDownRight className='size-4 shrink-0' />
                <span className='truncate'>
                  {sharedSource.trim() ? 'Using the shared source' : 'No shared source yet'}
                </span>
                <span>·</span>
                <button
                  type='button'
                  onClick={() => setOverrideSource(true)}
                  className='font-semibold text-main hover:underline cursor-pointer shrink-0'
                >
                  Add its own
                </button>
              </div>
            </>
          )}
        </div>

        <div className='pt-1 space-y-4'>
          <p className='text-xs font-bold uppercase tracking-wider text-foreground/50'>
            Optional
          </p>
          <TagInput
            tags={item.tags}
            onTagsChange={(tags) => onChange({ tags })}
            placeholder='Enter tags...'
          />
          <div className='space-y-2'>
            <label htmlFor='batch-flag-description' className='text-sm font-semibold'>
              Description
            </label>
            <Textarea
              id='batch-flag-description'
              value={item.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder='Describe the flag, its history, or any interesting facts...'
            />
          </div>
          <div className='space-y-2'>
            <p className='text-sm font-semibold'>Related flags</p>
            <RelatedFlagInput
              relatedFlags={item.relatedFlags}
              onAdd={(flag) => onChange({ relatedFlags: [...item.relatedFlags, flag] })}
              onRemove={(id) =>
                onChange({
                  relatedFlags: item.relatedFlags.filter((flag) => flag.id !== id),
                })
              }
            />
          </div>
          <div className='space-y-2'>
            <label htmlFor='batch-flag-message' className='text-sm font-semibold'>
              Note for moderators
            </label>
            <Textarea
              id='batch-flag-message'
              value={item.userMessage}
              onChange={(event) => onChange({ userMessage: event.target.value })}
              placeholder='Anything the moderators should know?'
            />
          </div>
        </div>
      </div>

      <div className='px-6 py-4 border-t border-border/70 flex items-center gap-3'>
        <Button variant='neutral' size='sm' onClick={onRemove} className='text-red-600'>
          <Trash2 />
          Remove
        </Button>
        <div className='flex-1' />
        {position < total ? (
          <Button size='sm' onClick={onNext}>
            Next flag
            <ArrowRight />
          </Button>
        ) : (
          <Button size='sm' onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </aside>
  );
}
