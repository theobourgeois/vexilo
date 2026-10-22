'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from '@/components/icons';
import { searchCountries, type Country } from '@/lib/games/pool';
import { cn } from '@/lib/utils';

/** A search box over the countries in the games, with arrow-key and Enter picking. */
export function CountryPicker({
  onPick,
  used,
  placeholder = 'Type a country…',
  autoFocus,
  disabled,
  floating,
}: {
  onPick: (country: Country) => void;
  /** Countries already played; they're listed but can't be picked again. */
  used?: Set<string>;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Show the results over the page instead of pushing it down. */
  floating?: boolean;
}) {
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const results = React.useMemo(() => searchCountries(query, 6), [query]);
  const open = results.length > 0;

  const pick = (country: Country | undefined) => {
    if (!country || used?.has(country.id)) return;
    onPick(country);
    setQuery('');
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape' && query) {
      e.stopPropagation();
      setQuery('');
    }
  };

  return (
    <div className='relative'>
      <Search className='pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete='off'
        spellCheck={false}
        role='combobox'
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className='h-12 pl-10 text-base'
      />
      {open && (
        <ul
          id={listId}
          role='listbox'
          className={cn(
            'mt-2 flex flex-col gap-0.5 rounded-[13px] p-1',
            floating ? 'vx-tile absolute inset-x-0 top-full z-20 shadow-pop' : 'vx-well',
          )}
        >
          {results.map((country, i) => {
            const taken = used?.has(country.id);
            return (
              <li
                key={country.id}
                id={`${listId}-${i}`}
                role='option'
                aria-selected={i === active}
                aria-disabled={taken}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(country)}
                className={cn(
                  'flex h-10 cursor-pointer items-center justify-between gap-3 rounded-[9px] px-3 text-[14.5px] font-medium',
                  i === active && 'bg-foreground/[0.06]',
                  taken && 'cursor-default text-muted-foreground',
                )}
              >
                <span className='truncate'>{country.name}</span>
                {taken ? (
                  <span className='text-xs font-normal'>Used</span>
                ) : (
                  i === active && <kbd className='text-xs font-normal text-muted-foreground'>↵</kbd>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
