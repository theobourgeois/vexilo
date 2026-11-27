'use client';

import * as React from 'react';
import { Search } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The home page's search box. It's a plain form, so it works before the page hydrates: it opens /browse?q=…. */
export default function HomeSearch({ compact, placeholder }: { compact?: boolean; placeholder: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // "/" or ⌘K focuses this box, the same keys that focus search on Browse.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
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
      action='/browse'
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-surface text-muted-foreground transition-shadow focus-within:shadow-[var(--sh-pop),0_0_0_2px_var(--main)]',
        compact ? 'h-12 pl-4 pr-2 shadow-tile' : 'h-[60px] pl-5 pr-2 shadow-pop',
      )}
    >
      <Search className={cn('shrink-0', compact ? 'size-[18px]' : 'size-5')} />
      <input
        ref={inputRef}
        name='q'
        type='search'
        required
        autoComplete='off'
        placeholder={placeholder}
        aria-label='Search flags'
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden',
          compact ? 'text-[14.5px]' : 'text-[16px]',
        )}
      />
      {compact ? (
        <kbd className='vx-key hidden h-6 min-w-6 place-items-center rounded-md px-1.5 font-sans text-[12px] text-muted-foreground sm:grid'>/</kbd>
      ) : (
        <Button type='submit' size='lg' className='h-11 rounded-[11px] px-[18px]'>
          Search
        </Button>
      )}
    </form>
  );
}
