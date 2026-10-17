'use client';

import {
  type BatchFlagRequestInput,
  createFlagRequests,
  getRemainingFlagRequestSlots,
} from '@/actions/requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/icons';
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

const ACCEPTED_FILE_TYPES =
  'image/svg+xml,image/png,image/jpeg,image/gif,image/webp,image/avif,.svg';

type SubmittedFlag = {
  id: string;
  name: string;
  previewUrl: string;
  published: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function describeBlockingIssue(
  item: BatchFlagItem,
  issue: BatchFlagIssue,
): string {
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
        event.dataTransfer?.getData('text/uri-list') ||
          event.dataTransfer?.getData('text/plain') ||
          '',
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

      const added = handleIncomingData(
        files,
        event.clipboardData?.getData('text') ?? '',
      );
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
  const uploadingCount = items.filter(
    (item) => item.upload.state === 'uploading',
  ).length;
  const needsLookCount = items.filter((item) =>
    (issuesById[item.id] ?? []).some((issue) =>
      [
        'upload-error',
        'duplicate',
        'batch-duplicate',
        'file-like-name',
        'missing-name',
      ].includes(issue.kind),
    ),
  ).length;
  const missingSourceCount = items.filter((item) =>
    (issuesById[item.id] ?? []).some(
      (issue) => issue.kind === 'missing-source',
    ),
  ).length;
  const overLimit =
    slots !== undefined && !slots.isTrusted && items.length > slots.remaining;

  const focusItem = useCallback((id: string) => {
    const element = document.querySelector<HTMLElement>(
      `[data-batch-flag-id="${id}"]`,
    );
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(id);
    setTimeout(
      () => setHighlightedId((current) => (current === id ? null : current)),
      1600,
    );
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
      if (
        blocking.issue.kind === 'missing-source' &&
        blocking.item.ownSources.length === 0
      ) {
        sharedSourceRef.current?.focus();
        sharedSourceRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
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
        flags: items.map((item, index) => ({
          id: item.id,
          name: item.name.trim(),
          previewUrl: item.imageUrl ?? item.previewUrl,
          published: result.published[index] ?? false,
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
  }, [
    focusItem,
    isSubmitting,
    issues,
    items,
    overLimit,
    queryClient,
    reset,
    slots,
    sourcesFor,
  ]);

  // ⌘/Ctrl + Enter submits from anywhere.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Enter' &&
        (event.metaKey || event.ctrlKey) &&
        items.length > 0
      ) {
        event.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, items.length]);

  const openFilePicker = () => fileInputRef.current?.click();

  const focusNextName = (id: string) => {
    const inputs = Array.from(
      document.querySelectorAll<HTMLTextAreaElement>('[data-batch-name-input]'),
    );
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
    <div className='pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-[2px]'>
      <div className='rounded-[20px] bg-popover px-12 py-10 text-center shadow-pop'>
        <Upload className='mx-auto size-8 text-main' />
        <p className='mt-3 text-[15px] font-semibold'>Drop to add flags</p>
      </div>
    </div>
  );

  if (submitted) {
    const count = submitted.flags.length;
    const publishedCount = submitted.flags.filter(
      (flag) => flag.published,
    ).length;
    const allPublished = publishedCount === count;
    return (
      <div className='mx-auto max-w-[920px] px-4 pb-16 pt-7 md:px-8'>
        <div className='flex items-start gap-3'>
          <span className='mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-good-soft text-good'>
            <Check className='size-4' />
          </span>
          <div>
            <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>
              {count} flag{count === 1 ? '' : 's'}{' '}
              {allPublished ? 'published' : 'submitted'}
            </h1>
            <p className='mt-0.5 text-[13px] text-muted-foreground'>
              {allPublished
                ? 'You’re a trusted creator, so they’re live on Vexilo already.'
                : publishedCount > 0
                  ? `${publishedCount} went live right away. The rest are with the moderators.`
                  : 'They’re with the moderators and will show up once approved.'}
            </p>
          </div>
        </div>
        <section className='vx-tile mt-6 p-5'>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5'>
            {submitted.flags.map((flag) => (
              <div key={flag.id} className='min-w-0'>
                <div className='grid h-20 place-items-center rounded-xl bg-stage'>
                  <Image
                    src={flag.previewUrl}
                    alt={flag.name}
                    width={120}
                    height={80}
                    className='max-h-12 w-auto max-w-[75%] object-contain drop-shadow-[0_2px_4px_rgb(0_0_0/0.16)]'
                  />
                </div>
                {flag.published ? (
                  <Link
                    href={`/flag/${encodeURIComponent(flag.name)}`}
                    className='mt-2 block truncate text-[13px] font-medium hover:underline'
                  >
                    {flag.name}
                  </Link>
                ) : (
                  <p className='mt-2 truncate text-[13px] font-medium'>
                    {flag.name}
                  </p>
                )}
                {flag.published ? (
                  <p className='flex items-center gap-1 text-[11.5px] text-good'>
                    <Check className='size-3' />
                    Live
                  </p>
                ) : (
                  <p className='flex items-center gap-1 text-[11.5px] text-muted-foreground'>
                    <Clock className='size-3' />
                    In review
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
        <div className='mt-6 flex flex-col gap-2 sm:flex-row'>
          <Button onClick={() => setSubmitted(null)}>
            <Plus />
            Add more flags
          </Button>
          {submitted.userNumber !== null && (
            <Button variant='neutral' asChild>
              <Link href={`/profile/${submitted.userNumber}`}>
                View my profile
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className='mx-auto max-w-[920px] px-4 pb-16 pt-7 md:px-8'>
        {fileInput}
        {dragOverlay}
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>
          Post flags
        </h1>
        <p className='mt-1 text-[13px] text-muted-foreground'>
          Add one flag or many. Check the names, add a source, then submit.
        </p>
        <button
          type='button'
          onClick={openFilePicker}
          className='vx-well mt-6 flex min-h-[300px] w-full cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-border px-6 text-center transition-colors hover:border-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[360px]'
        >
          <Upload className='size-7 text-muted-foreground' />
          <span className='mt-4 text-[15px] font-semibold'>
            Drop flag images here
          </span>
          <span className='mt-1 text-[13px] text-muted-foreground'>
            SVG, PNG or JPG. Select as many as you like.
          </span>
          <span className='mt-6 flex flex-col items-center gap-3 sm:flex-row'>
            <Button asChild variant='neutral'>
              <span>
                <FolderOpen />
                Choose files
              </span>
            </Button>
            <span className='text-[13px] text-muted-foreground'>
              or paste images or Wikimedia links{' '}
              <kbd className='tabular-nums text-[11px]'>⌘V</kbd>
            </span>
          </span>
        </button>
        <div className='mt-6 grid gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3'>
          <div className='flex gap-2.5'>
            <WandSparkles className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
            <p>
              <span className='font-medium'>Names from file names.</span>{' '}
              <span className='text-muted-foreground'>
                “Flag_of_Cochin.svg” becomes “Cochin”.
              </span>
            </p>
          </div>
          <div className='flex gap-2.5'>
            <Link2 className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
            <p>
              <span className='font-medium'>Wikimedia links.</span>{' '}
              <span className='text-muted-foreground'>
                A link brings the image, name and source.
              </span>
            </p>
          </div>
          <div className='flex gap-2.5'>
            <Copy className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
            <p>
              <span className='font-medium'>Duplicate check.</span>{' '}
              <span className='text-muted-foreground'>
                Flags already on Vexilo are pointed out.
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-44 pt-7 md:px-8'>
      {fileInput}
      {dragOverlay}

      <div className='mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
        <div>
          <h1 className='flex items-baseline gap-2.5 text-[22px] font-semibold tracking-[-0.03em]'>
            Post flags
            <span className='tabular-nums text-[13px] font-normal tracking-normal text-muted-foreground'>
              {items.length}
            </span>
          </h1>
          <p className='mt-1 text-[13px] text-muted-foreground'>
            Check the names, add a source, then submit. Everything else is
            optional.
          </p>
        </div>
        <Button variant='neutral' onClick={openFilePicker}>
          <Plus />
          Add more
        </Button>
      </div>

      <section className='vx-tile mb-6 px-5 py-4'>
        <label
          htmlFor='batch-shared-source'
          className='mb-1.5 block text-[13px] font-medium'
        >
          Source for every flag
        </label>
        <div className='flex flex-col gap-2 md:flex-row md:items-center md:gap-4'>
          <Input
            ref={sharedSourceRef}
            id='batch-shared-source'
            value={sharedSource}
            onChange={(event) => setSharedSource(event.target.value)}
            placeholder='https://… where these flags come from'
            className={cn(
              'md:flex-1',
              sharedSource.trim() && !sharedSourceValid
                ? 'shadow-[var(--sh-well),0_0_0_1.5px_var(--bad)]!'
                : missingSourceCount > 0 && !sharedSource.trim()
                  ? 'shadow-[var(--sh-well),0_0_0_1.5px_var(--main)]!'
                  : undefined,
            )}
          />
          <span
            className={cn(
              'text-xs leading-snug md:w-60',
              sharedSource.trim() && !sharedSourceValid
                ? 'text-bad'
                : missingSourceCount > 0
                  ? 'text-subtle'
                  : 'text-muted-foreground',
            )}
          >
            {sharedSource.trim() && !sharedSourceValid
              ? 'Must be a link starting with http:// or https://'
              : missingSourceCount > 0
                ? `${missingSourceCount} flag${missingSourceCount === 1 ? ' needs' : 's need'} a source.`
                : 'Flags with their own source (like Wikimedia links) keep it.'}
          </span>
        </div>
      </section>

      <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
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
            onApplySuggestion={(suggestion) =>
              updateItem(item.id, { name: suggestion })
            }
            onDismissSuggestion={() =>
              updateItem(item.id, { nameSuggestionDismissed: true })
            }
          />
        ))}
        <button
          type='button'
          onClick={openFilePicker}
          className='flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        >
          <Plus className='size-5' />
          Add more
        </button>
      </div>

      <div className='pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:pb-6'>
        <div className='pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-[18px] bg-popover px-4 py-3 shadow-pop sm:gap-4 sm:px-5'>
          <div className='hidden -space-x-2.5 sm:flex'>
            {items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className='grid size-9 place-items-center overflow-hidden rounded-[10px] bg-stage shadow-[0_0_0_2px_var(--surface-hi)]'
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
          <div className='min-w-0 flex-1 text-[13px]'>
            <div className='truncate'>
              <span className='font-semibold'>
                {items.length} flag{items.length === 1 ? '' : 's'}
              </span>
              {uploadingCount > 0 ? (
                <span className='text-muted-foreground'>
                  {' '}
                  · uploading {uploadingCount}…
                </span>
              ) : needsLookCount > 0 ? (
                <span className='font-medium text-main'>
                  {' '}
                  · {needsLookCount} need{needsLookCount === 1 ? 's' : ''} a
                  look
                </span>
              ) : null}
            </div>
            <div className='truncate text-xs text-muted-foreground'>
              {overLimit && slots
                ? `You can submit ${slots.remaining} more right now (${slots.max} waiting for review max)`
                : slots?.isTrusted
                  ? 'You’re trusted, so they’ll go live right away'
                  : 'They’ll go to the moderators for review'}
            </div>
          </div>
          <kbd className='hidden tabular-nums text-[11px] text-muted-foreground md:inline'>
            ⌘↵
          </kbd>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className='animate-spin' /> : <Send />}
            {slots?.isTrusted ? 'Publish' : 'Submit'} {items.length} flag
            {items.length === 1 ? '' : 's'}
          </Button>
        </div>
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
            const nextItem =
              items[selectedIndex + 1] ?? items[selectedIndex - 1] ?? null;
            removeItem(selectedItem.id);
            setSelectedId(
              nextItem && nextItem.id !== selectedItem.id ? nextItem.id : null,
            );
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
