'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Heart } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import FlagCard from './FlagCard';
import Tag from './Tag';
import { FlagOfTheDayTile } from './flag-of-the-day-tile';
import {
  getFavoriteFlagsCount,
  getFavouriteFlags,
  getFlags,
  getFlagsCount,
  getTopFlagTags,
} from '@/actions/flags';
import { flags } from '@/db/schema';

type OrderBy = keyof typeof flags.$inferSelect;
type Sort = 'popular' | 'views' | 'latest' | 'az';

const ITEMS_PER_PAGE = 56;

const SORTS: Record<Sort, { orderBy: OrderBy; direction: 'asc' | 'desc' }> = {
  popular: { orderBy: 'favorites', direction: 'desc' },
  views: { orderBy: 'views', direction: 'desc' },
  latest: { orderBy: 'updatedAt', direction: 'desc' },
  az: { orderBy: 'name', direction: 'asc' },
};

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

export default function FlagSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The search box lives in the site header and writes `q` to the URL.
  const query = searchParams.get('q') || '';
  const tag = searchParams.get('tag') || '';
  const isFavorites = searchParams.get('favorites') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const orderBy = (searchParams.get('orderBy') as OrderBy) || 'favorites';
  const orderDirection =
    (searchParams.get('orderDirection') as 'asc' | 'desc') || 'desc';
  const sort: Sort =
    orderBy === 'name' ? 'az' : orderBy === 'updatedAt' ? 'latest' : orderBy === 'views' ? 'views' : 'popular';

  const { data: topFlagTags } = useQuery({
    queryKey: ['topFlagTags'],
    queryFn: () => getTopFlagTags(20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['flags', currentPage, query, isFavorites, orderBy, orderDirection, tag],
    queryFn: async () => {
      const fetchFn = isFavorites ? getFavouriteFlags : getFlags;
      const results = await fetchFn(currentPage, ITEMS_PER_PAGE, query, orderBy, orderDirection, tag);
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
    queryKey: ['flagsCount', query, isFavorites, tag],
    queryFn: () => (isFavorites ? getFavoriteFlagsCount : getFlagsCount)(query, tag),
    staleTime: 2 * 60 * 1000,
  });

  const updateParams = useCallback(
    (update: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      update(params);
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : '/', { scroll: false });
    },
    [router, searchParams],
  );

  const updatePage = (page: number) => {
    updateParams((params) => {
      if (page > 1) params.set('page', String(page));
      else params.delete('page');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil((flagsCount || 0) / ITEMS_PER_PAGE);
  const showFeatured = currentPage === 1 && !query && !tag && !isFavorites;
  const title = query ? `Results for “${query}”` : isFavorites ? 'Favorites' : 'Browse';

  return (
    <div>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-3 pb-[18px] pt-7'>
        <h1 className='flex min-w-0 items-baseline gap-2.5 text-[22px] font-semibold tracking-[-0.03em]'>
          <span className='truncate'>{title}</span>
          <span className='shrink-0 tabular-nums text-[13px] font-normal tracking-normal text-muted-foreground'>
            {flagsCount !== undefined ? `${flagsCount.toLocaleString()} flags` : ''}
          </span>
        </h1>
        <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
          <Segmented
            aria-label='Collection'
            value={isFavorites ? 'favorites' : 'all'}
            onChange={(v) =>
              updateParams((params) => {
                if (v === 'favorites') params.set('favorites', 'true');
                else params.delete('favorites');
                params.delete('page');
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
                params.delete('page');
              })
            }
            options={[
              { value: 'popular', label: 'Popular' },
              { value: 'views', label: 'Most viewed' },
              { value: 'latest', label: 'Latest' },
              { value: 'az', label: 'A–Z' },
            ]}
          />
        </div>
      </div>

      <div className='-mx-4 mb-[22px] flex gap-2 overflow-x-auto px-4 pb-1 pt-0.5 [mask-image:linear-gradient(90deg,#000_calc(100%-64px),transparent)] [scrollbar-width:none] md:mx-0 md:px-0.5'>
        <Tag
          variant='chip'
          text='All'
          isActive={!tag}
          onClick={() => updateParams((params) => { params.delete('tag'); params.delete('page'); })}
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
      ) : flags && flags.length > 0 ? (
        <div id='flags' className={GRID}>
          {showFeatured && <FlagOfTheDayTile className='sm:col-span-2 lg:row-span-2' />}
          {flags.map((flag) => (
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
            {query
              ? `No ${isFavorites ? 'favorite ' : ''}flags match “${query}”`
              : isFavorites
                ? 'You haven’t favorited any flags yet'
                : 'No flags found'}
          </p>
          <p className='text-sm text-muted-foreground'>
            {query ? 'Try a different spelling or a broader term.' : 'Try clearing the tag filter.'}
          </p>
          {(query || tag) && (
            <Button variant='neutral' onClick={() => router.replace('/', { scroll: false })} className='mt-2'>
              Clear filters
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
