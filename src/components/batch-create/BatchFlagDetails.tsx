'use client';

import RelatedFlagInput from '@/components/related-flag-input';
import SourcesInput from '@/components/SourcesInput';
import TagInput from '@/components/TagInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  ArrowRight,
  CornerDownRight,
  Trash2,
  X,
} from '@/components/icons';
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
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
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
  const [overrideSource, setOverrideSource] = useState(
    item.ownSources.length > 0,
  );

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
      className='fixed inset-0 z-40 flex flex-col overflow-hidden bg-popover shadow-pop sm:inset-auto sm:bottom-4 sm:right-4 sm:top-20 sm:w-[440px] sm:rounded-[20px]'
    >
      <div className='flex items-center justify-between border-b border-line px-5 py-3.5'>
        <div className='flex items-center gap-1.5'>
          <Button
            variant='neutral'
            size='icon-sm'
            onClick={onPrevious}
            aria-label='Previous flag'
          >
            <ArrowLeft />
          </Button>
          <Button
            variant='neutral'
            size='icon-sm'
            onClick={onNext}
            aria-label='Next flag'
          >
            <ArrowRight />
          </Button>
          <span className='ml-1.5 tabular-nums text-xs text-muted-foreground'>
            {position} / {total}
          </span>
        </div>
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={onClose}
          aria-label='Close details'
        >
          <X />
        </Button>
      </div>

      <div className='flex-1 space-y-5 overflow-y-auto px-5 py-5'>
        <div className='grid h-44 place-items-center rounded-[14px] bg-stage'>
          {item.previewUrl && (
            <Image
              src={item.previewUrl}
              alt={item.name || 'Flag preview'}
              width={320}
              height={200}
              className='max-h-32 w-auto max-w-[85%] object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.18)]'
            />
          )}
        </div>

        <div className='space-y-1.5'>
          <label
            htmlFor='batch-flag-name'
            className='block text-[13px] font-medium'
          >
            Name
          </label>
          <Input
            id='batch-flag-name'
            value={item.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder='Flag name'
          />
          {item.origin && (
            <p className='truncate text-xs text-muted-foreground'>
              From <span className='tabular-nums'>{item.origin}</span>
            </p>
          )}
        </div>

        <div className='space-y-1.5'>
          {overrideSource ? (
            <SourcesInput
              sources={item.ownSources}
              onSourcesChange={(sources) => onChange({ ownSources: sources })}
              placeholder='https://…'
              label='Sources'
            />
          ) : (
            <>
              <p className='text-[13px] font-medium'>Source</p>
              <div className='flex min-h-10 items-center gap-2 rounded-[11px] border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground'>
                <CornerDownRight className='size-4 shrink-0' />
                <span className='flex-1 truncate'>
                  {sharedSource.trim()
                    ? 'Using the shared source'
                    : 'No shared source yet'}
                </span>
                <button
                  type='button'
                  onClick={() => setOverrideSource(true)}
                  className='shrink-0 cursor-pointer font-medium text-foreground underline-offset-2 hover:underline'
                >
                  Add its own
                </button>
              </div>
            </>
          )}
        </div>

        <div className='space-y-5 border-t border-line pt-5'>
          <p className='vx-label'>Optional</p>
          <TagInput
            tags={item.tags}
            onTagsChange={(tags) => onChange({ tags })}
            placeholder='Add a tag...'
          />
          <div className='space-y-1.5'>
            <label
              htmlFor='batch-flag-description'
              className='block text-[13px] font-medium'
            >
              Description
            </label>
            <Textarea
              id='batch-flag-description'
              value={item.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              placeholder='Describe the flag, its history, or any interesting facts...'
            />
          </div>
          <div className='space-y-1.5'>
            <p className='text-[13px] font-medium'>Related flags</p>
            <RelatedFlagInput
              relatedFlags={item.relatedFlags}
              onAdd={(flag) =>
                onChange({ relatedFlags: [...item.relatedFlags, flag] })
              }
              onRemove={(id) =>
                onChange({
                  relatedFlags: item.relatedFlags.filter(
                    (flag) => flag.id !== id,
                  ),
                })
              }
            />
          </div>
          <div className='space-y-1.5'>
            <label
              htmlFor='batch-flag-message'
              className='block text-[13px] font-medium'
            >
              Note for moderators
            </label>
            <Textarea
              id='batch-flag-message'
              value={item.userMessage}
              onChange={(event) =>
                onChange({ userMessage: event.target.value })
              }
              placeholder='Anything the moderators should know?'
            />
          </div>
        </div>
      </div>

      <div className='flex items-center gap-2 border-t border-line px-5 py-3.5'>
        <Button
          variant='ghost'
          size='sm'
          onClick={onRemove}
          className='text-bad hover:text-bad'
        >
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
