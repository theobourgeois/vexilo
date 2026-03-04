'use client';

import { getLeaderboard } from '@/actions/leaderboard';
import { getFlagOfTheDay, toggleFavoriteFlag } from '@/actions/flags';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Trophy, ArrowRight, History, Heart } from 'lucide-react';
import Link from 'next/link';
import { getRankStyle } from '@/lib/get-rank-style';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import React from 'react';
import { toastErrorWithLogin } from '@/lib/toast-auth';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function HomeHighlights() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => getLeaderboard(),
  });

  const { data: flagOfTheDay, isLoading: fotdLoading } = useQuery({
    queryKey: ['flagOfTheDay'],
    queryFn: async () => {
      return await getFlagOfTheDay().then((flag) => ({
        flagName: flag.name,
        flagImage: flag.image,
        link: flag.link,
        index: flag.index,
        id: flag.id,
        isFavorite: flag.isFavorite,
        favorites: flag.favorites,
      }));
    },
  });
  const [isFotdFavorite, setIsFotdFavorite] = React.useState(false);

  React.useEffect(() => {
    setIsFotdFavorite(Boolean(flagOfTheDay?.isFavorite));
  }, [flagOfTheDay?.isFavorite, flagOfTheDay?.id]);

  const handleFotdFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user || !flagOfTheDay?.id) {
      toastErrorWithLogin('You must be logged in to favorite a flag');
      return;
    }

    const previousValue = isFotdFavorite;
    setIsFotdFavorite(!previousValue);

    const isSuccess = await toggleFavoriteFlag(flagOfTheDay.id, true);
    if (!isSuccess) {
      setIsFotdFavorite(previousValue);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['flagOfTheDay'] });
    queryClient.invalidateQueries({ queryKey: ['flags'] });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className='flex flex-col md:flex-row gap-4'>
      {/* Top Contributors */}
      <Card className='flex-1'>
        <CardHeader className='pb-0 py-0'>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2 text-sm font-bold'>
              <Trophy className='h-4 w-4 text-yellow-500' />
              Top Contributors
            </CardTitle>
            <Link
              href='/leaderboard'
              className='text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1'
            >
              View all
              <ArrowRight className='h-3 w-3' />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {leaderboardLoading ? (
            <div className='space-y-2'>
              {[...Array(5)].map((_, i) => (
                <div key={i} className='flex items-center gap-2'>
                  <Skeleton className='h-8 w-8 rounded-full' />
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-4 w-8 ml-auto' />
                </div>
              ))}
            </div>
          ) : (
            <div className='space-y-1.5'>
              {leaderboard?.slice(0, 5).map((item, index) => {
                const style = getRankStyle(index);
                const user = item.user;
                const contributions = item.leaderboard.contributions;

                return (
                  <div
                    key={item.leaderboard.id}
                    className={`flex items-center gap-2.5 p-1.5 rounded-md ${style.card}`}
                  >
                    <div className='relative shrink-0'>
                      <Avatar className='h-7 w-7 border border-white/20 shadow-sm'>
                        <AvatarImage src={user?.image || '/logo.svg'} />
                        <AvatarFallback className='text-[10px] font-semibold'>
                          {user?.isAnonymous
                            ? 'A'
                            : user?.name
                              ? getInitials(user.name)
                              : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <Badge
                        className={`absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center rounded-full text-[8px] ${style.badge}`}
                      >
                        {style.icon}
                      </Badge>
                      {user?.favoriteFlag && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={`/flag/${encodeURIComponent(user.favoriteFlag.name)}`}
                              className='absolute -bottom-0.5 -left-0.5 w-4 h-3 rounded-sm border border-white/30 shadow-sm overflow-hidden bg-background hover:scale-110 transition-transform'
                            >
                              <Image
                                src={user.favoriteFlag.image}
                                alt={user.favoriteFlag.name}
                                fill
                                className='object-cover'
                              />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>
                            {user.favoriteFlag.name}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Link
                      href={`/profile/${user?.userNumber}`}
                      className='text-sm font-medium truncate hover:underline'
                    >
                      {user?.isAnonymous
                        ? 'Anonymous'
                        : user?.name || 'Unknown'}
                    </Link>
                    <span className='ml-auto text-xs font-bold tabular-nums text-muted-foreground'>
                      {contributions}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flag of the Day */}
      <Card className='md:w-64'>
        <CardHeader className='pb-0'>
          <CardTitle className='text-sm font-bold text-center'>
            Flag of the Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fotdLoading || !flagOfTheDay ? (
            <Skeleton className='aspect-[3/2] w-full rounded-md' />
          ) : (
            <div className='flex flex-col items-center gap-2'>
              <div className='relative w-full group'>
                <Link
                  href={`/flag/${encodeURIComponent(flagOfTheDay.flagName)}`}
                  className='relative aspect-[3/2] w-full rounded-md overflow-hidden border border-border hover:shadow-md transition-shadow block'
                >
                  <Image
                    src={flagOfTheDay.flagImage}
                    alt={flagOfTheDay.flagName}
                    fill
                    className='object-cover group-hover:scale-105 transition-transform duration-200'
                  />
                </Link>
                <Button
                  variant='neutral'
                  size='sm'
                  className='absolute top-2 right-2 z-10 bg-white/85 dark:bg-black/50 border border-white/40 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity'
                  onClick={handleFotdFavoriteToggle}
                  aria-label='Like flag of the day'
                >
                  <Heart
                    className={`w-4 h-4 ${isFotdFavorite ? 'fill-red-500 text-red-500' : 'text-foreground/70'}`}
                  />
                </Button>
              </div>
              <Link
                href={`/flag/${encodeURIComponent(flagOfTheDay.flagName)}`}
                className='text-sm font-semibold hover:underline text-center'
              >
                {flagOfTheDay.flagName}
              </Link>
              <Link
                href='/flag-of-the-day'
                className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
              >
                <History className='h-3 w-3' />
                Past flags
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
