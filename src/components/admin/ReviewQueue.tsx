'use client';

import { type ReviewQueueItem, addTagsToFlagRequests } from '@/actions/requests';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCheck,
  Check,
  Inbox,
  Loader2,
  ShieldCheck,
  Tag,
  X,
} from '@/components/icons';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTrustCreator } from './CreatorsAdmin';
import { FocusMode } from './FocusMode';
import { RequestPanel } from './RequestPanel';
import {
  type ReviewFilter,
  describeEditChanges,
  groupQueueItems,
  isTypingTarget,
  matchesFilter,
  needsLook,
  timeAgo,
} from './review-utils';
import { SelectBox } from './SelectBox';
import { useReviewQueue } from './use-review-queue';

const FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New flags' },
  { value: 'edits', label: 'Edits' },
  { value: 'attention', label: 'Needs a look' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className='inline-flex min-w-5 justify-center rounded-[6px] px-1.5 py-px tabular-nums text-[10.5px] font-medium leading-4 vx-key text-subtle'>
      {children}
    </kbd>
  );
}

function Avatar({ user }: { user: ReviewQueueItem['user'] }) {
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.image} alt='' referrerPolicy='no-referrer' className='size-9 rounded-full shrink-0' />;
  }
  return (
    <div className='size-9 rounded-full bg-main-soft text-main font-semibold flex items-center justify-center shrink-0'>
      {(user.name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function FlagThumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={160}
      height={100}
      className={cn('w-auto object-contain drop-shadow-[0_0_0.6px_rgb(0_0_0/0.45)]', className)}
    />
  );
}

export function ReviewQueue() {
  const { items, total, isLoading, approve, decline, patchItem } = useReviewQueue();
  const { setTrusted } = useTrustCreator();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelId, setPanelId] = useState<string | null>(null);
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const [isTagging, setIsTagging] = useState(false);
  const lastToggledRef = useRef<string | null>(null);

  const visible = useMemo(() => items.filter((item) => matchesFilter(item, filter)), [items, filter]);
  const groups = useMemo(() => groupQueueItems(visible), [visible]);
  const ordered = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const counts = useMemo(
    () => ({
      all: items.length,
      new: items.filter((item) => matchesFilter(item, 'new')).length,
      edits: items.filter((item) => matchesFilter(item, 'edits')).length,
      attention: items.filter((item) => matchesFilter(item, 'attention')).length,
    }),
    [items],
  );

  // Drop selections that are no longer in view (approved, declined, filtered out).
  useEffect(() => {
    const visibleIds = new Set(ordered.map((item) => item.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [ordered]);

  const selectedIds = useMemo(() => ordered.filter((item) => selected.has(item.id)).map((item) => item.id), [ordered, selected]);
  const selectedUsers = new Set(ordered.filter((item) => selected.has(item.id)).map((item) => item.user.name || 'Anonymous'));

  const toggle = (id: string, shiftKey: boolean) => {
    // Read the anchor now: the state updater may run after the ref is updated.
    const anchor = lastToggledRef.current;
    lastToggledRef.current = id;
    setSelected((current) => {
      const next = new Set(current);
      const shouldSelect = !current.has(id);
      if (shiftKey && anchor) {
        const from = ordered.findIndex((item) => item.id === anchor);
        const to = ordered.findIndex((item) => item.id === id);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          for (const item of ordered.slice(start, end + 1)) {
            if (shouldSelect) next.add(item.id);
            else next.delete(item.id);
          }
          return next;
        }
      }
      if (shouldSelect) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleGroup = (groupItems: ReviewQueueItem[]) => {
    const clean = groupItems.filter((item) => !needsLook(item));
    const target = clean.length > 0 ? clean : groupItems;
    const allSelected = target.every((item) => selected.has(item.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const item of groupItems) next.delete(item.id);
      if (!allSelected) for (const item of target) next.add(item.id);
      return next;
    });
  };

  const runBulk = useCallback(
    async (action: 'approve' | 'decline', ids: string[]) => {
      if (ids.length === 0) return;
      setSelected(new Set());
      if (action === 'approve') await approve(ids);
      else await decline(ids);
    },
    [approve, decline],
  );

  const applyTags = async () => {
    const tags = (tagDraft ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
    if (tags.length === 0) return;
    setIsTagging(true);
    await addTagsToFlagRequests(selectedIds, tags);
    await queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
    setIsTagging(false);
    setTagDraft(null);
    toast.success(`Added ${tags.join(', ')} to ${selectedIds.length} request${selectedIds.length === 1 ? '' : 's'}.`);
  };

  // Queue shortcuts (the details panel and focus mode handle their own keys).
  useEffect(() => {
    if (panelId || isFocusOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === 'escape') setSelected(new Set());
      else if (key === 'f' && ordered.length > 0) setIsFocusOpen(true);
      else if (key === 'a' && selectedIds.length > 0) runBulk('approve', selectedIds);
      else if (key === 'd' && selectedIds.length > 0) runBulk('decline', selectedIds);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusOpen, ordered.length, panelId, runBulk, selectedIds]);

  const panelIndex = ordered.findIndex((item) => item.id === panelId);
  const panelItem = panelIndex === -1 ? null : ordered[panelIndex];
  const moveAfterDecision = (id: string) => {
    const index = ordered.findIndex((item) => item.id === id);
    const next = ordered[index + 1] ?? ordered[index - 1] ?? null;
    setPanelId(next && next.id !== id ? next.id : null);
  };

  return (
    <div className='pb-36'>
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5'>
        <div>
          <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Review queue</h1>
          <p className='mt-0.5 text-[13px] text-muted-foreground'>
            {total} waiting
            {items.length > 0 && ` · oldest ${timeAgo(items[0].createdAt)}`}
            {total > items.length && ` · showing the oldest ${items.length}`}
          </p>
        </div>
        <Button variant='neutral' onClick={() => setIsFocusOpen(true)} disabled={ordered.length === 0}>
          Focus mode
        </Button>
      </div>

      <div className='flex flex-wrap items-center gap-2 mb-6 text-[13px] font-medium'>
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type='button'
            onClick={() => setFilter(value)}
            className={cn(
              'h-8 px-3 rounded-full transition-colors cursor-pointer flex items-center gap-1.5',
              filter === value
                ? 'bg-foreground text-background'
                : 'vx-key text-subtle hover:text-foreground',
            )}
          >
            {label}{' '}
            <span className={cn('tabular-nums text-xs', value === 'attention' && counts.attention > 0 && filter !== value ? 'text-warn' : 'opacity-70')}>
              {counts[value]}
            </span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className='flex justify-center py-20'>
          <Loader2 className='size-8 animate-spin text-muted-foreground' />
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <Card className='py-16 items-center text-center gap-2'>
          <Inbox className='size-10 text-muted-foreground' />
          <p className='text-[17px] font-semibold tracking-[-0.02em]'>All caught up</p>
          <p className='text-[13px] text-muted-foreground'>
            {filter === 'all' ? 'Nothing waiting for review.' : 'Nothing matches this filter.'}
          </p>
        </Card>
      )}

      <div className='space-y-6'>
        {groups.map((group) => {
          const selectedInGroup = group.items.filter((item) => selected.has(item.id)).length;
          const flaggedCount = group.items.filter((item) => needsLook(item)).length;
          const approvable = group.items.filter((item) => !needsLook(item));
          const newCount = group.items.filter((item) => !item.isEdit).length;
          const editCount = group.items.length - newCount;
          const summary = [
            newCount > 0 && `added ${newCount} flag${newCount === 1 ? '' : 's'}`,
            editCount > 0 && `edited ${editCount} flag${editCount === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(' and ');

          return (
            <Card key={group.key} className='p-4 sm:p-5 gap-0'>
              <div className='flex flex-wrap items-center gap-3 mb-4'>
                <SelectBox
                  label={`Select ${group.user.name || 'creator'}'s submission`}
                  checked={selectedInGroup === 0 ? false : selectedInGroup === group.items.length ? true : 'mixed'}
                  onToggle={() => toggleGroup(group.items)}
                />
                <Avatar user={group.user} />
                <div className='flex-1 min-w-0'>
                  <p className='font-semibold truncate'>
                    {group.user.name || 'Anonymous'} <span className='text-subtle font-normal'>{summary}</span>
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {timeAgo(group.createdAt)} · {group.user.approvedCount} approved before, {group.user.declinedCount} declined
                  </p>
                </div>
                {group.user.isTrusted ? (
                  <span className='text-xs font-semibold text-main flex items-center gap-1'>
                    <ShieldCheck className='size-4' />
                    Trusted
                  </span>
                ) : (
                  <Button
                    variant='neutral'
                    size='sm'
                    onClick={() =>
                      setTrusted(
                        { id: group.user.id, name: group.user.name, pending: null },
                        true,
                      ).then(() => queryClient.invalidateQueries({ queryKey: ['reviewQueue'] }))
                    }
                  >
                    <ShieldCheck />
                    Trust {group.user.name?.split(' ')[0] || 'creator'}
                  </Button>
                )}
                <Button size='sm' onClick={() => runBulk('approve', approvable.map((item) => item.id))} disabled={approvable.length === 0}>
                  <CheckCheck />
                  {flaggedCount === 0 ? `Approve all ${group.items.length}` : `Approve ${approvable.length}`}
                </Button>
              </div>
              {flaggedCount > 0 && approvable.length > 0 && (
                <p className='-mt-2 mb-3 text-[13px] text-warn'>
                  {flaggedCount} need{flaggedCount === 1 ? 's' : ''} a look and won&apos;t be included.
                </p>
              )}

              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3'>
                {group.items.map((item) => {
                  const isSelected = selected.has(item.id);
                  const warning = needsLook(item);
                  if (item.isEdit) {
                    return (
                      <div
                        key={item.id}
                        role='button'
                        tabIndex={0}
                        onClick={() => setPanelId(item.id)}
                        onKeyDown={(event) => event.key === 'Enter' && setPanelId(item.id)}
                        className={cn(
                          'col-span-2 sm:col-span-3 md:col-span-2 xl:col-span-3 rounded-[14px] p-3 flex items-center gap-3 cursor-pointer transition-shadow',
                          isSelected ? 'ring-2 ring-main bg-main-soft' : 'bg-secondary-background ring-1 ring-border hover:ring-foreground/25',
                          panelId === item.id && 'ring-2 ring-main',
                        )}
                      >
                        <SelectBox label={`Select ${item.flag.flagName}`} checked={isSelected} onToggle={(event) => toggle(item.id, event.shiftKey)} />
                        <div className='size-14 rounded-[10px] bg-stage flex items-center justify-center shrink-0'>
                          <FlagThumb src={item.flag.flagImage} alt={item.flag.flagName} className='max-h-8 max-w-[80%]' />
                        </div>
                        <div className='min-w-0'>
                          <p className='text-sm font-semibold truncate'>{item.flag.flagName}</p>
                          <div className='flex flex-wrap gap-1 mt-1'>
                            {describeEditChanges(item).map((change) => (
                              <span key={change} className='tabular-nums text-xs font-medium rounded-[5px] bg-main-soft text-main px-1.5 py-0.5'>
                                {change}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      role='button'
                      tabIndex={0}
                      onClick={() => setPanelId(item.id)}
                      onKeyDown={(event) => event.key === 'Enter' && setPanelId(item.id)}
                      className={cn(
                        'rounded-[14px] p-2 cursor-pointer transition-shadow',
                        isSelected
                          ? 'bg-main-soft ring-2 ring-main'
                          : warning
                            ? 'bg-secondary-background ring-1 ring-warn/50'
                            : 'bg-secondary-background ring-1 ring-border hover:ring-foreground/25',
                        panelId === item.id && 'ring-2 ring-main',
                      )}
                    >
                      <div className='relative h-24 rounded-[10px] bg-stage flex items-center justify-center'>
                        <FlagThumb src={item.flag.flagImage} alt={item.flag.flagName} className='max-h-14 max-w-[78%]' />
                        <SelectBox
                          label={`Select ${item.flag.flagName}`}
                          checked={isSelected}
                          onToggle={(event) => toggle(item.id, event.shiftKey)}
                          className='absolute top-1.5 left-1.5'
                        />
                      </div>
                      <p className='text-[13px] font-medium mt-2 truncate px-0.5'>{item.flag.flagName}</p>
                      {warning && <p className='text-xs text-warn truncate px-0.5'>{warning}</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {selectedIds.length > 0 && !panelId && (
        <div className='fixed bottom-0 inset-x-0 z-30 px-4 pb-4 sm:pb-6 pointer-events-none'>
          <Card className='max-w-3xl mx-auto px-4 sm:px-5 py-3.5 gap-0 flex-row flex-wrap items-center gap-3 pointer-events-auto overflow-visible'>
            <SelectBox label='Clear selection' checked={true} onToggle={() => setSelected(new Set())} />
            <div className='flex-1 min-w-0 text-sm'>
              <p className='truncate'>
                <b>{selectedIds.length} selected</b>
                {selectedUsers.size === 1 && <span className='text-muted-foreground'> · from {[...selectedUsers][0]}</span>}
              </p>
              <p className='hidden sm:flex text-xs text-muted-foreground items-center gap-1.5 mt-0.5'>
                <Kbd>A</Kbd> approve <Kbd>D</Kbd> decline <Kbd>⇧</Kbd>+click range <Kbd>Esc</Kbd> clear
              </p>
            </div>
            <div className='relative'>
              <Button variant='neutral' size='sm' onClick={() => setTagDraft(tagDraft === null ? '' : null)}>
                <Tag />
                Add tags
              </Button>
              {tagDraft !== null && (
                <div className='absolute bottom-12 left-0 w-72 rounded-[14px] bg-popover p-3 shadow-pop'>
                  <input
                    autoFocus
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyTags();
                      if (event.key === 'Escape') setTagDraft(null);
                    }}
                    placeholder='castile, historical'
                    className='w-full h-9 rounded-[9px] bg-well shadow-well px-3 text-sm placeholder:text-muted-foreground outline-none focus:shadow-[var(--sh-well),0_0_0_2px_var(--main)]'
                  />
                  <div className='flex items-center justify-between mt-2'>
                    <span className='text-xs text-muted-foreground'>Comma-separated</span>
                    <Button size='sm' onClick={applyTags} disabled={isTagging || !tagDraft.trim()}>
                      {isTagging && <Loader2 className='animate-spin' />}
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button variant='neutral' size='sm' onClick={() => runBulk('decline', selectedIds)} className='text-bad'>
              <X />
              Decline
            </Button>
            <Button size='sm' onClick={() => runBulk('approve', selectedIds)}>
              <Check />
              Approve {selectedIds.length}
            </Button>
          </Card>
        </div>
      )}

      {panelItem && (
        <RequestPanel
          item={panelItem}
          position={panelIndex + 1}
          total={ordered.length}
          onPrevious={() => setPanelId(ordered[(panelIndex - 1 + ordered.length) % ordered.length].id)}
          onNext={() => setPanelId(ordered[(panelIndex + 1) % ordered.length].id)}
          onClose={() => setPanelId(null)}
          onApprove={() => {
            moveAfterDecision(panelItem.id);
            approve([panelItem.id]);
          }}
          onDecline={() => {
            moveAfterDecision(panelItem.id);
            decline([panelItem.id]);
          }}
          onPatched={(patch) => patchItem(panelItem.id, patch)}
        />
      )}

      {isFocusOpen && (
        <FocusMode
          items={ordered}
          onApprove={(id) => approve([id], { quiet: true })}
          onDecline={(id) => decline([id], { quiet: true })}
          onPatched={patchItem}
          onClose={() => setIsFocusOpen(false)}
        />
      )}
    </div>
  );
}
