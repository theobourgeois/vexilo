'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from '@/components/icons';
import { cn } from '@/lib/utils';

const DEBOUNCE_DELAY = 300;

/**
 * Global flag search. On the browse page it live-filters via the `q` param;
 * elsewhere it jumps to browse results on Enter.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isBrowse = pathname === '/';
  const urlQuery = isBrowse ? searchParams.get('q') || '' : '';
  const [value, setValue] = React.useState(urlQuery);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Follow external URL changes (tag links, back/forward).
  React.useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  const pushQuery = React.useCallback(
    (query: string, mode: 'replace' | 'push') => {
      const params = new URLSearchParams(isBrowse ? searchParams : undefined);
      if (query.trim()) params.set('q', query);
      else params.delete('q');
      params.delete('page');
      const qs = params.toString();
      const url = qs ? `/?${qs}` : '/';
      if (mode === 'replace') router.replace(url, { scroll: false });
      else router.push(url);
    },
    [isBrowse, router, searchParams],
  );

  React.useEffect(() => {
    if (!isBrowse || value === urlQuery) return;
    const timer = setTimeout(() => pushQuery(value, 'replace'), DEBOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [value, urlQuery, isBrowse, pushQuery]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role='search'
      className={cn(
        'vx-well flex h-[38px] items-center gap-2.5 rounded-[11px] pl-3 pr-2 text-muted-foreground transition-shadow focus-within:shadow-[var(--sh-well),0_0_0_2px_var(--main)]',
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        pushQuery(value, isBrowse ? 'replace' : 'push');
        inputRef.current?.blur();
      }}
    >
      <Search className='size-4 shrink-0' />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Search flags'
        aria-label='Search flags'
        className='min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground'
      />
      {value ? (
        <button
          type='button'
          aria-label='Clear search'
          className='grid size-6 place-items-center rounded-md hover:text-foreground'
          onClick={() => {
            setValue('');
            if (isBrowse) pushQuery('', 'replace');
            inputRef.current?.focus();
          }}
        >
          <X className='size-3.5' />
        </button>
      ) : (
        <kbd className='vx-key hidden h-[22px] min-w-[22px] place-items-center rounded-md px-1.5 tabular-nums text-[11px] font-medium text-subtle sm:grid'>
          ⌘K
        </kbd>
      )}
    </form>
  );
}
