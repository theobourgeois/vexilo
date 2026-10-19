'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import {
  getReferenceFlagPalette,
  searchPaletteFlags,
} from '@/actions/studio-palettes';
import FlagImage from '@/components/FlagImage';
import { Loader2, Search, X } from '@/components/icons';
import { sameColor } from './colors';
import { cn } from '@/lib/utils';

type Reference = NonNullable<
  Awaited<ReturnType<typeof getReferenceFlagPalette>>
>;
// Keep the reference handy when moving between colour slots or reopening the picker.
let lastReference: Reference | null = null;

export function ReferencePalette({
  value,
  onPick,
}: {
  value: string;
  onPick: (color: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [query] = useDebounce(search.trim(), 250);
  const [reference, setReference] = useState(lastReference);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const results = useQuery({
    queryKey: ['paletteFlags', query],
    queryFn: () => searchPaletteFlags(query),
    enabled: query.length >= 2,
  });
  const palette = useQuery({
    queryKey: ['referencePalette', selectedId],
    queryFn: () => getReferenceFlagPalette(selectedId!),
    enabled: selectedId !== null,
  });
  const selected = selectedId ? palette.data : reference;
  useEffect(() => {
    if (palette.data) lastReference = palette.data;
  }, [palette.data]);

  return (
    <div className='space-y-3'>
      <label className='vx-well flex h-9 items-center gap-2 rounded-[10px] px-2.5'>
        <Search className='size-3.5 shrink-0 text-muted-foreground' />
        <input
          aria-label='Search flag colours'
          placeholder='Find a flag, e.g. Brazil'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className='min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground'
        />
        {search && (
          <button
            type='button'
            onClick={() => setSearch('')}
            aria-label='Clear flag search'
            className='cursor-pointer'
          >
            <X className='size-3.5' />
          </button>
        )}
      </label>
      {search.trim().length >= 2 && (
        <div
          className='max-h-44 space-y-0.5 overflow-y-auto'
          aria-live='polite'
        >
          {query !== search.trim() || results.isFetching ? (
            <p className='flex items-center gap-2 py-2 text-xs text-muted-foreground'>
              <Loader2 className='size-3.5 animate-spin' />
              Searching flags…
            </p>
          ) : results.isError ? (
            <p className='text-xs text-bad'>
              Couldn’t search flags.{' '}
              <button
                type='button'
                onClick={() => results.refetch()}
                className='underline cursor-pointer'
              >
                Try again
              </button>
            </p>
          ) : results.data?.length === 0 ? (
            <p className='py-2 text-xs text-muted-foreground'>
              No matching flags.
            </p>
          ) : (
            results.data?.map((flag) => (
              <button
                key={flag.id}
                type='button'
                onClick={() => {
                  setSelectedId(flag.id);
                  setSearch('');
                }}
                className='flex w-full cursor-pointer items-center gap-2 rounded-[8px] p-2 text-left text-xs hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring'
              >
                <span className='flex h-6 w-9 shrink-0 items-center justify-center'>
                  <FlagImage src={flag.image} alt='' maxHeight={20} fixed />
                </span>
                <span className='truncate'>{flag.name}</span>
              </button>
            ))
          )}
        </div>
      )}
      {selectedId && palette.isFetching && (
        <p
          role='status'
          className='flex items-center gap-2 text-xs text-muted-foreground'
        >
          <Loader2 className='size-3.5 animate-spin' />
          Reading flag colours…
        </p>
      )}
      {selectedId && palette.isError && (
        <p className='text-xs text-bad'>
          Couldn’t load colours.{' '}
          <button
            type='button'
            className='underline cursor-pointer'
            onClick={() => palette.refetch()}
          >
            Try again
          </button>
        </p>
      )}
      {selected && (
        <ReferenceColors
          key={selected.id}
          reference={selected}
          value={value}
          onPick={(color) => {
            lastReference = selected;
            setReference(selected);
            onPick(color);
          }}
        />
      )}
      {!selected && !selectedId && search.length < 2 && (
        <p className='text-xs leading-relaxed text-muted-foreground'>
          Borrow a colour from any flag. Search its name, then choose a swatch.
        </p>
      )}
    </div>
  );
}

function ReferenceColors({
  reference,
  value,
  onPick,
}: {
  reference: Reference;
  value: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className='space-y-2.5 border-t border-line pt-3'>
      <div className='flex items-center gap-2'>
        <span className='flex h-6 w-9 shrink-0 items-center justify-center'>
          <FlagImage src={reference.image} alt='' maxHeight={22} fixed />
        </span>
        <p className='truncate text-xs font-semibold'>{reference.name}</p>
      </div>
      {reference.colors.length === 0 ? (
        <p className='text-xs text-muted-foreground'>
          No colours available for this flag. Try another flag.
        </p>
      ) : (
        <div className='grid grid-cols-2 gap-1.5'>
          {reference.colors.map((color) => (
            <button
              type='button'
              key={color.hex}
              onClick={() => onPick(color.hex)}
              aria-label={`Use ${reference.name} ${color.name} ${color.hex}`}
              aria-pressed={sameColor(color.hex, value)}
              title={`${color.name} · ${color.hex}`}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-[8px] p-1.5 hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring',
                sameColor(color.hex, value) && 'bg-main-soft ring-1 ring-main',
              )}
            >
              <span
                className='size-6 shrink-0 rounded-[6px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.16)]'
                style={{ background: color.hex }}
              />
              <span className='font-mono text-[10px]'>{color.hex}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
