'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Search,
  X,
} from '@/components/icons';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getExperimentalFlagSearchResults } from '@/actions/flag-smart-search';
import { Button } from '@/components/ui/button';
import FlagCard from '@/components/FlagCard';
import Tag from '@/components/Tag';

const ITEMS_PER_PAGE = 24;
const DEBOUNCE_DELAY = 250;

const EXAMPLE_QUERIES = [
  'exp',
  'red white blue star',
  'green flag with crescent',
  'scandinavian cross',
  'african tricolor',
  'flag with motto and crown',
  'black yellow diagonal',
];

const HINTS = [
  { title: 'Colours', body: 'Combine dominant colours like red, white, gold or light blue.', example: 'red white blue star' },
  { title: 'Layouts', body: 'Tricolors, nordic crosses, diagonals and cantons.', example: 'scandinavian cross' },
  { title: 'Symbols', body: 'Stars, crescents, crowns, plants, animals and more.', example: 'green flag with crescent' },
  { title: 'Context', body: 'Regional, stylistic and period clues from the metadata.', example: 'african tricolor' },
];

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
  if (totalPages <= 1) {
    return null;
  }

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

function InsightGroup({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      <span className='mr-1 text-[12.5px] text-muted-foreground'>{title}</span>
      {items.map((item) => (
        <span
          key={`${title}-${item}`}
          className='inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-medium text-subtle shadow-[inset_0_0_0_1px_var(--border)]'
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function ExperimentalFlagSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') || '');

  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setDebouncedQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, DEBOUNCE_DELAY);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    } else {
      params.delete('q');
    }

    if (currentPage > 1 && debouncedQuery) {
      params.set('page', String(currentPage));
    } else {
      params.delete('page');
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [currentPage, debouncedQuery, pathname, router, searchParams]);

  const updatePage = useCallback(
    (page: number) => {
      const nextPage = Math.max(1, page);
      const params = new URLSearchParams(searchParams.toString());
      if (nextPage > 1) {
        params.set('page', String(nextPage));
      } else {
        params.delete('page');
      }

      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setExampleQuery = useCallback(
    (value: string) => {
      setSearchQuery(value);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const hasQuery = debouncedQuery.length > 0;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['experimental-flag-search', debouncedQuery, currentPage],
    queryFn: () =>
      getExperimentalFlagSearchResults(
        debouncedQuery,
        Math.max(1, currentPage),
        ITEMS_PER_PAGE,
      ),
    enabled: hasQuery,
    staleTime: 60_000,
  });

  const resultCount = data?.total || 0;
  const isExpShortcut = debouncedQuery.trim().toLowerCase() === 'exp';

  const insights = data?.insights;
  const hasInsights =
    !!insights &&
    [
      insights.colors,
      insights.layouts,
      insights.patterns,
      insights.symbols,
      insights.text,
      insights.freeText,
    ].some((items) => items.length > 0);

  return (
    <div>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-3 pb-[18px] pt-7'>
        <h1 className='flex min-w-0 items-baseline gap-2.5 text-[22px] font-semibold tracking-[-0.03em]'>
          <span className='truncate'>
            {hasQuery ? `Results for “${debouncedQuery}”` : 'Smart search'}
          </span>
          <span className='shrink-0 tabular-nums text-[13px] font-normal tracking-normal text-muted-foreground'>
            {hasQuery && data
              ? `${resultCount.toLocaleString()} ${resultCount === 1 ? 'flag' : 'flags'}`
              : ''}
          </span>
          {isFetching && <Loader2 className='size-3.5 shrink-0 animate-spin self-center text-muted-foreground' />}
        </h1>
        <span className='rounded-md bg-main-soft px-1.5 py-1 tabular-nums text-xs font-medium leading-none text-main sm:ml-auto'>
          Experimental
        </span>
      </div>

      <div className='relative'>
        <Search className='pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground' />
        <input
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            updatePage(1);
          }}
          placeholder='Describe a flag'
          aria-label='Smart search'
          className='vx-well h-12 w-full rounded-[13px] pl-11 pr-12 text-[15px] text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[var(--sh-well),0_0_0_2px_var(--main)]'
        />
        {searchQuery && (
          <button
            type='button'
            onClick={() => {
              setSearchQuery('');
              updatePage(1);
            }}
            className='absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground'
            aria-label='Clear search'
          >
            <X className='size-4' />
          </button>
        )}
      </div>

      <div className='-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 pt-0.5 [scrollbar-width:none] md:mx-0 md:px-0.5'>
        {EXAMPLE_QUERIES.map((example) => (
          <Tag
            key={example}
            variant='chip'
            text={example}
            isActive={debouncedQuery === example}
            onClick={() => setExampleQuery(example)}
          />
        ))}
      </div>

      {hasQuery && hasInsights && insights && (
        <div className='mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-line pt-4'>
          <span className='vx-label'>Understood</span>
          <InsightGroup title='Colours' items={insights.colors} />
          <InsightGroup title='Layouts' items={insights.layouts} />
          <InsightGroup title='Patterns' items={insights.patterns} />
          <InsightGroup title='Symbols' items={insights.symbols} />
          <InsightGroup title='Text' items={insights.text} />
          <InsightGroup title='Keywords' items={insights.freeText} />
        </div>
      )}

      <div className='mt-[22px]'>
        {!hasQuery && (
          <div className='vx-tile grid sm:grid-cols-2 lg:grid-cols-4'>
            {HINTS.map((hint, i) => (
              <div
                key={hint.title}
                className={`flex flex-col gap-1.5 p-5 ${i > 0 ? 'border-t border-line sm:border-t-0' : ''} ${
                  i % 2 === 1 ? 'sm:border-l sm:border-line' : ''
                } ${i >= 2 ? 'sm:border-t sm:border-line lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l lg:border-line' : ''}`}
              >
                <h2 className='text-sm font-semibold tracking-[-0.01em]'>{hint.title}</h2>
                <p className='text-[13px] leading-relaxed text-muted-foreground'>{hint.body}</p>
                <button
                  type='button'
                  onClick={() => setExampleQuery(hint.example)}
                  className='mt-1.5 inline-flex w-fit cursor-pointer items-center gap-1 tabular-nums text-xs text-subtle transition-colors hover:text-foreground'
                >
                  {hint.example}
                  <ArrowRight className='size-3' />
                </button>
              </div>
            ))}
            <p className='border-t border-line px-5 py-3.5 text-[13px] text-muted-foreground sm:col-span-2 lg:col-span-4'>
              Type <code className='tabular-nums text-foreground'>exp</code> to list only flags that already have experimental metadata.
            </p>
          </div>
        )}

        {hasQuery && isLoading && (
          <div className={GRID}>
            {Array.from({ length: 8 }).map((_, index) => (
              <FlagCardSkeleton key={`smart-result-skeleton-${index}`} />
            ))}
          </div>
        )}

        {hasQuery && !isLoading && data && data.results.length === 0 && (
          <div className='vx-tile flex flex-col items-center gap-3 px-6 py-16 text-center'>
            <p className='text-[15px] font-medium'>No smart matches for “{debouncedQuery}”</p>
            <p className='text-sm text-muted-foreground'>
              {isExpShortcut
                ? 'No flags have experimental metadata yet.'
                : 'Try describing visible features instead of a country name.'}
            </p>
            <Button
              variant='neutral'
              onClick={() => {
                setSearchQuery('');
                updatePage(1);
              }}
              className='mt-2'
            >
              Clear search
            </Button>
          </div>
        )}

        {hasQuery && !isLoading && data && data.results.length > 0 && (
          <div className={GRID}>
            {data.results.map((result) => (
              <div key={result.id} className='flex flex-col gap-2'>
                <div className='flex-1'>
                  <FlagCard
                    id={result.id}
                    flagName={result.flagName}
                    flagImage={result.flagImage}
                    link={result.link}
                    index={result.index}
                    tags={result.tags}
                    description={result.description}
                    favorites={result.favorites}
                    sources={[]}
                  />
                </div>
                <Link
                  href={`/flag/${encodeURIComponent(result.flagName)}/experimental`}
                  className='group flex min-w-0 items-center gap-1.5 px-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground'
                  title={result.matchReasons.join(' · ')}
                >
                  <span className='truncate'>{result.matchReasons.join(' · ')}</span>
                  <ArrowRight className='size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100' />
                </Link>
              </div>
            ))}
          </div>
        )}

        {hasQuery && (
          <div className='mt-7'>
            <SimplePagination
              currentPage={Math.max(1, currentPage)}
              totalPages={data?.totalPages || 0}
              onPageChange={updatePage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
