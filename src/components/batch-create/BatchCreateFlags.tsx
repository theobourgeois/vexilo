'use client';

import {
  type BatchFlagRequestInput,
  createFlagRequests,
  getRemainingFlagRequestSlots,
} from '@/actions/requests';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { extractUrls } from '@/lib/batch-flags';
import { cn } from '@/lib/utils';
import { toastErrorWithLogin } from '@/lib/toast-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock,
  Copy,
  FolderOpen,
  Link2,
  Loader2,
  Plus,
  Send,
  Upload,
  WandSparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import BatchFlagCard from './BatchFlagCard';
import BatchFlagDetails from './BatchFlagDetails';
import {
  type BatchFlagIssue,
  type BatchFlagItem,
  isBlockingIssue,
  useBatchFlags,
} from './use-batch-flags';

const ACCEPTED_FILE_TYPES = 'image/svg+xml,image/png,image/jpeg,image/gif,image/webp,image/avif,.svg';

type SubmittedFlag = { id: string; name: string; previewUrl: string };

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function describeBlockingIssue(item: BatchFlagItem, issue: BatchFlagIssue): string {
  const name = item.name.trim() || 'A flag';
  switch (issue.kind) {
    case 'uploading':
      return `${name} is still uploading.`;
    case 'upload-error':
      return `${name} failed to upload. Retry or remove it.`;
    case 'missing-name':
      return 'A flag is missing a name.';
    case 'missing-source':
      return 'Add a source for every flag (or one shared source at the top).';
    case 'duplicate':
      return `${name} is already on Vexilo. Remove it or keep it anyway.`;
    case 'batch-duplicate':
      return `${name} is in this batch twice.`;
    default:
      return `${name} needs a look.`;
  }
}

export default function BatchCreateFlags() {
  const {
    items,
    sharedSource,
    setSharedSource,
    sharedSourceValid,
    sourcesFor,
    issuesById,
    addFiles,
    addUrls,
    updateItem,
    removeItem,
    retryItem,
    canRetry,
    reset,
  } = useBatchFlags();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sharedSourceRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{
    flags: SubmittedFlag[];
    userNumber: string | null;
  } | null>(null);

  const { data: slots } = useQuery({
    queryKey: ['flag-request-slots'],
    queryFn: () => getRemainingFlagRequestSlots(),
  });

  const handleIncomingData = useCallback(
    (files: File[], text: string) => {
      let added = 0;
      if (files.length > 0) {
        added += addFiles(files);
      } else if (text) {
        added += addUrls(extractUrls(text));
        if (added === 0 && extractUrls(text).length > 0) {
          toast.error('Those links aren’t images or Wikimedia files.');
        }
      }
      return added;
    },
    [addFiles, addUrls],
  );

  // Drop anywhere on the page.
  useEffect(() => {
    const hasDraggableData = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).some((type) =>
        ['Files', 'text/uri-list'].includes(type),
      );

    const handleDragEnter = (event: DragEvent) => {
      if (!hasDraggableData(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDragging(true);
    };
    const handleDragOver = (event: DragEvent) => {
      if (!hasDraggableData(event)) return;
      event.preventDefault();
    };
    const handleDragLeave = () => {
      dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);
      if (dragDepthRef.current === 0) setIsDragging(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (!hasDraggableData(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      handleIncomingData(
        Array.from(event.dataTransfer?.files ?? []),
        event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain') || '',
      );
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleIncomingData]);

  // Paste images or links anywhere (text fields keep normal text pasting).
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0 && isTypingTarget(event.target)) return;

      const added = handleIncomingData(files, event.clipboardData?.getData('text') ?? '');
      if (added > 0) {
        event.preventDefault();
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleIncomingData]);

  const issues = items.flatMap((item) =>
    (issuesById[item.id] ?? []).map((issue) => ({ item, issue })),
  );
  const uploadingCount = items.filter((item) => item.upload.state === 'uploading').length;
  const needsLookCount = items.filter((item) =>
    (issuesById[item.id] ?? []).some((issue) =>
      ['upload-error', 'duplicate', 'batch-duplicate', 'file-like-name', 'missing-name'].includes(issue.kind),
    ),
  ).length;
  const missingSourceCount = items.filter((item) =>
    (issuesById[item.id] ?? []).some((issue) => issue.kind === 'missing-source'),
  ).length;
  const overLimit = slots !== undefined && items.length > slots.remaining;

  const focusItem = useCallback((id: string) => {
    const element = document.querySelector<HTMLElement>(`[data-batch-flag-id="${id}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(id);
    setTimeout(() => setHighlightedId((current) => (current === id ? null : current)), 1600);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || items.length === 0) return;

    if (overLimit && slots) {
      toast.error(
        slots.remaining > 0
          ? `You can have ${slots.max} flags waiting for review. Remove some to submit the other ${slots.remaining}.`
          : `You already have ${slots.max} flags waiting for review. Wait for some to be approved first.`,
      );
      return;
    }

    const blocking = issues.find(({ issue }) => isBlockingIssue(issue));
    if (blocking) {
      toast.error(describeBlockingIssue(blocking.item, blocking.issue));
      if (blocking.issue.kind === 'missing-source' && blocking.item.ownSources.length === 0) {
        sharedSourceRef.current?.focus();
        sharedSourceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        focusItem(blocking.item.id);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const batch: BatchFlagRequestInput[] = items.map((item) => ({
        flagName: item.name.trim(),
        flagImage: item.imageUrl!,
        sources: sourcesFor(item),
        tags: item.tags,
        description: item.description,
        relatedFlags: item.relatedFlags,
        userMessage: item.userMessage,
      }));
      const result = await createFlagRequests(batch);
      if (!result.success) {
        toastErrorWithLogin(result.message);
        return;
      }

      setSubmitted({
        flags: items.map((item) => ({
          id: item.id,
          name: item.name.trim(),
          previewUrl: item.imageUrl ?? item.previewUrl,
        })),
        userNumber: result.userNumber,
      });
      setSelectedId(null);
      reset();
      queryClient.invalidateQueries({ queryKey: ['flag-request-slots'] });
      window.scrollTo({ top: 0 });
    } catch (error) {
      console.error(error);
      toast.error('Something went wrong while submitting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [focusItem, isSubmitting, issues, items, overLimit, queryClient, reset, slots, sourcesFor]);

  // ⌘/Ctrl + Enter submits from anywhere.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && items.length > 0) {
        event.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, items.length]);

  const openFilePicker = () => fileInputRef.current?.click();

  const focusNextName = (id: string) => {
    const inputs = Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-batch-name-input]'));
    const index = items.findIndex((item) => item.id === id);
    const next = inputs[index + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };

  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const selectedItem = selectedIndex === -1 ? null : items[selectedIndex];
  const goToOffset = (offset: number) => {
    if (selectedIndex === -1 || items.length === 0) return;
    const nextIndex = (selectedIndex + offset + items.length) % items.length;
    setSelectedId(items[nextIndex].id);
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type='file'
      multiple
      accept={ACCEPTED_FILE_TYPES}
      className='hidden'
      onChange={(event) => {
        handleIncomingData(Array.from(event.target.files ?? []), '');
        event.target.value = '';
      }}
    />
  );

  const dragOverlay = isDragging && (
    <div className='fixed inset-0 z-50 pointer-events-none bg-main/10 backdrop-blur-[2px] flex items-center justify-center'>
      <div className='rounded-3xl border-4 border-dashed border-main bg-secondary-background/90 px-12 py-10 text-center shadow-2xl'>
        <Upload className='mx-auto size-10 text-main' />
        <p className='mt-3 text-xl font-bold'>Drop to add flags</p>
      </div>
    </div>
  );

  if (submitted) {
    const count = submitted.flags.length;
    return (
      <div className='max-w-4xl mx-auto px-4 py-12 sm:py-16 text-center'>
        <div className='mx-auto size-16 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center mb-5'>
          <Check className='size-8 text-green-600' />
        </div>
        <h1 className='text-3xl sm:text-4xl font-bold tracking-tight'>
          {count} flag{count === 1 ? '' : 's'} submitted
        </h1>
        <p className='text-foreground/60 mt-2 text-lg'>
          They&apos;re with the moderators and will show up once approved.
        </p>
        <Card className='mt-10 p-6 gap-0'>
          <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4'>
            {submitted.flags.map((flag) => (
              <div key={flag.id} className='text-left min-w-0'>
                <div className='h-20 rounded-xl bg-foreground/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] flex items-center justify-center'>
                  <Image
                    src={flag.previewUrl}
                    alt={flag.name}
                    width={120}
                    height={80}
                    className='max-h-12 w-auto max-w-[80%] object-contain'
                  />
                </div>
                <p className='text-xs font-semibold mt-1.5 truncate'>{flag.name}</p>
                <p className='text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1'>
                  <Clock className='size-3' />
                  In review
                </p>
              </div>
            ))}
          </div>
        </Card>
        <div className='flex flex-col sm:flex-row justify-center gap-3 mt-10'>
          <Button size='lg' onClick={() => setSubmitted(null)}>
            <Plus />
            Add more flags
          </Button>
          {submitted.userNumber !== null && (
            <Button size='lg' variant='neutral' asChild>
              <Link href={`/profile/${submitted.userNumber}`}>View my profile</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className='max-w-5xl mx-auto px-4 py-12 sm:pt-14'>
        {fileInput}
        {dragOverlay}
        <div className='text-center mb-10'>
          <h1 className='text-3xl sm:text-4xl font-bold tracking-tight'>Add flags</h1>
          <p className='text-foreground/60 mt-2 text-lg'>
            One flag or a hundred, it&apos;s the same few steps.
          </p>
        </div>
        <button
          type='button'
          onClick={openFilePicker}
          className='w-full rounded-[28px] border-[3px] border-dashed border-main/60 bg-secondary-background/60 hover:bg-secondary-background transition-colors min-h-[360px] sm:min-h-[430px] flex flex-col items-center justify-center text-center px-6 cursor-pointer'
        >
          <Upload className='size-14 text-main mb-6' />
          <span className='text-2xl font-bold'>Drop flag images anywhere</span>
          <span className='text-foreground/60 mt-2'>
            SVG, PNG or JPG. Select as many as you like.
          </span>
          <span className='flex flex-col sm:flex-row items-center gap-3 mt-7'>
            <Button asChild size='lg'>
              <span>
                <FolderOpen />
                Choose files
              </span>
            </Button>
            <span className='text-foreground/60 text-sm'>
              or paste images or Wikimedia links (⌘V)
            </span>
          </span>
        </button>
        <div className='grid sm:grid-cols-3 gap-5 mt-10 text-sm'>
          <div className='flex gap-3'>
            <WandSparkles className='size-5 text-main shrink-0' />
            <p>
              <b>Names fill themselves.</b>{' '}
              <span className='text-foreground/60'>&quot;Flag_of_Cochin.svg&quot; becomes &quot;Cochin&quot;.</span>
            </p>
          </div>
          <div className='flex gap-3'>
            <Link2 className='size-5 text-main shrink-0' />
            <p>
              <b>Wikimedia links just work.</b>{' '}
              <span className='text-foreground/60'>Paste a link and you get the image, name and source.</span>
            </p>
          </div>
          <div className='flex gap-3'>
            <Copy className='size-5 text-main shrink-0' />
            <p>
              <b>Duplicates get caught.</b>{' '}
              <span className='text-foreground/60'>If a flag is already on Vexilo, you&apos;ll be told.</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-44'>
      {fileInput}
      {dragOverlay}

      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            {items.length} flag{items.length === 1 ? '' : 's'} ready
          </h1>
          <p className='text-foreground/60 mt-1'>
            Check the names, add a source, then submit. Everything else is optional.
          </p>
        </div>
        <Button variant='neutral' onClick={openFilePicker}>
          <Plus />
          Add more
        </Button>
      </div>

      <Card className='px-5 py-4 gap-0 mb-8 flex-row items-center gap-4'>
        <div className='hidden sm:flex size-10 rounded-xl bg-foreground/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] items-center justify-center shrink-0'>
          <Link2 className='size-5 text-main' />
        </div>
        <div className='flex-1 min-w-0'>
          <label
            htmlFor='batch-shared-source'
            className='block text-[11px] font-bold uppercase tracking-wider text-foreground/50 mb-1'
          >
            Source for every flag
          </label>
          <div className='flex flex-col md:flex-row md:items-center gap-2'>
            <input
              ref={sharedSourceRef}
              id='batch-shared-source'
              value={sharedSource}
              onChange={(event) => setSharedSource(event.target.value)}
              placeholder='https://… where these flags come from'
              className={cn(
                'flex-1 h-10 rounded-lg border border-border bg-secondary-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-main',
                sharedSource.trim() && !sharedSourceValid && 'border-red-400',
                missingSourceCount > 0 && !sharedSource.trim() && 'border-amber-400',
              )}
            />
            <span className='text-xs text-foreground/60 md:w-56 leading-tight'>
              {sharedSource.trim() && !sharedSourceValid
                ? 'Must be a link starting with http:// or https://'
                : missingSourceCount > 0
                  ? `${missingSourceCount} flag${missingSourceCount === 1 ? ' needs' : 's need'} a source.`
                  : 'Flags with their own source (like Wikimedia links) keep it.'}
            </span>
          </div>
        </div>
      </Card>

      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6'>
        {items.map((item) => (
          <BatchFlagCard
            key={item.id}
            item={item}
            issues={issuesById[item.id] ?? []}
            selected={item.id === selectedId}
            highlighted={item.id === highlightedId}
            usesOwnSource={item.ownSources.length > 0}
            canRetry={canRetry(item.id)}
            onNameChange={(name) => updateItem(item.id, { name })}
            onNameEnter={() => focusNextName(item.id)}
            onOpenDetails={() => setSelectedId(item.id)}
            onRemove={() => {
              if (selectedId === item.id) setSelectedId(null);
              removeItem(item.id);
            }}
            onRetry={() => retryItem(item.id)}
            onKeepDuplicate={() => updateItem(item.id, { keepDuplicate: true })}
            onApplySuggestion={(suggestion) => updateItem(item.id, { name: suggestion })}
            onDismissSuggestion={() => updateItem(item.id, { nameSuggestionDismissed: true })}
          />
        ))}
        <button
          type='button'
          onClick={openFilePicker}
          className='min-h-[214px] rounded-2xl border-[3px] border-dashed border-main/40 hover:border-main/70 text-foreground/50 hover:text-foreground/70 text-sm font-semibold flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer'
        >
          <Plus className='size-6' />
          Drop more
        </button>
      </div>

      <div className='fixed bottom-0 inset-x-0 z-30 px-4 pb-4 sm:pb-6 pointer-events-none'>
        <Card className='max-w-3xl mx-auto px-4 sm:px-5 py-3.5 gap-0 flex-row items-center gap-3 sm:gap-4 pointer-events-auto'>
          <div className='hidden sm:flex -space-x-3'>
            {items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className='size-9 rounded-lg bg-secondary-background border border-border flex items-center justify-center shadow-sm overflow-hidden'
              >
                {item.previewUrl && (
                  <Image
                    src={item.previewUrl}
                    alt=''
                    width={28}
                    height={20}
                    className='max-h-5 w-auto max-w-7 object-contain'
                  />
                )}
              </div>
            ))}
          </div>
          <div className='flex-1 min-w-0 text-sm'>
            <div className='truncate'>
              <b>
                {items.length} flag{items.length === 1 ? '' : 's'}
              </b>
              {uploadingCount > 0 ? (
                <span className='text-foreground/60'> · uploading {uploadingCount}…</span>
              ) : needsLookCount > 0 ? (
                <span className='text-amber-700 dark:text-amber-400 font-semibold'>
                  {' '}· {needsLookCount} need{needsLookCount === 1 ? 's' : ''} a quick look
                </span>
              ) : null}
            </div>
            <div className='text-foreground/60 text-xs truncate'>
              {overLimit && slots
                ? `You can submit ${slots.remaining} more right now (${slots.max} waiting for review max)`
                : 'They’ll go to the moderators for review'}
            </div>
          </div>
          <span className='hidden md:inline text-xs text-foreground/50 font-semibold'>⌘↵</span>
          <Button onClick={handleSubmit} disabled={isSubmitting} size='lg' className='px-4 sm:px-6'>
            {isSubmitting ? <Loader2 className='animate-spin' /> : <Send />}
            Submit {items.length} flag{items.length === 1 ? '' : 's'}
          </Button>
        </Card>
      </div>

      {selectedItem && (
        <BatchFlagDetails
          item={selectedItem}
          position={selectedIndex + 1}
          total={items.length}
          sharedSource={sharedSource}
          onChange={(patch) => updateItem(selectedItem.id, patch)}
          onPrevious={() => goToOffset(-1)}
          onNext={() => goToOffset(1)}
          onRemove={() => {
            const nextItem = items[selectedIndex + 1] ?? items[selectedIndex - 1] ?? null;
            removeItem(selectedItem.id);
            setSelectedId(nextItem && nextItem.id !== selectedItem.id ? nextItem.id : null);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
