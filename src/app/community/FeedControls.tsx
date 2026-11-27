'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { Clock, Fire, Search, Shuffle, Users, X } from '@/components/icons';
import { Segmented } from '@/components/ui/segmented';
import type { PostRange, PostSort } from '@/lib/posts';
import { cn } from '@/lib/utils';

/** Popular / New / Following, the time range, and tag chips. They're in the URL so lists can be shared. */
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

  const chip = (active: boolean) =>
    cn(
      'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors [&_svg]:size-3.5',
      active ? 'bg-foreground text-background' : 'bg-surface text-subtle shadow-tile hover:text-foreground',
    );

  return (
    <div className='mb-4 space-y-3'>
      <div className='flex flex-wrap items-center gap-2.5'>
        <Segmented
          aria-label='Order'
          value={sort}
          onChange={(value) => update({ sort: value === 'popular' ? null : value })}
          options={[
            { value: 'popular', icon: <Fire />, label: 'Popular' },
            { value: 'new', icon: <Clock />, label: 'New' },
            { value: 'following', icon: <Users />, label: 'Following' },
          ]}
        />
        {sort === 'popular' && (
          <Segmented
            aria-label='Time range'
            value={range}
            onChange={(value) => update({ range: value === 'week' ? null : value })}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
              { value: 'all', label: 'All time' },
            ]}
          />
        )}
        <form
          className='vx-well ml-auto flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-[11px] px-3 sm:max-w-[260px]'
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: query.trim() || null });
          }}
        >
          <Search className='size-4 shrink-0 text-muted-foreground' />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search designs or people'
            aria-label='Search designs or people'
            className='min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground'
          />
          {search && (
            <button
              type='button'
              aria-label='Clear search'
              className='cursor-pointer text-muted-foreground hover:text-foreground'
              onClick={() => {
                setQuery('');
                update({ q: null });
              }}
            >
              <X className='size-3.5' />
            </button>
          )}
        </form>
      </div>
      <div className='flex flex-wrap gap-1.5'>
        <button type='button' className={chip(remixes)} onClick={() => update({ remixes: remixes ? null : '1' })}>
          <Shuffle />
          Remixes
        </button>
        {tags.map((name) => (
          <button key={name} type='button' className={cn(chip(tag === name), 'capitalize')} onClick={() => update({ tag: tag === name ? null : name })}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
