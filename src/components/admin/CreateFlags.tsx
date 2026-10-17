'use client';

import React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submitAiFlagDrafts } from '@/actions/requests';
import type { FlagDraft, FlagImageMode } from '@/lib/ai/create-flag-draft';
import FlagImage from '@/components/FlagImage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, X } from '@/components/icons';
import { cn } from '@/lib/utils';

const MAX_LINES = 20;
const CONCURRENCY = 3;

type Row = {
  key: string;
  input: string;
  status: 'working' | 'ready' | 'error';
  draft?: FlagDraft;
  error?: string;
  selected: boolean;
  open: boolean;
};

function isSubmittable(row: Row) {
  return row.status === 'ready' && Boolean(row.draft?.image) && Boolean(row.draft?.name.trim());
}

async function requestDraft(input: string, image: FlagImageMode, research: boolean): Promise<FlagDraft> {
  const response = await fetch('/api/admin/flag-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, image, research }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || 'Generation failed.');
  }
  return body as FlagDraft;
}

function formatCost(value: number) {
  return value < 0.01 ? '<$0.01' : `$${value.toFixed(2)}`;
}

export function CreateFlags() {
  const queryClient = useQueryClient();
  const [text, setText] = React.useState('');
  const [imageMode, setImageMode] = React.useState<FlagImageMode>('commons-first');
  const [research, setResearch] = React.useState(true);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const updateRow = (key: string, patch: Partial<Row> | ((row: Row) => Partial<Row>)) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...(typeof patch === 'function' ? patch(row) : patch) } : row)),
    );

  const updateDraft = (key: string, patch: Partial<FlagDraft>) =>
    updateRow(key, (row) => (row.draft ? { draft: { ...row.draft, ...patch } } : {}));

  const runRow = async (key: string, input: string, mode: FlagImageMode) => {
    updateRow(key, { status: 'working', error: undefined });
    try {
      const draft = await requestDraft(input, mode, research);
      updateRow(key, (row) => ({
        status: 'ready',
        draft,
        selected: Boolean(draft.image) && !draft.duplicate,
        open: row.open,
      }));
    } catch (error) {
      updateRow(key, { status: 'error', error: error instanceof Error ? error.message : 'Generation failed.' });
    }
  };

  const lines = Array.from(new Set(text.split('\n').map((line) => line.trim()).filter(Boolean)));

  const generate = async () => {
    if (lines.length === 0) return;
    if (lines.length > MAX_LINES) {
      toast.error(`Up to ${MAX_LINES} flags at a time.`);
      return;
    }
    const added: Row[] = lines.map((input, i) => ({
      key: crypto.randomUUID(),
      input,
      status: 'working',
      selected: false,
      open: rows.length === 0 && i === 0,
    }));
    setRows((current) => [...added, ...current]);
    setText('');

    const queue = [...added];
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        await runRow(row.key, row.input, imageMode);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  };

  const submittable = rows.filter((row) => row.selected && isSubmittable(row));
  const counts = {
    ready: rows.filter((row) => row.status === 'ready' && isSubmittable(row) && !row.draft?.duplicate).length,
    needsLook: rows.filter(
      (row) => row.status === 'error' || (row.status === 'ready' && (!row.draft?.image || row.draft?.duplicate)),
    ).length,
    working: rows.filter((row) => row.status === 'working').length,
  };

  const submit = async () => {
    if (submittable.length === 0) return;
    setIsSubmitting(true);
    const result = await submitAiFlagDrafts(
      submittable.map(({ draft }) => ({
        flagName: draft!.name,
        flagImage: draft!.image!.url,
        imageOrigin: draft!.image!.origin,
        sources: draft!.sources,
        tags: draft!.tags,
        description: draft!.description,
      })),
    ).catch(() => ({ success: false as const, message: 'Could not add the drafts.' }));
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }
    const submitted = new Set(submittable.map((row) => row.key));
    setRows((current) => current.filter((row) => !submitted.has(row.key)));
    queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
    queryClient.invalidateQueries({ queryKey: ['adminCounts'] });
    toast.success(`Added ${result.created} ${result.created === 1 ? 'flag' : 'flags'} to the review queue`);
  };

  return (
    <div className='pb-24'>
      <div className='mb-5'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Create flags</h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>
          One flag per line. Real flags use Wikimedia Commons images; anything without one gets drawn as SVG. Drafts go
          to the review queue, nothing is published until you approve it.
        </p>
      </div>

      <div className='vx-tile overflow-hidden'>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate();
          }}
          spellCheck={false}
          rows={5}
          placeholder={'Scotland\nTexas\nMoon Republic: navy field, silver crescent at the hoist, one white star in the fly'}
          className='block w-full resize-y bg-transparent px-5 py-4 text-[15px] leading-7 outline-none placeholder:text-muted-foreground'
        />
        <div className='flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line px-5 py-3'>
          <label className='flex items-center gap-2 text-[13px] text-subtle'>
            Image
            <select
              value={imageMode}
              onChange={(e) => setImageMode(e.target.value as FlagImageMode)}
              className='h-8 cursor-pointer rounded-[8px] bg-well px-2 text-foreground outline-none'
            >
              <option value='commons-first'>Commons, else draw</option>
              <option value='draw'>Always draw</option>
              <option value='commons-only'>Commons only</option>
            </select>
          </label>
          <label className='flex items-center gap-2 text-[13px] text-subtle'>
            Details
            <select
              value={research ? 'web' : 'name'}
              onChange={(e) => setResearch(e.target.value === 'web')}
              className='h-8 cursor-pointer rounded-[8px] bg-well px-2 text-foreground outline-none'
            >
              <option value='web'>Web search</option>
              <option value='name'>From name only</option>
            </select>
          </label>
          <span className='ml-auto text-[13px] text-muted-foreground'>
            {lines.length > MAX_LINES ? `${MAX_LINES} max` : lines.length > 0 ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : ''}
          </span>
          <Button onClick={generate} disabled={lines.length === 0 || lines.length > MAX_LINES}>
            Generate {lines.length > 1 ? `${lines.length} drafts` : 'draft'}
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className='mb-3 mt-8 flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-[17px] font-semibold'>
              Drafts
              <span className='ml-2 text-sm font-normal text-muted-foreground'>
                {[
                  counts.ready && `${counts.ready} ready`,
                  counts.needsLook && `${counts.needsLook} ${counts.needsLook === 1 ? 'needs' : 'need'} a look`,
                  counts.working && `${counts.working} working`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </h2>
            <div className='flex gap-2'>
              <Button variant='ghost' size='sm' onClick={() => setRows((current) => current.filter((row) => row.status === 'working'))}>
                Discard all
              </Button>
              <Button size='sm' onClick={submit} disabled={submittable.length === 0 || isSubmitting}>
                {isSubmitting ? 'Adding…' : `Send ${submittable.length > 0 ? `${submittable.length} ` : ''}to review queue`}
              </Button>
            </div>
          </div>

          <div className='flex flex-col gap-2.5'>
            {rows.map((row) => (
              <DraftRow
                key={row.key}
                row={row}
                onToggleOpen={() => updateRow(row.key, { open: !row.open })}
                onToggleSelected={() => updateRow(row.key, { selected: !row.selected })}
                onChange={(patch) => updateDraft(row.key, patch)}
                onDiscard={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                onRegenerate={(mode) => runRow(row.key, row.input, mode ?? imageMode)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DraftStatus({ row }: { row: Row }) {
  const { draft } = row;
  if (row.status === 'working') {
    return <p className='text-[13px] text-muted-foreground'>Researching and finding the image. This can take a minute.</p>;
  }
  if (row.status === 'error' || !draft) {
    return <p className='text-[13px] text-bad'>{row.error || 'Generation failed.'}</p>;
  }
  if (draft.duplicate) {
    return (
      <p className='text-[13px] text-warn'>
        {draft.duplicate.status === 'live' ? 'Already on Vexilo' : 'Already waiting for review'} as {draft.duplicate.name}
      </p>
    );
  }
  if (!draft.image) {
    return <p className='text-[13px] text-warn'>No image found on Wikimedia Commons</p>;
  }
  const sourceCount = draft.sources.length;
  return draft.image.origin === 'commons' ? (
    <p className='text-[13px] text-good'>
      Ready · image from Wikimedia Commons · {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
    </p>
  ) : (
    <p className='text-[13px] text-muted-foreground'>
      Drawn by AI{draft.fictional ? ' · fictional' : ''} · check it closely before approving
    </p>
  );
}

function DraftRow({
  row,
  onToggleOpen,
  onToggleSelected,
  onChange,
  onDiscard,
  onRegenerate,
}: {
  row: Row;
  onToggleOpen: () => void;
  onToggleSelected: () => void;
  onChange: (patch: Partial<FlagDraft>) => void;
  onDiscard: () => void;
  onRegenerate: (mode?: FlagImageMode) => void;
}) {
  const { draft } = row;
  const canSelect = isSubmittable(row);
  const [newTag, setNewTag] = React.useState('');
  const [newSource, setNewSource] = React.useState('');

  return (
    <div className='vx-tile overflow-hidden'>
      <div className='grid grid-cols-[96px_1fr_auto] items-center gap-4 p-3 pr-4 sm:grid-cols-[112px_1fr_auto]'>
        <button type='button' onClick={onToggleOpen} className='flag-stage bg-stage h-[68px] cursor-pointer rounded-[9px] px-3 py-2.5 sm:h-[72px]'>
          {draft?.image ? (
            <FlagImage src={draft.image.url} alt={draft.name} maxHeight={48} area={72 * 48} />
          ) : (
            <span className={cn('h-8 w-12 rounded-[3px] bg-foreground/[0.06]', row.status === 'working' && 'animate-pulse')} />
          )}
        </button>
        <button type='button' onClick={onToggleOpen} className='min-w-0 cursor-pointer text-left'>
          <p className='truncate font-semibold'>{draft?.name || row.input}</p>
          <DraftStatus row={row} />
        </button>
        <div className='flex items-center gap-2'>
          {row.status === 'error' && (
            <Button variant='neutral' size='sm' onClick={() => onRegenerate()}>
              Retry
            </Button>
          )}
          {row.status === 'ready' && draft?.duplicate && (
            <Button variant='neutral' size='sm' asChild>
              <Link href={`/flag/${encodeURIComponent(draft.duplicate.name)}`} target='_blank'>
                Compare
              </Link>
            </Button>
          )}
          {row.status === 'ready' && draft && !draft.image && (
            <Button variant='neutral' size='sm' onClick={() => onRegenerate('draw')}>
              Draw one
            </Button>
          )}
          {row.status !== 'working' && (
            <Button variant='ghost' size='sm' onClick={onDiscard}>
              Discard
            </Button>
          )}
          <button
            type='button'
            role='checkbox'
            aria-checked={row.selected && canSelect}
            aria-label={row.selected ? 'Deselect' : 'Select'}
            disabled={!canSelect}
            onClick={onToggleSelected}
            className={cn(
              'grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[5px] border-[1.5px] border-border disabled:cursor-not-allowed disabled:opacity-40',
              row.selected && canSelect && 'border-main bg-main text-main-foreground',
            )}
          >
            {row.selected && canSelect && <Check className='size-3' />}
          </button>
        </div>
      </div>

      {row.open && row.status === 'ready' && draft && (
        <>
          <div className='grid gap-7 border-t border-line p-5 md:grid-cols-[minmax(0,340px)_1fr]'>
            <div>
              <div className='flag-stage bg-stage h-[220px] rounded-[12px] px-8 py-7'>
                {draft.image ? (
                  <FlagImage src={draft.image.url} alt={draft.name} maxHeight={170} area={260 * 170} />
                ) : (
                  <p className='text-[13px] text-muted-foreground'>No image</p>
                )}
              </div>
              {draft.image && (
                <p className='mt-2.5 break-all text-[12.5px] text-muted-foreground'>
                  {draft.image.origin === 'commons' ? `${draft.image.fileName} · Wikimedia Commons` : 'Drawn by AI as SVG'}
                </p>
              )}
            </div>
            <div className='flex min-w-0 flex-col gap-4'>
              <Field label='Name'>
                <Input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
              </Field>
              <Field label='Description'>
                <Textarea value={draft.description} onChange={(e) => onChange({ description: e.target.value })} rows={3} />
              </Field>
              <Field label='Tags'>
                <div className='flex flex-wrap items-center gap-1.5'>
                  {draft.tags.map((tag) => (
                    <span key={tag} className='inline-flex h-7 items-center gap-1 rounded-full border border-line pl-2.5 pr-1.5 text-[12.5px] text-subtle'>
                      {tag}
                      <button
                        type='button'
                        aria-label={`Remove ${tag}`}
                        onClick={() => onChange({ tags: draft.tags.filter((t) => t !== tag) })}
                        className='cursor-pointer rounded-full p-0.5 hover:text-foreground'
                      >
                        <X className='size-3' />
                      </button>
                    </span>
                  ))}
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-');
                      if (e.key === 'Enter' && tag) {
                        e.preventDefault();
                        if (!draft.tags.includes(tag)) onChange({ tags: [...draft.tags, tag] });
                        setNewTag('');
                      }
                    }}
                    placeholder='Add tag'
                    className='h-7 w-28 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground'
                  />
                </div>
              </Field>
              <Field label='Sources'>
                <div className='flex flex-col gap-1'>
                  {draft.sources.map((source) => (
                    <div key={source} className='group flex items-center gap-2 text-[13px]'>
                      <a
                        href={source}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='truncate text-subtle underline decoration-border underline-offset-[3px] hover:text-foreground'
                      >
                        {source.replace(/^https?:\/\//, '')}
                      </a>
                      <button
                        type='button'
                        aria-label='Remove source'
                        onClick={() => onChange({ sources: draft.sources.filter((s) => s !== source) })}
                        className='cursor-pointer text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100'
                      >
                        <X className='size-3' />
                      </button>
                    </div>
                  ))}
                  <input
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    onKeyDown={(e) => {
                      const source = newSource.trim();
                      if (e.key === 'Enter' && /^https?:\/\//.test(source)) {
                        e.preventDefault();
                        if (!draft.sources.includes(source)) onChange({ sources: [...draft.sources, source] });
                        setNewSource('');
                      }
                    }}
                    placeholder='Add a source URL'
                    className='h-7 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground'
                  />
                </div>
              </Field>
            </div>
          </div>
          <div className='flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3'>
            <span className='mr-auto text-[13px] text-muted-foreground'>
              {draft.model}
              {draft.webSearches > 0 && ` · ${draft.webSearches} web ${draft.webSearches === 1 ? 'search' : 'searches'}`}
              {draft.costUsd !== null && ` · ${formatCost(draft.costUsd)}`}
            </span>
            {draft.image?.origin === 'commons' && (
              <Button variant='ghost' size='sm' onClick={() => onRegenerate('draw')}>
                Draw instead
              </Button>
            )}
            <Button variant='neutral' size='sm' onClick={() => onRegenerate()}>
              Regenerate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className='mb-1.5 text-[12.5px] text-muted-foreground'>{label}</p>
      {children}
    </div>
  );
}
