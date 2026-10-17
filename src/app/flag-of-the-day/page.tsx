'use client';

import { getPastFlagsOfTheDay } from '@/actions/flags';
import FlagImage from '@/components/FlagImage';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from '@/components/icons';
import Link from 'next/link';
import { useState } from 'react';

type Entry = Awaited<ReturnType<typeof getPastFlagsOfTheDay>>['flags'][number];

const flagHref = (name: string) => `/flag/${encodeURIComponent(name)}`;
const catalogue = (index: number) => `#${String(index).padStart(4, '0')}`;

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const isToday = (date: Date) => new Date(date).toDateString() === new Date().toDateString();

function FeaturedEntry({ entry }: { entry: Entry }) {
  const { flag } = entry;
  const href = flagHref(flag.name);
  const today = isToday(entry.date);

  return (
    <article className='vx-tile grid overflow-hidden lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]'>
      <div className='bg-stage relative h-[300px] border-b border-line [container-type:size] sm:h-[360px] lg:border-b-0 lg:border-r'>
        <Link href={href} className='flag-stage absolute inset-0 p-10 sm:p-12' aria-label={flag.name}>
          <FlagImage src={flag.image} alt={flag.name} maxHeight={260} area={400 * 260} eager />
        </Link>
      </div>
      <div className='flex flex-col p-6 sm:p-[26px]'>
        <span className='vx-label flex items-center gap-2'>
          {today ? 'Today' : 'Latest'} · {formatDate(entry.date)}
        </span>
        <Link
          href={href}
          className='mt-2.5 text-[32px] font-semibold leading-[1.05] tracking-[-0.045em] hover:underline hover:underline-offset-4'
        >
          {flag.name}
        </Link>
        <p className='mt-2 tabular-nums text-xs text-muted-foreground'>
          {catalogue(flag.index)}
          {flag.tags?.[0] ? ` · ${flag.tags[0]}` : ''}
        </p>
        {flag.description && <p className='mt-4 line-clamp-4 max-w-[60ch] text-subtle'>{flag.description}</p>}
        <div className='mt-6 lg:mt-auto lg:pt-6'>
          <Button variant='neutral' asChild>
            <Link href={href}>
              Open flag
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function ArchiveTile({ entry }: { entry: Entry }) {
  const { flag } = entry;
  return (
    <Link
      href={flagHref(flag.name)}
      className='vx-tile flex h-full flex-col transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.2,.7,.3,1)] hover:shadow-tile-hover'
    >
      <div className='flag-stage h-[196px] px-5'>
        <FlagImage src={flag.image} alt={flag.name} maxHeight={168} area={190 * 124} />
      </div>
      <div className='pb-3.5 pl-4 pr-3.5'>
        <h3 className='truncate text-[14.5px] font-semibold tracking-[-0.015em]'>{flag.name}</h3>
        <p className='mt-0.5 flex justify-between gap-2 tabular-nums text-[11.5px] text-muted-foreground'>
          <time dateTime={new Date(entry.date).toISOString()}>{formatDate(entry.date)}</time>
          <span>{catalogue(flag.index)}</span>
        </p>
      </div>
    </Link>
  );
}

export default function FlagOfTheDayHistory() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['fotdHistory', page],
    queryFn: () => getPastFlagsOfTheDay(page),
  });

  const entries = data?.flags ?? [];
  const featured = page === 1 ? entries[0] : undefined;
  const archive = featured ? entries.slice(1) : entries;

  const changePage = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className='mx-auto max-w-[1312px] px-4 pb-16 md:px-8'>
      <div className='pb-[18px] pt-7'>
        <h1 className='flex items-baseline gap-2.5 text-[22px] font-semibold tracking-[-0.03em]'>
          Flag of the day
          {data && data.totalCount > 0 && (
            <span className='tabular-nums text-sm font-normal tracking-normal text-muted-foreground'>
              {data.totalCount.toLocaleString()}
            </span>
          )}
        </h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>Every flag featured so far, newest first.</p>
      </div>

      {isLoading ? (
        <>
          {page === 1 && <div className='vx-tile mb-10 h-[360px] animate-pulse' />}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className='vx-tile h-[292px] animate-pulse' />
            ))}
          </div>
        </>
      ) : entries.length === 0 ? (
        <div className='vx-tile px-6 py-16 text-center text-[13px] text-muted-foreground'>
          No flags of the day yet.
        </div>
      ) : (
        <>
          {featured && <FeaturedEntry entry={featured} />}

          {archive.length > 0 && (
            <section className={featured ? 'mt-10' : undefined}>
              {featured && <h2 className='mb-4 text-[17px] font-semibold tracking-[-0.02em]'>Previous days</h2>}
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                {archive.map((entry) => (
                  <ArchiveTile key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {data && data.totalPages > 1 && (
            <div className='mt-8 flex items-center justify-center gap-3'>
              <Button
                variant='neutral'
                size='icon'
                onClick={() => changePage(Math.max(1, page - 1))}
                disabled={page === 1}
                aria-label='Previous page'
              >
                <ArrowLeft />
              </Button>
              <span className='min-w-28 text-center tabular-nums text-xs text-muted-foreground'>
                {page} / {data.totalPages}
              </span>
              <Button
                variant='neutral'
                size='icon'
                onClick={() => changePage(Math.min(data.totalPages, page + 1))}
                disabled={page === data.totalPages}
                aria-label='Next page'
              >
                <ArrowRight />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
