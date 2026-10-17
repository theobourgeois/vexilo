'use client';

import {
  type BrokenImageFlag,
  applyImageReplacement,
  getBrokenImageFlags,
  getImageReplacements,
} from '@/actions/broken-images';
import { deleteFlags } from '@/actions/flags';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Check, ExternalLink, ImageBroken, Loader2, Search, Trash2, X } from '@/components/icons';
import type { ImageCandidate } from '@/lib/storage/flag-image-repair';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Filter = BrokenImageFlag['state'];

const FILTERS: Array<{ value: Filter; label: string; hint: string }> = [
  { value: 'dead', label: 'Dead links', hint: 'The image no longer exists at its link.' },
  { value: 'unreadable', label: 'Won’t decode', hint: 'The image loads, but its colours couldn’t be read. It may still display fine.' },
];

const METHOD_LABEL = {
  renamed: 'Same file, renamed on Commons',
  moved: 'Same file, moved on Commons',
  'exact-match': 'Exact title match',
} as const;

const fileName = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? url).replace(/_/g, ' ');
  } catch {
    return url;
  }
};

/** A remote image that falls back to a "missing" placeholder when it won't load. */
function Thumb({ src, className, imgClassName }: { src: string; className?: string; imgClassName?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className={cn('flex items-center justify-center rounded-[10px] bg-stage', className)}>
      {failed ? (
        <ImageBroken className='size-5 text-muted-foreground' />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=''
          referrerPolicy='no-referrer'
          onError={() => setFailed(true)}
          className={cn('max-h-[70%] max-w-[85%] object-contain drop-shadow-[0_0_0.6px_rgb(0_0_0/0.45)]', imgClassName)}
        />
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  label,
  primary,
  disabled,
  onUse,
}: {
  candidate: ImageCandidate;
  label?: string;
  primary?: boolean;
  disabled: boolean;
  onUse: () => void;
}) {
  return (
    <div className={cn('rounded-[14px] p-2 ring-1', primary ? 'bg-main-soft ring-main/40' : 'bg-secondary-background ring-border')}>
      <Thumb src={candidate.url} className={primary ? 'h-36' : 'h-24'} />
      <div className='mt-2 flex items-start gap-2 px-0.5'>
        <div className='min-w-0 flex-1'>
          {label && <p className='text-xs font-medium text-main'>{label}</p>}
          <a
            href={`https://${candidate.wiki === 'en' ? 'en.wikipedia.org' : 'commons.wikimedia.org'}/wiki/${encodeURIComponent(candidate.title)}`}
            target='_blank'
            rel='noopener noreferrer'
            className='block truncate text-[13px] font-medium hover:underline'
            title={candidate.title}
          >
            {candidate.title.replace(/^File:/, '')}
          </a>
          <p className='text-xs text-muted-foreground'>{candidate.wiki === 'en' ? 'English Wikipedia' : 'Wikimedia Commons'}</p>
        </div>
        <Button size='sm' variant={primary ? 'default' : 'neutral'} onClick={onUse} disabled={disabled} className='shrink-0'>
          <Check />
          Use this
        </Button>
      </div>
    </div>
  );
}

function RepairPanel({
  flag,
  onClose,
  onResolved,
}: {
  flag: BrokenImageFlag;
  onClose: () => void;
  onResolved: (flagId: string) => void;
}) {
  const [manualUrl, setManualUrl] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const { data: lookup, isLoading } = useQuery({
    queryKey: ['imageReplacements', flag.id],
    queryFn: () => getImageReplacements(flag.id),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    setManualUrl('');
    const handleKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flag.id, onClose]);

  const use = async (url: string) => {
    setSaving(url);
    const result = await applyImageReplacement(flag.id, url);
    setSaving(null);
    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ('warning' in result && result.warning) toast.warning(result.warning);
    else toast.success(`Fixed the image for ${flag.name}.`);
    onResolved(flag.id);
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${flag.name}" for good?`)) return;
    setSaving('delete');
    const result = await deleteFlags([flag.id]);
    setSaving(null);
    if (!result || result.deleted.length === 0) {
      toast.error(result?.failed[0]?.message ?? 'Could not delete the flag.');
      return;
    }
    toast.success(`Deleted ${flag.name}.`);
    onResolved(flag.id);
  };

  const others = (lookup?.candidates ?? []).filter((candidate) => candidate.url !== lookup?.suggestion?.url);
  const searchUrl = `https://commons.wikimedia.org/w/index.php?${new URLSearchParams({ search: `Flag of ${flag.name}`, ns6: '1' })}`;

  return (
    <aside
      aria-label='Fix flag image'
      className='fixed inset-0 z-40 flex flex-col overflow-hidden bg-secondary-background shadow-pop sm:inset-auto sm:bottom-4 sm:right-4 sm:top-20 sm:w-[520px] sm:rounded-[18px]'
    >
      <div className='flex items-start justify-between gap-3 border-b border-line px-6 pb-4 pt-5'>
        <div className='min-w-0'>
          <p className={cn('text-xs font-medium', flag.state === 'dead' ? 'text-bad' : 'text-warn')}>
            {flag.state === 'dead' ? 'Dead link' : 'Won’t decode'} · #{String(flag.index).padStart(4, '0')}
          </p>
          <p className='mt-1 truncate text-[17px] font-semibold tracking-[-0.02em]'>{flag.name}</p>
        </div>
        <div className='flex shrink-0 items-center gap-3'>
          <Link href={`/flag/${encodeURIComponent(flag.name)}`} target='_blank' aria-label='Open flag page' className='text-muted-foreground hover:text-foreground'>
            <ExternalLink className='size-4' />
          </Link>
          <button type='button' onClick={onClose} aria-label='Close' className='cursor-pointer text-muted-foreground hover:text-foreground'>
            <X className='size-5' />
          </button>
        </div>
      </div>

      <div className='flex-1 space-y-5 overflow-y-auto px-6 py-5'>
        <div className='flex items-center gap-3 rounded-[12px] bg-foreground/[0.03] p-2.5 shadow-[inset_0_0_0_1px_var(--line)]'>
          <Thumb src={flag.image} className='h-14 w-20 shrink-0' />
          <div className='min-w-0 text-[13px]'>
            <p className='text-xs text-muted-foreground'>Current image</p>
            <a href={flag.image} target='_blank' rel='noopener noreferrer' className='block truncate hover:underline' title={flag.image}>
              {fileName(flag.image)}
            </a>
          </div>
        </div>

        {isLoading ? (
          <div className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            Searching Wikimedia for a replacement…
          </div>
        ) : (
          <>
            {lookup?.suggestion && (
              <CandidateCard
                candidate={lookup.suggestion}
                label={lookup.method ? METHOD_LABEL[lookup.method] : undefined}
                primary
                disabled={saving !== null}
                onUse={() => use(lookup.suggestion!.url)}
              />
            )}
            {others.length > 0 && (
              <div>
                <p className='mb-2 text-xs font-medium text-muted-foreground'>{lookup?.suggestion ? 'Other candidates' : 'Candidates'}</p>
                <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
                  {others.map((candidate) => (
                    <CandidateCard key={candidate.url} candidate={candidate} disabled={saving !== null} onUse={() => use(candidate.url)} />
                  ))}
                </div>
              </div>
            )}
            {!lookup?.suggestion && others.length === 0 && (
              <p className='rounded-[12px] bg-foreground/[0.03] px-3 py-3 text-sm text-muted-foreground shadow-[inset_0_0_0_1px_var(--line)]'>
                Nothing found automatically. Search Commons yourself, or paste an image URL below.
              </p>
            )}
          </>
        )}

        <div>
          <label htmlFor='manual-image-url' className='mb-1.5 block text-xs font-medium text-muted-foreground'>
            Or paste an image URL
          </label>
          <form
            className='flex gap-2'
            onSubmit={(event) => {
              event.preventDefault();
              if (manualUrl.trim()) use(manualUrl);
            }}
          >
            <Input
              id='manual-image-url'
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder='https://upload.wikimedia.org/…'
            />
            <Button type='submit' variant='neutral' disabled={!manualUrl.trim() || saving !== null}>
              {saving === manualUrl ? <Loader2 className='animate-spin' /> : <Check />}
              Use
            </Button>
          </form>
        </div>
      </div>

      <div className='flex items-center gap-3 border-t border-line px-6 py-4'>
        <Button variant='neutral' size='sm' onClick={remove} disabled={saving !== null} className='text-bad'>
          <Trash2 />
          Delete flag
        </Button>
        <div className='flex-1' />
        {saving && saving !== 'delete' && (
          <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <Loader2 className='size-3.5 animate-spin' />
            Copying to CloudFront…
          </span>
        )}
        <Button asChild variant='neutral' size='sm'>
          <a href={searchUrl} target='_blank' rel='noopener noreferrer'>
            <Search />
            Search Commons
          </a>
        </Button>
      </div>
    </aside>
  );
}

export function BrokenImages() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('dead');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['brokenImages'],
    queryFn: () => getBrokenImageFlags(),
    staleTime: 5 * 60 * 1000,
  });

  const all = data ?? [];
  const visible = all.filter((flag) => flag.state === filter);
  const openFlag = all.find((flag) => flag.id === openId) ?? null;

  // Fixed or deleted: drop it from the list and move on to the next one.
  const resolve = (flagId: string) => {
    const index = visible.findIndex((flag) => flag.id === flagId);
    const next = visible[index + 1] ?? visible[index - 1] ?? null;
    queryClient.setQueryData<BrokenImageFlag[] | null>(['brokenImages'], (current) => current?.filter((flag) => flag.id !== flagId) ?? current);
    queryClient.invalidateQueries({ queryKey: ['adminCounts'] });
    queryClient.invalidateQueries({ queryKey: ['adminFlags'] });
    setOpenId(next && next.id !== flagId ? next.id : null);
  };

  return (
    <div className='pb-16'>
      <div className='mb-5'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Broken images</h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>
          Flags whose image is missing or can’t be read. Pick a replacement and it’s copied to CloudFront.
        </p>
      </div>

      <div className='mb-4 flex flex-wrap items-center gap-2 text-[13px] font-medium'>
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type='button'
            onClick={() => setFilter(value)}
            className={cn(
              'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 transition-colors',
              filter === value ? 'bg-foreground text-background' : 'vx-key text-subtle hover:text-foreground',
            )}
          >
            {label}
            <span className='tabular-nums text-xs opacity-70'>{all.filter((flag) => flag.state === value).length}</span>
          </button>
        ))}
        <span className='ml-1 text-xs text-muted-foreground'>{FILTERS.find((entry) => entry.value === filter)?.hint}</span>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground'>
          <Loader2 className='size-5 animate-spin' />
          Checking images…
        </div>
      ) : visible.length === 0 ? (
        <Card className='items-center gap-2 py-16 text-center'>
          <Check className='size-9 text-good' />
          <p className='text-[17px] font-semibold tracking-[-0.02em]'>Nothing here</p>
          <p className='text-[13px] text-muted-foreground'>Every flag in this group has a working image.</p>
        </Card>
      ) : (
        <Card className='gap-0 overflow-hidden p-0'>
          {visible.map((flag) => (
            <button
              key={flag.id}
              type='button'
              onClick={() => setOpenId(flag.id)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-foreground/[0.03]',
                openId === flag.id && 'bg-main-soft hover:bg-main-soft',
              )}
            >
              <Thumb src={flag.image} className='h-9 w-14 shrink-0 rounded-[8px]' />
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-sm font-semibold'>{flag.name}</span>
                <span className='block truncate text-xs text-muted-foreground'>{fileName(flag.image)}</span>
              </span>
              <span className='hidden shrink-0 tabular-nums text-xs text-muted-foreground sm:block'>#{String(flag.index).padStart(4, '0')}</span>
            </button>
          ))}
        </Card>
      )}

      {openFlag && <RepairPanel flag={openFlag} onClose={() => setOpenId(null)} onResolved={resolve} />}
    </div>
  );
}
