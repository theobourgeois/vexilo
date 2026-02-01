'use client';

import { getPastFlagsOfTheDay } from '@/actions/flags';
import FlagCard from '@/components/FlagCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function FlagOfTheDayHistory() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['fotdHistory', page],
    queryFn: () => getPastFlagsOfTheDay(page),
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-main/10 dark:bg-transparent pt-4'>
        <div className='max-w-7xl mx-auto px-4'>
          <div className='mb-6'>
            <Link
              href='/'
              className='inline-flex items-center gap-2 transition-colors'
            >
              <ArrowLeft className='h-4 w-4' />
              Back to Home
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-2xl font-bold'>
                <Calendar className='h-8 w-8 text-main' />
                Flag of the Day History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className='space-y-2'>
                    <Skeleton className='h-48 w-full rounded-lg' />
                    <Skeleton className='h-4 w-32' />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-main/10 dark:bg-transparent pt-4 pb-8'>
      <div className='max-w-7xl mx-auto px-4'>
        <div className='mb-6'>
          <Link
            href='/'
            className='inline-flex items-center gap-2 transition-colors'
          >
            <ArrowLeft className='h-4 w-4' />
            Back to Home
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-2xl font-bold'>
              <Calendar className='h-8 w-8 text-main' />
              Flag of the Day History
            </CardTitle>
            <p className='text-muted-foreground'>
              Browse through all past flags of the day
            </p>
          </CardHeader>
          <CardContent>
            {data?.flags && data.flags.length > 0 ? (
              <>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                  {data.flags.map((fotd) => (
                    <div key={fotd.id} className='flex flex-col'>
                      <div className='flex-1'>
                        <FlagCard
                          id={fotd.flag.id}
                          flagName={fotd.flag.name}
                          flagImage={fotd.flag.image}
                          link={fotd.flag.link}
                          index={fotd.flag.index}
                          tags={fotd.flag.tags}
                          description={fotd.flag.description}
                          sources={fotd.flag.sources}
                          favorites={fotd.flag.favorites}
                          isFavorite={fotd.isFavorite}
                        />
                      </div>
                      <p className='text-sm text-muted-foreground text-center pt-2'>
                        {formatDate(fotd.date)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {data.totalPages > 1 && (
                  <div className='flex items-center justify-center gap-4 mt-8'>
                    <Button
                      variant='neutral'
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className='h-4 w-4 mr-1' />
                      Previous
                    </Button>
                    <span className='text-sm text-muted-foreground'>
                      Page {page} of {data.totalPages}
                    </span>
                    <Button
                      variant='neutral'
                      onClick={() =>
                        setPage((p) => Math.min(data.totalPages, p + 1))
                      }
                      disabled={page === data.totalPages}
                    >
                      Next
                      <ChevronRight className='h-4 w-4 ml-1' />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className='text-center py-12'>
                <Calendar className='h-16 w-16 text-muted-foreground mx-auto mb-4' />
                <p className='text-muted-foreground'>
                  No past flags of the day yet. Check back tomorrow!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
