'use client';

import {
  type AdminFlagsSort,
  bulkEditFlagTags,
  deleteFlags,
  getAdminFlags,
  getAllFlagTags,
  relateFlags,
} from '@/actions/flags';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileX, Link2, Loader2, Search, Sparkles, Tag, Trash2, X } from '@/components/icons';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type AdminFlagRow, FlagEditDrawer } from './FlagEditDrawer';
import { isTypingTarget, timeAgo } from './review-utils';
import { SelectBox, SelectBoxIndicator } from './SelectBox';

const SORT_LABELS: Record<AdminFlagsSort, string> = {
  recent: 'Recently added',
  oldest: 'Oldest first',
  name: 'Name A–Z',
};

type Row = AdminFlagRow & {
  createdAt: Date;
  favorites: number;
  aiDescription: string | null;
  aiStatus: string | null;
  aiGeneratedAt: Date | null;
};

function AiStatus({ row }: { row: Row }) {
  if (row.aiStatus === 'processing') return <span className='text-subtle'>Running…</span>;
  if (row.aiStatus === 'failed') return <span className='text-bad'>Failed</span>;
  if (row.aiGeneratedAt) {
    return <span title={new Date(row.aiGeneratedAt).toLocaleString()}>{timeAgo(row.aiGeneratedAt)}</span>;
  }
  return <span className='text-muted-foreground/60'>Never</span>;
}

/** How many flags to regenerate at once; each run does its own web research. */
const AI_CONCURRENCY = 3;

function TagPopover({
  selected,
  onClose,
  onApply,
}: {
  selected: Row[];
  onClose: () => void;
  onApply: (changes: { add?: string[]; remove?: string[] }) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const { data: suggestions } = useQuery({
    queryKey: ['adminTagSearch', search],
    queryFn: () => getAllFlagTags(search, 1, 6),
    enabled: search.trim().length > 0,
  });

  const counts = new Map<string, number>();
  for (const row of selected) for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const query = search.trim().toLowerCase();
  const tagOptions = Array.from(
    new Set([
      ...(query ? [query] : []),
      ...(suggestions?.tags.map((entry) => entry.tag) ?? []),
      ...[...counts.keys()].filter((tag) => !query || tag.includes(query)),
    ]),
  ).slice(0, 8);

  const toggleTag = async (tag: string) => {
    const onAll = counts.get(tag) === selected.length;
    setBusyTag(tag);
    await onApply(onAll ? { remove: [tag] } : { add: [tag] });
    setBusyTag(null);
  };

  return (
    <div className='absolute bottom-12 left-0 w-80 rounded-[14px] bg-popover p-3 shadow-pop text-sm'>
      <input
        autoFocus
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Enter' && query) toggleTag(query);
        }}
        placeholder='Search or create a tag...'
        className='w-full h-9 rounded-[9px] bg-well shadow-well px-3 text-sm placeholder:text-muted-foreground outline-none focus:shadow-[var(--sh-well),0_0_0_2px_var(--main)]'
      />
      <div className='mt-2 space-y-0.5 max-h-64 overflow-y-auto'>
        {tagOptions.length === 0 && <p className='px-2 py-1.5 text-muted-foreground'>Type to find a tag.</p>}
        {tagOptions.map((tag) => {
          const count = counts.get(tag) ?? 0;
          const state = count === 0 ? false : count === selected.length ? true : 'mixed';
          return (
            <button
              key={tag}
              type='button'
              onClick={() => toggleTag(tag)}
              disabled={busyTag !== null}
              className='w-full flex items-center gap-2 px-2 py-1.5 rounded-[9px] hover:bg-foreground/[0.06] cursor-pointer text-left'
            >
              {busyTag === tag ? (
                <Loader2 className='size-5 animate-spin' />
              ) : (
                <SelectBoxIndicator checked={state} />
              )}
              <span className='flex-1 truncate'>{tag}</span>
              <span className='tabular-nums text-[11px] text-muted-foreground'>
                {count === selected.length ? `on all ${count}` : `on ${count} of ${selected.length}`}
              </span>
            </button>
          );
        })}
      </div>
      <p className='mt-2 px-2 text-xs text-muted-foreground'>Click to add to all selected, or remove if all have it.</p>
    </div>
  );
}

export function AllFlags() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tag, setTag] = useState('');
  const [missingDescription, setMissingDescription] = useState(false);
  const [sort, setSort] = useState<AdminFlagsSort>('recent');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, Row>>(new Map());
  const [editing, setEditing] = useState<Row | null>(null);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number } | null>(null);
  const lastToggledRef = useRef<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // "tag:castile" in the search box filters by tag.
      const tagMatch = search.match(/(?:^|\s)tag:(\S+)/i);
      if (tagMatch) {
        setTag(tagMatch[1].toLowerCase());
        setSearch(search.replace(tagMatch[0], '').trim());
        return;
      }
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const params = { query: debouncedSearch, tag, missingDescription, sort, page };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['adminFlags', params],
    queryFn: () => getAdminFlags(params),
    placeholderData: keepPreviousData,
  });
  const rows: Row[] = data?.flags ?? [];
  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['adminFlags'] });

  const toggle = (row: Row, shiftKey: boolean) => {
    // Read the anchor now: the state updater may run after the ref is updated.
    const anchorIndex = rows.findIndex((entry) => entry.id === lastToggledRef.current);
    const rowIndex = rows.findIndex((entry) => entry.id === row.id);
    const range =
      shiftKey && anchorIndex !== -1
        ? rows.slice(Math.min(anchorIndex, rowIndex), Math.max(anchorIndex, rowIndex) + 1)
        : [row];
    lastToggledRef.current = row.id;
    setSelected((current) => {
      const next = new Map(current);
      const shouldSelect = !current.has(row.id);
      for (const entry of range) {
        if (shouldSelect) next.set(entry.id, entry);
        else next.delete(entry.id);
      }
      return next;
    });
  };

  const pageSelectedCount = rows.filter((row) => selected.has(row.id)).length;
  const togglePage = () => {
    setSelected((current) => {
      const next = new Map(current);
      if (pageSelectedCount === rows.length) for (const row of rows) next.delete(row.id);
      else for (const row of rows) next.set(row.id, row);
      return next;
    });
  };

  const selectedRows = [...selected.values()];

  const applyTags = async (changes: { add?: string[]; remove?: string[] }) => {
    const ids = selectedRows.map((row) => row.id);
    const updated = await bulkEditFlagTags(ids, changes);
    if (updated === null) {
      toast.error('Unauthorized');
      return;
    }
    // Keep the popover counts in sync without waiting for the refetch.
    setSelected((current) => {
      const next = new Map(current);
      for (const [id, row] of next) {
        const tags = row.tags.filter((tagName) => !(changes.remove ?? []).includes(tagName));
        next.set(id, { ...row, tags: Array.from(new Set([...tags, ...(changes.add ?? [])])) });
      }
      return next;
    });
    refresh();
  };

  const relate = async () => {
    setIsWorking(true);
    const result = await relateFlags(selectedRows.map((row) => row.id));
    setIsWorking(false);
    if (result === null) return toast.error('Unauthorized');
    toast.success(`Linked ${result} flags as related to each other.`);
  };

  const regenerateAi = async () => {
    const targets = selectedRows;
    if (targets.length > 10 && !window.confirm(`Regenerate AI details for ${targets.length} flags? Each one runs its own web research.`)) return;
    setAiProgress({ done: 0, total: targets.length });
    let done = 0;
    let costUsd = 0;
    const failed: string[] = [];
    const queue = [...targets];
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        const response = await fetch('/api/admin/flag-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flagId: row.id }),
        }).catch(() => null);
        const body = await response?.json().catch(() => null);
        if (response?.ok) costUsd += Number(body?.estimatedCostUsd ?? 0);
        else failed.push(row.name);
        setAiProgress({ done: ++done, total: targets.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(AI_CONCURRENCY, targets.length) }, worker));
    setAiProgress(null);
    refresh();
    const succeeded = targets.length - failed.length;
    if (succeeded > 0) {
      toast.success(`Regenerated AI details for ${succeeded} flag${succeeded === 1 ? '' : 's'}.`, {
        description: costUsd > 0 ? `Cost about $${costUsd.toFixed(3)}.` : undefined,
      });
    }
    if (failed.length > 0) toast.error(`Couldn't regenerate ${failed.join(', ')}.`);
  };

  const runDelete = async (ids: string[]) => {
    setIsWorking(true);
    const result = await deleteFlags(ids);
    setIsWorking(false);
    setConfirmDelete(null);
    if (!result) return toast.error('Unauthorized');
    if (result.failed.length > 0) {
      toast.error(`Couldn't delete ${result.failed.map((entry) => entry.name).join(', ')}: ${result.failed[0].message}`);
    }
    if (result.deleted.length > 0) toast.success(`Deleted ${result.deleted.length} flag${result.deleted.length === 1 ? '' : 's'}.`);
    setSelected((current) => {
      const next = new Map(current);
      for (const id of result.deleted) next.delete(id);
      return next;
    });
    if (editing && result.deleted.includes(editing.id)) setEditing(null);
    refresh();
    queryClient.invalidateQueries({ queryKey: ['adminCounts'] });
  };

  useEffect(() => {
    if (editing) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isTypingTarget(event.target)) {
        setSelected(new Map());
        setIsTagPopoverOpen(false);
        setConfirmDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing]);

  return (
    <div className='pb-32'>
      <div className='mb-5'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>All flags</h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>{data ? `${data.total.toLocaleString()} flags` : 'Loading...'}</p>
      </div>

      <div className='flex flex-col lg:flex-row gap-2 mb-4'>
        <div className='flex-1 h-10 rounded-[11px] bg-well shadow-well px-3.5 flex items-center gap-2 text-sm transition-shadow focus-within:shadow-[var(--sh-well),0_0_0_2px_var(--main)]'>
          <Search className='size-4 text-muted-foreground shrink-0' />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search by name, or tag:spain'
            className='flex-1 bg-transparent outline-none min-w-0 placeholder:text-muted-foreground'
          />
          {tag && (
            <button
              type='button'
              onClick={() => setTag('')}
              className='rounded-full bg-main-soft text-main font-medium px-2 py-0.5 text-xs flex items-center gap-1 cursor-pointer shrink-0'
            >
              tag: {tag}
              <X className='size-3' />
            </button>
          )}
          {isFetching && <Loader2 className='size-4 animate-spin text-muted-foreground shrink-0' />}
        </div>
        <button
          type='button'
          onClick={() => {
            setMissingDescription(!missingDescription);
            setPage(1);
          }}
          className={cn(
            'h-10 px-3 rounded-[11px] flex items-center gap-1.5 text-sm font-medium cursor-pointer',
            missingDescription ? 'bg-foreground text-background' : 'vx-key text-foreground',
          )}
        >
          <FileX className='size-4' />
          No description
        </button>
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as AdminFlagsSort);
            setPage(1);
          }}
          className='h-10 px-3 rounded-[11px] vx-key text-foreground text-sm font-medium cursor-pointer'
          aria-label='Sort'
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              Sort: {label}
            </option>
          ))}
        </select>
      </div>

      <Card className='py-0 gap-0 overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-left text-muted-foreground border-b border-line tabular-nums text-xs font-medium'>
              <th className='py-3 pl-4 w-10'>
                <SelectBox
                  label='Select page'
                  checked={rows.length > 0 && pageSelectedCount === rows.length ? true : pageSelectedCount > 0 ? 'mixed' : false}
                  onToggle={togglePage}
                />
              </th>
              <th className='py-3 w-20' />
              <th className='py-3 font-medium'>Name</th>
              <th className='py-3 font-medium hidden md:table-cell'>Tags</th>
              <th className='py-3 font-medium hidden lg:table-cell'>Description</th>
              <th className='py-3 font-medium pr-4 hidden xl:table-cell whitespace-nowrap'>AI generated</th>
              <th className='py-3 font-medium text-right pr-5 hidden sm:table-cell'>Added</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className='py-16 text-center'>
                  <Loader2 className='size-6 animate-spin mx-auto text-muted-foreground' />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className='py-16 text-center text-muted-foreground'>
                  No flags match.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isSelected = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  onClick={() => setEditing(row)}
                  className={cn(
                    'border-b border-line last:border-b-0 cursor-pointer hover:bg-foreground/[0.03]',
                    isSelected && 'bg-main/[0.05]',
                    editing?.id === row.id && 'bg-main-soft',
                  )}
                >
                  <td className='py-2.5 pl-4'>
                    <SelectBox label={`Select ${row.name}`} checked={isSelected} onToggle={(event) => toggle(row, event.shiftKey)} />
                  </td>
                  <td>
                    <div className='h-8 w-12 rounded-[8px] bg-well shadow-well flex items-center justify-center'>
                      <Image src={row.image} alt='' width={56} height={40} className='max-h-5 w-auto max-w-[80%] object-contain' />
                    </div>
                  </td>
                  <td className='font-semibold pr-4 max-w-[16rem] truncate'>{row.name}</td>
                  <td className='hidden md:table-cell pr-4'>
                    <div className='flex flex-wrap gap-1 max-w-xs'>
                      {row.tags.slice(0, 4).map((tagName) => (
                        <button
                          key={tagName}
                          type='button'
                          onClick={(event) => {
                            event.stopPropagation();
                            setTag(tagName);
                            setPage(1);
                          }}
                          className='whitespace-nowrap text-xs font-medium rounded-full bg-foreground/[0.06] text-subtle hover:bg-main-soft hover:text-main px-2 py-0.5 cursor-pointer transition-colors'
                        >
                          {tagName}
                        </button>
                      ))}
                      {row.tags.length > 4 && <span className='tabular-nums text-xs text-muted-foreground'>+{row.tags.length - 4}</span>}
                    </div>
                  </td>
                  <td className={cn('hidden lg:table-cell max-w-xs truncate pr-4', row.description || row.aiDescription ? 'text-subtle' : 'text-main font-medium')}>
                    {row.description ||
                    (row.aiDescription ? (
                      <>
                        <span className='mr-1.5 rounded-[5px] bg-main-soft px-1 py-px text-[10.5px] font-semibold text-main'>AI</span>
                        {row.aiDescription}
                      </>
                    ) : (
                      'Missing'
                    ))}
                  </td>
                  <td className='pr-4 tabular-nums text-xs text-muted-foreground whitespace-nowrap hidden xl:table-cell'>
                    <AiStatus row={row} />
                  </td>
                  <td className='text-right pr-5 tabular-nums text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell'>{timeAgo(row.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className='flex items-center gap-4 mt-4'>
        <Button variant='neutral' onClick={() => setPage(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <span className='tabular-nums text-[13px] text-muted-foreground'>
          Page {page} of {totalPages.toLocaleString()}
        </span>
        <Button variant='neutral' onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>

      {selected.size > 0 && !editing && (
        <div className='fixed bottom-0 inset-x-0 z-30 px-4 pb-4 sm:pb-6 pointer-events-none'>
          <Card className='max-w-4xl mx-auto px-4 sm:px-5 py-3.5 gap-0 flex-row flex-wrap items-center gap-3 pointer-events-auto overflow-visible'>
            <SelectBox label='Clear selection' checked={true} onToggle={() => setSelected(new Map())} />
            <b className='text-sm whitespace-nowrap'>{selected.size} selected</b>
            <div className='flex-1' />
            {aiProgress ? (
              <span className='flex items-center gap-2 text-sm text-subtle'>
                <Loader2 className='size-4 animate-spin' />
                Generating AI details · {aiProgress.done} of {aiProgress.total}
              </span>
            ) : confirmDelete ? (
              <>
                <span className='text-sm font-semibold text-bad'>Delete {confirmDelete.length} flags for good?</span>
                <Button variant='neutral' size='sm' onClick={() => setConfirmDelete(null)}>
                  Cancel
                </Button>
                <Button variant='danger' size='sm' onClick={() => runDelete(confirmDelete)} disabled={isWorking}>
                  {isWorking && <Loader2 className='animate-spin' />}
                  Delete
                </Button>
              </>
            ) : (
              <>
                <div className='relative'>
                  <Button size='sm' onClick={() => setIsTagPopoverOpen(!isTagPopoverOpen)}>
                    <Tag />
                    Tags
                  </Button>
                  {isTagPopoverOpen && (
                    <TagPopover selected={selectedRows} onClose={() => setIsTagPopoverOpen(false)} onApply={applyTags} />
                  )}
                </div>
                <Button variant='neutral' size='sm' onClick={regenerateAi} disabled={isWorking}>
                  <Sparkles />
                  Regenerate AI
                </Button>
                <Button variant='neutral' size='sm' onClick={relate} disabled={selected.size < 2 || isWorking}>
                  <Link2 />
                  Relate
                </Button>
                <Button variant='neutral' size='sm' onClick={() => setConfirmDelete(selectedRows.map((row) => row.id))} className='text-bad'>
                  <Trash2 />
                  Delete
                </Button>
              </>
            )}
          </Card>
        </div>
      )}

      {editing && (
        <FlagEditDrawer
          flag={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          onDelete={() => window.confirm(`Delete "${editing.name}" for good?`) && runDelete([editing.id])}
          onRegenerated={refresh}
        />
      )}
    </div>
  );
}
