'use client';

import React, { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ChevronDown, Heart, Search, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FlagCard from './FlagCard';
import { FlagOfTheDayLink } from './flag-of-the-day-link';
import Tag from './Tag';
import {
  getFavoriteFlagsCount,
  getFavouriteFlags,
  getFlags,
  getFlagsCount,
  getTopFlagTags,
} from '@/actions/flags';
import { flags } from '@/db/schema';
import {
  COLOR_FAMILIES,
  FLAG_TRAITS,
  getTrait,
  parseFlagQuery,
  removeFromQuery,
} from '@/lib/flag-search-terms';
import { FOCUS_SEARCH_KEY } from '@/lib/nav';
import { cn } from '@/lib/utils';

type OrderBy = keyof typeof flags.$inferSelect;
type Sort = 'popular' | 'latest' | 'az';

const ITEMS_PER_PAGE = 56;
const DEBOUNCE_DELAY = 300;

const SORTS: Record<Sort, { orderBy: OrderBy; direction: 'asc' | 'desc' }> = {
  popular: { orderBy: 'favorites', direction: 'desc' },
  latest: { orderBy: 'updatedAt', direction: 'desc' },
  az: { orderBy: 'name', direction: 'asc' },
};

/** Colours offered as swatches; the rest (pink, brown, grey) can still be typed. */
const SWATCHES = COLOR_FAMILIES.filter((family) => !['pink', 'brown', 'grey'].includes(family.key));

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

function FlagCardSkeleton() {
  return (
    <div className='vx-tile flex h-[292px] flex-col'>
      <div className='grid flex-1 place-items-center'>
        <div className='h-[110px] w-[170px] animate-pulse rounded-sm bg-foreground/[0.06]' />
      </div>
      <div className='space-y-2 px-4 pb-4'>
        <div className='h-4 w-2/3 animate-pulse rounded bg-foreground/[0.06]' />
        <div className='h-3 w-1/3 animate-pulse rounded bg-foreground/[0.06]' />
      </div>
    </div>
  );
}

function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className='flex items-center justify-center gap-3'>
      <Button
        variant='neutral'
        size='icon'
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label='Previous page'
      >
        <ArrowLeft />
      </Button>
      <span className='min-w-28 text-center tabular-nums text-xs text-muted-foreground'>
        {currentPage} / {totalPages}
      </span>
      <Button
        variant='neutral'
        size='icon'
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label='Next page'
      >
        <ArrowRight />
      </Button>
    </div>
  );
}

const listParam = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);

function TraitMenu({
  label,
  group,
  selected,
  onToggle,
}: {
  label: string;
  group: 'type' | 'symbol';
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const options = FLAG_TRAITS.filter((trait) => trait.group === group);
  const count = options.filter((trait) => selected.includes(trait.key)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className={cn(
            'inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
            count > 0 ? 'bg-main-soft text-main shadow-[0_0_0_1px_color-mix(in_srgb,var(--main)_40%,transparent)]' : 'vx-key text-subtle hover:text-foreground',
          )}
        >
          {label}
          {count > 0 && <span className='tabular-nums'>· {count}</span>}
          <ChevronDown className='size-3.5' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='max-h-[360px] w-56 overflow-y-auto'>
        {options.map((trait) => (
          <DropdownMenuCheckboxItem
            key={trait.key}
            checked={selected.includes(trait.key)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggle(trait.key)}
          >
            {trait.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function FlagSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get('q') || '';
  const tag = searchParams.get('tag') || '';
  const colorFilters = listParam(searchParams.get('color'));
  const traitFilters = listParam(searchParams.get('trait'));
  const isFavorites = searchParams.get('favorites') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const orderBy = (searchParams.get('orderBy') as OrderBy) || 'favorites';
  const orderDirection =
    (searchParams.get('orderDirection') as 'asc' | 'desc') || 'desc';
  const sort: Sort = orderBy === 'name' ? 'az' : orderBy === 'updatedAt' ? 'latest' : 'popular';
  const filters = { colors: colorFilters, traits: traitFilters };

  const parsed = useMemo(() => parseFlagQuery(query), [query]);
  const activeColors = new Set([...parsed.colors, ...colorFilters]);
  const activeTraits = new Set([...parsed.traits, ...traitFilters]);

  const [value, setValue] = React.useState(query);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const updateParams = useCallback(
    (update: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      update(params);
      params.delete('page');
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : '/', { scroll: false });
    },
    [router, searchParams],
  );

  const setListParam = (name: 'color' | 'trait', values: string[]) =>
    updateParams((params) => {
      if (values.length > 0) params.set(name, values.join(','));
      else params.delete(name);
    });

  const setQuery = useCallback(
    (next: string) =>
      updateParams((params) => {
        if (next.trim()) params.set('q', next);
        else params.delete('q');
      }),
    [updateParams],
  );

  // Follow external URL changes (tag links, back/forward, removing a chip).
  React.useEffect(() => {
    setValue(query);
  }, [query]);

  React.useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => setQuery(value), DEBOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [value, query, setQuery]);

  React.useEffect(() => {
    if (sessionStorage.getItem(FOCUS_SEARCH_KEY)) {
      sessionStorage.removeItem(FOCUS_SEARCH_KEY);
      inputRef.current?.focus();
    }
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

  const toggleColor = (key: string) => {
    if (parsed.colors.includes(key as never)) setQuery(removeFromQuery(query, 'color', key));
    else setListParam('color', colorFilters.includes(key) ? colorFilters.filter((c) => c !== key) : [...colorFilters, key]);
  };
  const toggleTrait = (key: string) => {
    if (parsed.traits.includes(key)) setQuery(removeFromQuery(query, 'trait', key));
    else setListParam('trait', traitFilters.includes(key) ? traitFilters.filter((t) => t !== key) : [...traitFilters, key]);
  };

  const chips = [
    ...[...activeColors].map((key) => {
      const family = COLOR_FAMILIES.find((entry) => entry.key === key);
      return { id: `c-${key}`, label: family?.label ?? key, swatch: family?.swatch, remove: () => toggleColor(key) };
    }),
    ...[...activeTraits].map((key) => ({
      id: `t-${key}`,
      label: getTrait(key)?.label ?? key,
      swatch: undefined,
      remove: () => toggleTrait(key),
    })),
  ];
  const hasFilters = chips.length > 0;

  const { data: topFlagTags } = useQuery({
    queryKey: ['topFlagTags'],
    queryFn: () => getTopFlagTags(20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: flagRows, isLoading: flagsLoading } = useQuery({
    queryKey: ['flags', currentPage, query, isFavorites, orderBy, orderDirection, tag, filters],
    queryFn: async () => {
      const fetchFn = isFavorites ? getFavouriteFlags : getFlags;
      const results = await fetchFn(currentPage, ITEMS_PER_PAGE, query, orderBy, orderDirection, tag, filters);
      return results.map((flag) => ({
        favorites: flag.favorites,
        flagName: flag.name,
        flagImage: flag.image,
        link: flag.link,
        index: flag.index,
        tags: flag.tags,
        description: flag.description,
        id: flag.id,
        isFavorite: flag.isFavorite,
        sources: flag.sources,
      }));
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: flagsCount } = useQuery({
    queryKey: ['flagsCount', query, isFavorites, tag, filters],
    queryFn: () => (isFavorites ? getFavoriteFlagsCount : getFlagsCount)(query, tag, filters),
    staleTime: 2 * 60 * 1000,
  });

  const updatePage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    router.replace(`/?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAll = () => {
    setValue('');
    updateParams((params) => {
      params.delete('q');
      params.delete('color');
      params.delete('trait');
      params.delete('tag');
    });
  };

  const totalPages = Math.ceil((flagsCount || 0) / ITEMS_PER_PAGE);
  const isSearching = Boolean(query || tag || hasFilters);

  return (
    <div>
      <div className='flex flex-wrap items-end gap-x-4 gap-y-1 pt-8'>
        <h1 className='text-[28px] font-semibold tracking-[-0.03em] sm:text-[30px]'>
          {isFavorites ? 'Favorites' : 'Browse'}
        </h1>
        <p className='pb-1.5 tabular-nums text-[13px] text-muted-foreground'>
          {flagsCount !== undefined
            ? isSearching
              ? `${flagsCount.toLocaleString()} ${flagsCount === 1 ? 'flag matches' : 'flags match'}`
              : `${flagsCount.toLocaleString()} flags`
            : ''}
        </p>
        {!isFavorites && <FlagOfTheDayLink className='-ml-1.5 mt-2 max-w-full sm:-my-2.5 sm:-mr-2.5 sm:ml-auto sm:max-w-[420px] sm:self-center' />}
      </div>

      <form
        role='search'
        className='vx-well mt-4 flex h-[52px] items-center gap-3 rounded-[13px] pl-4 pr-3 text-muted-foreground transition-shadow focus-within:shadow-[var(--sh-well),0_0_0_2px_var(--main)]'
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(value);
          inputRef.current?.blur();
        }}
      >
        <Search className='size-[18px] shrink-0' />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder='Search by name, or describe a flag: “green with a star”, “red and white cross”'
          aria-label='Search flags'
          className='min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground'
        />
        {value ? (
          <button
            type='button'
            aria-label='Clear search'
            className='grid size-7 cursor-pointer place-items-center rounded-md hover:text-foreground'
            onClick={() => {
              setValue('');
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <X className='size-4' />
          </button>
        ) : (
          <kbd className='vx-key hidden h-[22px] min-w-[22px] place-items-center rounded-md px-1.5 text-[11px] font-medium text-subtle sm:grid'>
            /
          </kbd>
        )}
      </form>

      <div className='mt-3 flex flex-wrap items-center gap-2'>
        <TraitMenu label='Type' group='type' selected={[...activeTraits]} onToggle={toggleTrait} />
        <TraitMenu label='Symbol' group='symbol' selected={[...activeTraits]} onToggle={toggleTrait} />
        <span className='mx-1 hidden h-[22px] w-px bg-line sm:block' />
        <div className='flex items-center gap-2' role='group' aria-label='Colours'>
          {SWATCHES.map((family) => {
            const active = activeColors.has(family.key);
            return (
              <button
                key={family.key}
                type='button'
                title={family.label}
                aria-label={family.label}
                aria-pressed={active}
                onClick={() => toggleColor(family.key)}
                className={cn(
                  'size-[22px] cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.35)] transition-shadow',
                  active && 'shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--main)]',
                )}
                style={{ background: family.swatch }}
              />
            );
          })}
        </div>
        <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
          <Segmented
            aria-label='Collection'
            value={isFavorites ? 'favorites' : 'all'}
            onChange={(v) =>
              updateParams((params) => {
                if (v === 'favorites') params.set('favorites', 'true');
                else params.delete('favorites');
              })
            }
            options={[
              { value: 'all', label: 'All' },
              { value: 'favorites', label: 'Favorites', icon: <Heart /> },
            ]}
          />
          <Segmented
            aria-label='Sort'
            value={sort}
            onChange={(v) =>
              updateParams((params) => {
                params.set('orderBy', SORTS[v].orderBy);
                params.set('orderDirection', SORTS[v].direction);
              })
            }
            options={[
              { value: 'popular', label: 'Popular' },
              { value: 'latest', label: 'Latest' },
              { value: 'az', label: 'A–Z' },
            ]}
          />
        </div>
      </div>

      {hasFilters && (
        <div className='mt-3 flex flex-wrap items-center gap-2'>
          <span className='text-[13px] text-muted-foreground'>Showing flags with</span>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type='button'
              onClick={chip.remove}
              aria-label={`Remove ${chip.label}`}
              className='inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full bg-main-soft pl-2.5 pr-2 text-[13px] font-medium text-main shadow-[0_0_0_1px_color-mix(in_srgb,var(--main)_40%,transparent)] hover:brightness-110'
            >
              {chip.swatch && (
                <span className='size-3 rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.4)]' style={{ background: chip.swatch }} />
              )}
              {chip.label}
              <X className='size-3' />
            </button>
          ))}
          <button type='button' onClick={clearAll} className='cursor-pointer text-[13px] text-muted-foreground hover:text-foreground'>
            Clear all
          </button>
        </div>
      )}

      <div className='-mx-4 mb-[22px] mt-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-0.5 [mask-image:linear-gradient(90deg,#000_calc(100%-64px),transparent)] [scrollbar-width:none] md:mx-0 md:px-0.5'>
        <Tag
          variant='chip'
          text='All'
          isActive={!tag}
          onClick={() => updateParams((params) => params.delete('tag'))}
        />
        {tag && !topFlagTags?.some((t) => t.tag === tag) && <Tag variant='chip' text={tag} />}
        {topFlagTags?.map((t) => (
          <Tag key={t.tag} variant='chip' text={t.tag} count={t.count} />
        ))}
        <Link
          href='/tags'
          className='inline-flex h-8 shrink-0 items-center gap-1 pl-2 pr-16 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground'
        >
          All tags
          <ArrowRight className='size-3.5' />
        </Link>
      </div>

      {flagsLoading ? (
        <div className={GRID}>
          {Array.from({ length: 12 }).map((_, i) => (
            <FlagCardSkeleton key={i} />
          ))}
        </div>
      ) : flagRows && flagRows.length > 0 ? (
        <div id='flags' className={GRID}>
          {flagRows.map((flag) => (
            <FlagCard
              id={flag.id}
              key={flag.index}
              flagName={flag.flagName}
              flagImage={flag.flagImage}
              link={flag.link}
              index={flag.index}
              tags={flag.tags}
              sources={flag.sources ?? []}
              description={flag.description}
              favorites={flag.favorites}
              isFavorite={flag.isFavorite}
            />
          ))}
        </div>
      ) : (
        <div className='vx-tile flex flex-col items-center gap-3 px-6 py-16 text-center'>
          <p className='text-[15px] font-medium'>
            {isSearching
              ? `No ${isFavorites ? 'favorite ' : ''}flags match ${query ? `“${query}”` : 'those filters'}`
              : isFavorites
                ? 'You haven’t favorited any flags yet'
                : 'No flags found'}
          </p>
          <p className='text-sm text-muted-foreground'>
            {isSearching ? 'Try fewer colours or a broader description.' : 'Try clearing the tag filter.'}
          </p>
          {isSearching && (
            <Button variant='neutral' onClick={clearAll} className='mt-2'>
              Clear search
            </Button>
          )}
        </div>
      )}

      <div className='mt-7'>
        <SimplePagination currentPage={currentPage} totalPages={totalPages} onPageChange={updatePage} />
      </div>
    </div>
  );
}
