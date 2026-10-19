'use client';

import { type ReviewQueueItem, updatePendingFlagRequest } from '@/actions/requests';
import { MakerBadge } from '@/components/MakerBadge';
import { cn } from '@/lib/utils';
import { Check, CircleCheck, Copy, PartyPopper, SkipForward, Undo2, X } from '@/components/icons';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EditDiff } from './EditDiff';
import { isTypingTarget, needsLook } from './review-utils';

type Decision = 'approved' | 'declined';

type FocusModeProps = {
  items: ReviewQueueItem[];
  onApprove: (id: string) => Promise<void> | void;
  onDecline: (id: string) => Promise<void> | void;
  onPatched: (id: string, patch: Partial<ReviewQueueItem['flag']>) => void;
  onClose: () => void;
};

/** Decisions are committed after this delay so the latest one can be undone. */
const UNDO_WINDOW_MS = 5000;

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className='inline-flex min-w-5 justify-center rounded-[6px] px-1.5 py-px tabular-nums text-[10.5px] font-medium leading-4 border border-white/15 bg-white/10 text-white/90'>
      {children}
    </kbd>
  );
}

export function FocusMode({ items: initialItems, onApprove, onDecline, onPatched, onClose }: FocusModeProps) {
  // Snapshot the queue so approving (which removes items from the cache) doesn't shift the list.
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [nameDraft, setNameDraft] = useState(initialItems[0]?.flag.flagName ?? '');
  const pendingRef = useRef<{ id: string; decision: Decision; timer: ReturnType<typeof setTimeout> } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const item = items[index] ?? null;
  const decidedCount = Object.keys(decisions).length;
  const isDone = decidedCount === items.length;

  useEffect(() => {
    setNameDraft(item?.flag.flagName ?? '');
  }, [item?.id, item?.flag.flagName]);

  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-focus-index="${index}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [index]);

  // Keep the latest handlers in a ref so commit/flush stay stable across parent renders.
  const handlersRef = useRef({ onApprove, onDecline });
  useEffect(() => {
    handlersRef.current = { onApprove, onDecline };
  }, [onApprove, onDecline]);

  const commit = useCallback((pending: { id: string; decision: Decision }) => {
    if (pending.decision === 'approved') handlersRef.current.onApprove(pending.id);
    else handlersRef.current.onDecline(pending.id);
  }, []);

  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    commit(pending);
  }, [commit]);

  // Commit whatever is still pending when focus mode closes.
  useEffect(() => () => flushPending(), [flushPending]);

  const findNextUndecided = useCallback(
    (from: number, nextDecisions: Record<string, Decision>) => {
      for (let offset = 1; offset <= items.length; offset++) {
        const candidate = (from + offset) % items.length;
        if (!nextDecisions[items[candidate].id]) return candidate;
      }
      return from;
    },
    [items],
  );

  const saveName = useCallback(async () => {
    if (!item) return;
    const flagName = nameDraft.trim();
    if (!flagName || flagName === item.flag.flagName) return;
    const result = await updatePendingFlagRequest(item.id, { flagName }).catch(() => null);
    if (!result) {
      toast.error('Could not rename.');
      return;
    }
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, flag: { ...entry.flag, flagName } } : entry)),
    );
    onPatched(item.id, { flagName });
  }, [item, nameDraft, onPatched]);

  const decide = useCallback(
    async (decision: Decision) => {
      if (!item || decisions[item.id]) return;
      await saveName();
      flushPending();
      const timer = setTimeout(() => {
        if (pendingRef.current?.id === item.id) {
          pendingRef.current = null;
          commit({ id: item.id, decision });
        }
      }, UNDO_WINDOW_MS);
      pendingRef.current = { id: item.id, decision, timer };
      const nextDecisions = { ...decisions, [item.id]: decision };
      setDecisions(nextDecisions);
      setIndex(findNextUndecided(index, nextDecisions));
    },
    [commit, decisions, findNextUndecided, flushPending, index, item, saveName],
  );

  const undo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) {
      toast('Nothing to undo. Earlier decisions are already saved.');
      return;
    }
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setDecisions((current) => {
      const next = { ...current };
      delete next[pending.id];
      return next;
    });
    setIndex(items.findIndex((entry) => entry.id === pending.id));
  }, [items]);

  const close = useCallback(() => {
    flushPending();
    onClose();
  }, [flushPending, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isTypingTarget(event.target)) (event.target as HTMLElement).blur();
        else close();
        return;
      }
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === 'a') decide('approved');
      else if (key === 'd') decide('declined');
      else if (key === 'z') undo();
      else if (key === 's' || event.key === 'ArrowRight') setIndex((current) => Math.min(current + 1, items.length - 1));
      else if (event.key === 'ArrowLeft') setIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close, decide, items.length, undo]);

  const approvedCount = Object.values(decisions).filter((decision) => decision === 'approved').length;
  const declinedCount = decidedCount - approvedCount;
  const currentDecision = item ? decisions[item.id] : undefined;
  const warning = item ? needsLook(item) : null;
  const imageChanged = item?.isEdit && item.oldFlag && item.oldFlag.flagImage !== item.flag.flagImage;

  return (
    <div className='dark fixed inset-0 z-50 bg-background text-white flex flex-col'>
      <div className='h-16 px-4 sm:px-8 flex items-center justify-between gap-4 border-b border-white/10 shrink-0'>
        <div className='flex items-center gap-3 text-sm'>
          <button type='button' onClick={close} aria-label='Close focus mode' className='text-white/60 hover:text-white cursor-pointer'>
            <X className='size-5' />
          </button>
          <span className='font-semibold'>Focus mode</span>
          <span className='hidden sm:inline text-white/50'>· {approvedCount} approved, {declinedCount} declined</span>
        </div>
        <div className='flex items-center gap-3 flex-1 max-w-md'>
          <div className='flex-1 h-2 rounded-full bg-white/10 overflow-hidden'>
            <div className='h-full bg-good rounded-full transition-all' style={{ width: `${(decidedCount / Math.max(items.length, 1)) * 100}%` }} />
          </div>
          <span className='tabular-nums text-[13px] text-white/70 whitespace-nowrap'>
            {Math.min(index + 1, items.length)} of {items.length}
          </span>
        </div>
        <button type='button' onClick={undo} className='text-sm text-white/60 hover:text-white flex items-center gap-1.5 cursor-pointer'>
          <Undo2 className='size-4' />
          <span className='hidden sm:inline'>Undo</span> <Kbd>Z</Kbd>
        </button>
      </div>

      {isDone ? (
        <div className='flex-1 flex flex-col items-center justify-center text-center gap-3 p-8'>
          <PartyPopper className='size-12 text-good' />
          <p className='text-[28px] font-semibold tracking-[-0.03em]'>All done</p>
          <p className='text-white/60'>
            {approvedCount} approved, {declinedCount} declined.
          </p>
          <button type='button' onClick={close} className='mt-4 h-11 px-6 rounded-[11px] bg-white text-black font-semibold cursor-pointer'>
            Back to the queue
          </button>
        </div>
      ) : item ? (
        <div className='flex-1 min-h-0 grid lg:grid-cols-[1fr_420px]'>
          <div className='flex flex-col items-center justify-center p-6 sm:p-10 min-h-0 gap-6'>
            {imageChanged ? (
              <div className='grid grid-cols-2 gap-6 w-full max-w-4xl'>
                {[
                  { label: 'Before', src: item.oldFlag!.flagImage },
                  { label: 'After', src: item.flag.flagImage },
                ].map(({ label, src }) => (
                  <div key={label} className='flex flex-col items-center gap-3'>
                    <span className='tabular-nums text-xs font-medium text-white/50'>{label}</span>
                    <Image src={src} alt={label} width={600} height={400} className='max-h-[40vh] w-auto rounded-md shadow-2xl' />
                  </div>
                ))}
              </div>
            ) : (
              <Image
                src={item.flag.flagImage}
                alt={item.flag.flagName}
                width={900}
                height={600}
                className='max-h-[55vh] w-auto max-w-full rounded-md shadow-2xl'
              />
            )}
          </div>

          <div className='border-t lg:border-t-0 lg:border-l border-white/10 p-6 sm:p-8 flex flex-col overflow-y-auto'>
            <p className={cn('tabular-nums text-xs font-medium', item.isEdit ? 'text-main' : 'text-good')}>
              {item.isEdit ? 'Edit' : 'New flag'} · {item.user.name || 'Anonymous'}
            </p>
            <textarea
              rows={1}
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  (event.target as HTMLTextAreaElement).blur();
                }
              }}
              aria-label='Flag name'
              className='mt-2 resize-none [field-sizing:content] bg-transparent text-2xl sm:text-[28px] font-semibold tracking-[-0.03em] leading-tight outline-none border-b border-transparent focus:border-white/30'
            />
            <MakerBadge tags={item.flag.tags} className='mt-2 self-start' />

            <div className='mt-6 space-y-4 text-sm'>
              {item.isEdit && item.oldFlag ? (
                <EditDiff before={item.oldFlag} after={item.flag} labelClassName='text-white/40' />
              ) : (
                <>
                  <div>
                    <p className='tabular-nums text-xs font-medium text-white/40 mb-1'>Source</p>
                    {(item.flag.sources ?? []).length > 0 ? (
                      item.flag.sources.map((source) => (
                        <a key={source} href={source} target='_blank' rel='noopener noreferrer' className='block truncate text-main underline underline-offset-2'>
                          {source.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      ))
                    ) : (
                      <p className='text-main font-medium'>No source</p>
                    )}
                  </div>
                  {(item.flag.tags ?? []).length > 0 && (
                    <div>
                      <p className='tabular-nums text-xs font-medium text-white/40 mb-1.5'>Tags</p>
                      <div className='flex flex-wrap gap-1.5'>
                        {item.flag.tags.map((tag) => (
                          <span key={tag} className='rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium'>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.flag.description && <p className='text-white/70 line-clamp-4'>{item.flag.description}</p>}
                </>
              )}
              {warning ? (
                <div className='rounded-[11px] bg-main-soft border border-main/35 px-3 py-2.5 flex items-center gap-2 text-white/90'>
                  <Copy className='size-4 shrink-0 text-main' />
                  <span>
                    {warning}
                    {item.duplicateOf && (
                      <>
                        :{' '}
                        <Link href={`/flag/${encodeURIComponent(item.duplicateOf)}`} target='_blank' className='underline'>
                          {item.duplicateOf}
                        </Link>
                      </>
                    )}
                  </span>
                </div>
              ) : (
                !item.isEdit && (
                  <div className='rounded-[11px] bg-good-soft border border-good/30 px-3 py-2.5 flex items-center gap-2 text-good'>
                    <CircleCheck className='size-4' />
                    No duplicates found
                  </div>
                )
              )}
              {item.userMessage && (
                <div className='rounded-[11px] bg-white/5 border border-white/10 px-3 py-2.5 text-white/80'>
                  <b>Note:</b> {item.userMessage}
                </div>
              )}
            </div>

            <div className='flex-1 min-h-6' />
            {currentDecision ? (
              <div className={cn('h-16 rounded-2xl flex items-center justify-center gap-2 font-semibold text-lg', currentDecision === 'approved' ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>
                {currentDecision === 'approved' ? <Check className='size-5' /> : <X className='size-5' />}
                {currentDecision === 'approved' ? 'Approved' : 'Declined'}
              </div>
            ) : (
              <div className='grid grid-cols-2 gap-3'>
                <button
                  type='button'
                  onClick={() => decide('declined')}
                  className='h-16 rounded-2xl bg-bad-soft border border-bad/40 text-bad font-semibold text-lg flex items-center justify-center gap-2 hover:bg-bad/25 transition-colors cursor-pointer'
                >
                  <X className='size-5' />
                  Decline <Kbd>D</Kbd>
                </button>
                <button
                  type='button'
                  onClick={() => decide('approved')}
                  className='h-16 rounded-2xl bg-good text-[#0b1f13] font-semibold text-lg flex items-center justify-center gap-2 hover:brightness-110 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition-[filter] cursor-pointer'
                >
                  <Check className='size-5' />
                  Approve <Kbd>A</Kbd>
                </button>
              </div>
            )}
            <p className='mt-3 text-center text-xs text-white/40 flex items-center justify-center gap-1.5'>
              <SkipForward className='size-3.5' /> S or → to skip · ← back · Esc to exit
            </p>
          </div>
        </div>
      ) : null}

      <div ref={stripRef} className='h-24 shrink-0 border-t border-white/10 px-4 sm:px-8 flex items-center gap-3 overflow-x-auto'>
        {items.map((entry, entryIndex) => {
          const decision = decisions[entry.id];
          return (
            <button
              key={entry.id}
              type='button'
              data-focus-index={entryIndex}
              onClick={() => setIndex(entryIndex)}
              className={cn(
                'relative h-14 w-20 shrink-0 rounded-[10px] flex items-center justify-center cursor-pointer',
                entryIndex === index ? 'ring-2 ring-white bg-white/10' : 'bg-white/5',
                decision && 'opacity-40',
              )}
            >
              <Image src={entry.flag.flagImage} alt='' width={80} height={56} className='max-h-9 w-auto max-w-[80%] object-contain' />
              {decision && (
                <span className={cn('absolute -top-1.5 -right-1.5 size-5 rounded-full flex items-center justify-center', decision === 'approved' ? 'bg-good text-[#0b1f13]' : 'bg-bad text-white')}>
                  {decision === 'approved' ? <Check className='size-3' /> : <X className='size-3' />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
