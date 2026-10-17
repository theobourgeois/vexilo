'use client';
import { Card, CardHeader, CardContent, CardFooter } from './ui/card';
import FlagCard from './FlagCard';
import { useQuery } from '@tanstack/react-query';
import { getFlagOfTheDay } from '@/actions/flags';
import { Skeleton } from './ui/skeleton';
import Link from 'next/link';
import { History } from '@/components/icons';

export function FlagOfTheDay() {
  const { data: flagOfTheDay } = useQuery({
    queryKey: ['flagOfTheDay'],
    queryFn: async () => {
      return await getFlagOfTheDay().then((flag) => {
        return {
          flagName: flag.name,
          flagImage: flag.image,
          link: flag.link,
          index: flag.index,
          tags: flag.tags,
          description: flag.description,
          id: flag.id,
          isFavorite: flag.isFavorite,
          favorites: flag.favorites,
          sources: flag.sources,
        };
      });
    },
  });

  if (!flagOfTheDay) {
    return <Skeleton className='h-full w-full' />;
  }

  return (
    <Card className='h-full p-6'>
      <CardHeader className='text-2xl font-bold mb-4 text-center pb-0 px-0'>
        Flag of the Day
      </CardHeader>
      <CardContent className='px-0'>
        <FlagCard
          id={flagOfTheDay.id}
          sources={flagOfTheDay.sources ?? []}
          tags={flagOfTheDay.tags}
          description={flagOfTheDay.description}
          flagName={flagOfTheDay.flagName}
          flagImage={flagOfTheDay.flagImage}
          link={flagOfTheDay.link}
          index={flagOfTheDay.index}
          isFavorite={flagOfTheDay.isFavorite}
          favorites={flagOfTheDay.favorites}
        />
      </CardContent>
      <CardFooter className='flex flex-col gap-3 pt-6 px-0 border-t-0'>
        <p className='text-center text-sm'>
          Come back tomorrow for a new flag!
        </p>
        <Link
          href='/flag-of-the-day'
          className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <History className='h-4 w-4' />
          View past flags of the day
        </Link>
      </CardFooter>
    </Card>
  );
}
