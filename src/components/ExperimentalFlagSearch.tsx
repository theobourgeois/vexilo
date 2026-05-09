'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Flag,
  Globe,
  Palette,
  Search,
  Sparkles,
  Star,
  Text,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getExperimentalFlagSearchResults } from '@/actions/flag-smart-search';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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

function ResultSkeleton() {
  return (
    <Card className='h-full p-0'>
      <div className='aspect-[3/2] animate-pulse bg-muted/60' />
      <CardContent className='space-y-4 pt-6'>
        <div className='h-6 w-2/3 animate-pulse rounded bg-muted/60' />
        <div className='h-16 animate-pulse rounded bg-muted/50' />
        <div className='flex gap-2'>
          <div className='h-6 w-20 animate-pulse rounded-full bg-muted/60' />
          <div className='h-6 w-24 animate-pulse rounded-full bg-muted/60' />
        </div>
      </CardContent>
    </Card>
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
    <div className='flex items-center justify-center gap-4'>
      <Button
        variant='neutral'
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ArrowLeft className='h-4 w-4' />
        Previous
      </Button>
      <span className='text-sm text-muted-foreground'>
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant='neutral'
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
        <ArrowRight className='h-4 w-4' />
      </Button>
    </div>
  );
}

function InsightChips({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
        {title}
      </span>
      {items.map((item) => (
        <Badge key={`${title}-${item}`} variant='neutral'>
          {item}
        </Badge>
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

  return (
    <div className='min-h-screen bg-background pb-20'>
      <div className='border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='container mx-auto flex h-14 max-w-6xl items-center px-4'>
          <Link
            href='/'
            className='inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back home
          </Link>
        </div>
      </div>

      <section className='border-b border-border/40 bg-muted/20 py-16 sm:py-24'>
        <div className='container mx-auto max-w-6xl px-4'>
          <div className='mx-auto max-w-3xl text-center'>
            <Badge className='mb-5'>
              <Sparkles className='h-3 w-3' />
              Experimental smart search
            </Badge>
            <h1 className='text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl'>
              Search by meaning, not just by name
            </h1>
            <p className='mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl'>
              This search blends fuzzy name matching with AI-generated flag
              metadata, so it can understand colors, layouts, symbols, regions,
              and style clues.
            </p>
            <p className='mt-3 text-sm text-muted-foreground'>
              Type <code>exp</code> to browse only flags that already have an
              experimental metadata row.
            </p>
          </div>

          <Card className='mx-auto mt-10 max-w-4xl'>
            <CardHeader className='space-y-4'>
              <div className='relative'>
                <Search className='absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    updatePage(1);
                  }}
                  placeholder='Try “green flag with crescent”, “african tricolor”, or “scandinavian cross”'
                  className={cn(
                    'h-14 rounded-2xl border-border/70 bg-background pl-12 pr-12 text-base',
                    searchQuery && 'pr-14',
                  )}
                />
                {searchQuery && (
                  <button
                    type='button'
                    onClick={() => {
                      setSearchQuery('');
                      updatePage(1);
                    }}
                    className='absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground'
                    aria-label='Clear search'
                  >
                    <X className='h-4 w-4' />
                  </button>
                )}
              </div>

              <div className='flex flex-wrap gap-2'>
                {EXAMPLE_QUERIES.map((example) => (
                  <Button
                    key={example}
                    variant='neutral'
                    size='sm'
                    onClick={() => setExampleQuery(example)}
                  >
                    {example}
                  </Button>
                ))}
              </div>

              <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
                <span>Understands:</span>
                <Badge variant='neutral'>
                  <Palette className='h-3 w-3' />
                  Colors
                </Badge>
                <Badge variant='neutral'>
                  <Flag className='h-3 w-3' />
                  Layouts
                </Badge>
                <Badge variant='neutral'>
                  <Star className='h-3 w-3' />
                  Symbols
                </Badge>
                <Badge variant='neutral'>
                  <Globe className='h-3 w-3' />
                  Regions
                </Badge>
                <Badge variant='neutral'>
                  <Text className='h-3 w-3' />
                  Text and mottos
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className='container mx-auto mt-12 max-w-6xl px-4'>
        {!hasQuery && (
          <div className='grid gap-6 md:grid-cols-2 xl:grid-cols-4'>
            <Card>
              <CardHeader>
                <CardTitle>Color-aware</CardTitle>
                <CardDescription>
                  Combine dominant colors like red, white, gold, or light blue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant='neutral'
                  size='sm'
                  onClick={() => setExampleQuery('red white blue star')}
                >
                  red white blue star
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Layout-aware</CardTitle>
                <CardDescription>
                  Search for tricolors, nordic crosses, diagonals, or cantons.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant='neutral'
                  size='sm'
                  onClick={() => setExampleQuery('scandinavian cross')}
                >
                  scandinavian cross
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Symbol-aware</CardTitle>
                <CardDescription>
                  Match stars, crescents, crowns, plants, animals, and more.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant='neutral'
                  size='sm'
                  onClick={() => setExampleQuery('green flag with crescent')}
                >
                  green flag with crescent
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Context-aware</CardTitle>
                <CardDescription>
                  Metadata can surface regional, stylistic, and period-based
                  clues too.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant='neutral'
                  size='sm'
                  onClick={() => setExampleQuery('african tricolor')}
                >
                  african tricolor
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {hasQuery && (
          <div className='space-y-6'>
            <Card>
              <CardHeader className='gap-4'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
                  <div>
                    <CardTitle className='text-2xl tracking-tight'>
                      Smart results for “{debouncedQuery}”
                    </CardTitle>
                    <CardDescription className='mt-2 text-base text-muted-foreground'>
                      {isExpShortcut
                        ? `${resultCount} flag${
                            resultCount === 1 ? '' : 's'
                          } with experimental metadata.`
                        : `${resultCount} flag${
                            resultCount === 1 ? '' : 's'
                          } matched across names, tags, and AI metadata.`}
                      {isFetching && (
                        <span className='ml-2 font-medium text-main'>
                          Updating…
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>

                <div className='space-y-3'>
                  <InsightChips title='Colors' items={data?.insights.colors || []} />
                  <InsightChips title='Layouts' items={data?.insights.layouts || []} />
                  <InsightChips
                    title='Patterns'
                    items={data?.insights.patterns || []}
                  />
                  <InsightChips title='Symbols' items={data?.insights.symbols || []} />
                  <InsightChips title='Text' items={data?.insights.text || []} />
                  <InsightChips
                    title='Keywords'
                    items={data?.insights.freeText || []}
                  />
                </div>
              </CardHeader>
            </Card>

            <SimplePagination
              currentPage={Math.max(1, currentPage)}
              totalPages={data?.totalPages || 0}
              onPageChange={updatePage}
            />

            {isLoading && (
              <div className='grid gap-6 sm:grid-cols-2 xl:grid-cols-3'>
                {Array.from({ length: 6 }).map((_, index) => (
                  <ResultSkeleton key={`smart-result-skeleton-${index}`} />
                ))}
              </div>
            )}

            {!isLoading && data && data.results.length === 0 && (
              <Card>
                <CardContent className='py-14 text-center'>
                  <div className='mx-auto max-w-2xl space-y-4'>
                    <h2 className='text-2xl font-bold tracking-tight'>
                      No smart matches yet
                    </h2>
                    <p className='text-muted-foreground'>
                      Try describing visible features instead of a country name,
                      or start with one of the example searches above.
                    </p>
                    <div className='flex flex-wrap justify-center gap-2'>
                      {EXAMPLE_QUERIES.slice(0, 4).map((example) => (
                        <Button
                          key={`empty-${example}`}
                          variant='neutral'
                          size='sm'
                          onClick={() => setExampleQuery(example)}
                        >
                          {example}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && data && data.results.length > 0 && (
              <div className='grid gap-6 sm:grid-cols-2 xl:grid-cols-3'>
                {data.results.map((result) => (
                  <Card
                    key={result.id}
                    className='overflow-hidden p-0 transition-transform duration-300 hover:-translate-y-1'
                  >
                    <Link
                      href={`/flag/${encodeURIComponent(result.flagName)}/experimental`}
                      className='group block'
                    >
                      <div className='relative aspect-[3/2] overflow-hidden border-b border-border/40 bg-black/5 dark:bg-white/5'>
                        <Image
                          src={result.flagImage}
                          alt={result.flagName}
                          fill
                          className='object-contain p-4 transition-transform duration-300 group-hover:scale-105'
                          sizes='(max-width: 1280px) 50vw, 33vw'
                        />
                      </div>
                    </Link>

                    <CardContent className='space-y-4 pt-6'>
                      <div className='space-y-2'>
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <h2 className='text-xl font-bold tracking-tight'>
                              {result.flagName}
                            </h2>
                            <p className='text-sm text-muted-foreground'>
                              #{result.index} in the collection
                            </p>
                          </div>
                          <Badge>{result.matchReasons.length} smart hit{result.matchReasons.length === 1 ? '' : 's'}</Badge>
                        </div>

                        <p className='line-clamp-3 text-sm leading-6 text-muted-foreground'>
                          {result.headline}
                        </p>
                      </div>

                      <div className='space-y-3'>
                        <div className='flex flex-wrap gap-2'>
                          {result.matchReasons.map((reason) => (
                            <Badge key={`${result.id}-${reason}`}>{reason}</Badge>
                          ))}
                        </div>

                        <div className='flex flex-wrap gap-2'>
                          {result.metadataChips.map((chip) => (
                            <Badge
                              key={`${result.id}-meta-${chip}`}
                              variant='neutral'
                            >
                              {chip}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className='flex flex-wrap gap-3 pt-2'>
                        <Button asChild>
                          <Link
                            href={`/flag/${encodeURIComponent(result.flagName)}/experimental`}
                          >
                            Explore match
                            <ArrowRight className='h-4 w-4' />
                          </Link>
                        </Button>
                        <Button variant='neutral' asChild>
                          <a
                            href={result.link}
                            target='_blank'
                            rel='noreferrer'
                          >
                            Source
                            <ExternalLink className='h-4 w-4' />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <SimplePagination
              currentPage={Math.max(1, currentPage)}
              totalPages={data?.totalPages || 0}
              onPageChange={updatePage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
