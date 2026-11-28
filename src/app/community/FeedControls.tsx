'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { ArrowsDownUp, ChevronDown, Search, Shuffle, X } from '@/components/icons';
import Tag from '@/components/Tag';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PostRange, PostSort } from '@/lib/posts';

const SORTS: Record<PostSort, string> = { popular: 'Popular', new: 'New', following: 'Following' };
const RANGES: Record<PostRange, string> = { today: 'Today', week: 'This week', month: 'This month', all: 'All time' };

/** The same raised button as the sort menu on Browse. */
const TOOL =
  'vx-key inline-flex h-[52px] shrink-0 cursor-pointer items-center gap-2 rounded-[13px] px-3.5 text-sm font-medium text-subtle transition-colors hover:text-foreground data-[state=open]:text-foreground sm:px-4';

/** Search, the order (Popular / New / Following, and the time range for Popular), and tag chips. They're in the URL so lists can be shared. */
export default function FeedControls({
  sort,
  range,
  tag,
  remixes,
  search,
  tags,
}: {
  sort: PostSort;
  range: PostRange;
  tag: string | null;
  remixes: boolean;
  search: string;
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(search);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const sortLabel = sort === 'popular' ? `${SORTS.popular} · ${RANGES[range]}` : SORTS[sort];

  return (
    <div className='mb-4'>
      <div className='flex gap-2'>
        <form
          role='search'
          className='vx-well flex h-[52px] min-w-0 flex-1 items-center gap-3 rounded-[13px] pl-4 pr-3 text-muted-foreground transition-shadow focus-within:shadow-[var(--sh-well),0_0_0_2px_var(--main)]'
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: query.trim() || null });
          }}
        >
          <Search className='size-[18px] shrink-0' />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search designs or people'
            aria-label='Search designs or people'
            className='min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground'
          />
          {(query || search) && (
            <button
              type='button'
              aria-label='Clear search'
              className='grid size-7 cursor-pointer place-items-center rounded-md hover:text-foreground'
              onClick={() => {
                setQuery('');
                update({ q: null });
              }}
            >
              <X className='size-4' />
            </button>
          )}
        </form>

        <DropdownMenu>
          <DropdownMenuTrigger className={TOOL} aria-label={`Sort: ${sortLabel}`}>
            <ArrowsDownUp className='size-[18px] sm:hidden' />
            <span className='hidden sm:inline'>{sortLabel}</span>
            <ChevronDown className='hidden size-4 sm:block' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-44'>
            <DropdownMenuRadioGroup value={sort} onValueChange={(value) => update({ sort: value === 'popular' ? null : value })}>
              {(Object.keys(SORTS) as PostSort[]).map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {SORTS[key]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {sort === 'popular' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className='text-[12px] font-medium text-muted-foreground'>Popular from</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={range} onValueChange={(value) => update({ range: value === 'week' ? null : value })}>
                  {(Object.keys(RANGES) as PostRange[]).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {RANGES[key]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-0.5 [mask-image:linear-gradient(90deg,#000_calc(100%-64px),transparent)] [scrollbar-width:none] md:mx-0 md:px-0.5'>
        <Tag variant='chip' text='All' isActive={!tag && !remixes} onClick={() => update({ tag: null, remixes: null })} />
        <Tag variant='chip' text='Remixes' icon={<Shuffle />} isActive={remixes} onClick={() => update({ remixes: remixes ? null : '1' })} />
        {tags.map((name) => (
          <Tag
            key={name}
            variant='chip'
            text={name}
            className='capitalize'
            isActive={tag === name}
            onClick={() => update({ tag: tag === name ? null : name })}
          />
        ))}
        {/* Room for the fade at the end. */}
        <span aria-hidden className='w-12 shrink-0' />
      </div>
    </div>
  );
}
