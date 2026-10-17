'use client';

import {
  getUserFlags,
  getUserContributionCounts,
  getProfileUserFavorites,
  getUserEditedFlags,
} from '@/actions/flags';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import FlagCard from '@/components/FlagCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import FlagImage from '@/components/FlagImage';
import { ArrowLeft, ArrowRight, Edit, Flag, Heart, Link as LinkIcon, Settings } from '@/components/icons';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { getUserByUserNumber } from '@/actions/users';
import { useCallback } from 'react';

type ViewMode = 'contributed' | 'favorites' | 'edited';

export default function ProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const userNumber = params.userNumber as string;
  const page = parseInt(searchParams.get('page') || '1');
  const router = useRouter();

  // Support both old 'favorites' param and new 'view' param for backwards compatibility
  const viewParam = searchParams.get('view') as ViewMode | null;
  const isFavoritesLegacy = searchParams.get('favorites') === 'true';
  const viewMode: ViewMode =
    viewParam || (isFavoritesLegacy ? 'favorites' : 'contributed');

  const {
    data: userData,
    isLoading: userLoading,
    error: userError,
  } = useQuery({
    queryKey: ['user', userNumber],
    queryFn: () => getUserByUserNumber(userNumber),
  });

  const {
    data: userFlagsData,
    isLoading: requestsLoading,
    error: requestsError,
  } = useQuery({
    queryKey: ['flags', userNumber, page, viewMode],
    queryFn: async () => {
      let fetchFn;
      switch (viewMode) {
        case 'favorites':
          fetchFn = getProfileUserFavorites;
          break;
        case 'edited':
          fetchFn = getUserEditedFlags;
          break;
        default:
          fetchFn = getUserFlags;
      }
      const result = await fetchFn(userNumber, page);

      // Handle error responses
      if (
        result &&
        typeof result === 'object' &&
        'success' in result &&
        !result.success
      ) {
        throw new Error(result.message || 'Failed to fetch flags');
      }

      return result;
    },
  });

  const userFlags = userFlagsData?.flags;
  const totalFlagsCount = userFlagsData?.count || 0;

  const { data: userContributionCounts, isLoading: contributionCountsLoading } =
    useQuery({
      queryKey: ['contributionCounts', userNumber],
      queryFn: () => getUserContributionCounts(userNumber),
    });

  const totalContributionsCount = userContributionCounts?.totalFlagCount || 0;
  const totalEditCount = userContributionCounts?.totalEditCount || 0;

  const handleViewModeChange = useCallback(
    (newViewMode: ViewMode) => {
      const params = new URLSearchParams(searchParams);
      // Remove legacy 'favorites' param
      params.delete('favorites');
      if (newViewMode === 'contributed') {
        params.delete('view');
      } else {
        params.set('view', newViewMode);
      }
      // Reset to first page when switching modes
      params.set('page', '1');
      router.replace(`/profile/${userNumber}?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams, userNumber],
  );

  const { data: session } = useSession();

  const message = (emoji: React.ReactNode, title: string, body?: string) => (
    <div className='mx-auto max-w-[1312px] px-4 pt-10 md:px-8'>
      <div className='vx-tile flex flex-col items-center gap-3 px-6 py-16 text-center'>
        <div className='text-muted-foreground'>{emoji}</div>
        <h2 className='text-lg font-semibold'>{title}</h2>
        {body && <p className='text-sm text-muted-foreground'>{body}</p>}
        <Button variant='neutral' asChild className='mt-2'>
          <Link href='/'>Back to browse</Link>
        </Button>
      </div>
    </div>
  );

  if (userError || requestsError) {
    return message(<Flag className='size-8' />, 'Something went wrong');
  }

  if (!userLoading && !userData?.user) {
    return message(<Flag className='size-8' />, 'User not found', "This user doesn't exist or their profile is private.");
  }

  const user = userData?.user;
  const isOwnProfile = !!session?.user && !!user && session.user.id === user.id;
  const totalPages = Math.ceil((totalFlagsCount || 0) / 12);

  const handlePageChange = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', nextPage.toString());
    router.replace(`/profile/${userNumber}?${params.toString()}`, { scroll: false });
  };

  const pagination =
    totalPages > 1 ? (
      <div className='mt-7 flex items-center justify-center gap-3'>
        <Button variant='neutral' size='icon' disabled={page === 1} onClick={() => handlePageChange(page - 1)} aria-label='Previous page'>
          <ArrowLeft />
        </Button>
        <span className='min-w-24 text-center tabular-nums text-xs text-muted-foreground'>
          {page} / {totalPages}
        </span>
        <Button variant='neutral' size='icon' disabled={page === totalPages} onClick={() => handlePageChange(page + 1)} aria-label='Next page'>
          <ArrowRight />
        </Button>
      </div>
    ) : null;

  const stats: [string, React.ReactNode][] = [
    ['Flags contributed', contributionCountsLoading ? '…' : totalContributionsCount.toLocaleString()],
    ['Edits', contributionCountsLoading ? '…' : totalEditCount.toLocaleString()],
    [
      'Member since',
      user ? new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '…',
    ],
  ];

  return (
    <div className='mx-auto max-w-[1312px] px-4 md:px-8'>
      <section className='vx-tile mt-7 grid overflow-hidden md:grid-cols-[400px_1fr]'>
        <div className='bg-stage relative h-[220px] border-b border-line [container-type:size] md:h-auto md:min-h-[260px] md:border-b-0 md:border-r'>
          {user?.favoriteFlag ? (
            <Link
              href={`/flag/${encodeURIComponent(user.favoriteFlag.name)}`}
              className='flag-stage absolute inset-0 p-8'
              title={user.favoriteFlag.name}
            >
              <FlagImage src={user.favoriteFlag.image} alt={user.favoriteFlag.name} maxHeight={170} area={280 * 170} />
            </Link>
          ) : (
            <div className='absolute inset-0 grid place-items-center text-sm text-muted-foreground'>
              {isOwnProfile ? (
                <Button variant='neutral' asChild>
                  <Link href='/settings'>
                    <Flag />
                    Choose a profile flag
                  </Link>
                </Button>
              ) : (
                'No profile flag yet'
              )}
            </div>
          )}
          {user?.favoriteFlag && <span className='vx-label absolute right-3.5 top-3.5'>Profile flag</span>}
        </div>

        <div className='flex flex-col p-6 sm:p-7'>
          {userLoading || !user ? (
            <div className='flex items-center gap-4'>
              <div className='size-16 animate-pulse rounded-full bg-foreground/[0.06]' />
              <div className='space-y-2'>
                <div className='h-6 w-40 animate-pulse rounded bg-foreground/[0.06]' />
                <div className='h-4 w-24 animate-pulse rounded bg-foreground/[0.06]' />
              </div>
            </div>
          ) : (
            <div className='flex flex-wrap items-center gap-4'>
              <Avatar className='size-16 text-xl'>
                <AvatarImage src={user.image || ''} alt={user.name || 'User'} />
                <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
              </Avatar>
              <div className='min-w-0 flex-1'>
                <h1 className='truncate text-[26px] font-semibold tracking-[-0.035em]'>{user.name || 'Anonymous user'}</h1>
                {user.favoriteFlag && (
                  <p className='truncate text-[13px] text-muted-foreground'>Flies {user.favoriteFlag.name}</p>
                )}
              </div>
              <div className='flex gap-2 self-start'>
                {isOwnProfile && (
                  <Button variant='neutral' asChild>
                    <Link href='/settings'>
                      <Settings />
                      Settings
                    </Link>
                  </Button>
                )}
                <Button
                  variant='neutral'
                  size='icon-sm'
                  title='Copy profile link'
                  onClick={async () => {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success('Profile link copied');
                  }}
                >
                  <LinkIcon />
                </Button>
              </div>
            </div>
          )}
          <div className='mt-auto grid grid-cols-3 gap-2.5 pt-6'>
            {stats.map(([label, value]) => (
              <div key={label} className='vx-well rounded-[14px] px-4 py-3.5'>
                <b className='block tabular-nums text-[22px] font-semibold leading-tight tracking-[-0.03em]'>{value}</b>
                <span className='text-[12.5px] text-muted-foreground'>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className='mb-4 mt-9 flex flex-wrap items-center gap-3'>
        <Segmented
          aria-label='Collection'
          value={viewMode}
          onChange={handleViewModeChange}
          options={[
            {
              value: 'contributed',
              icon: <Flag />,
              label: (
                <>
                  Contributed <span className='tabular-nums text-[11px] text-muted-foreground'>{totalContributionsCount}</span>
                </>
              ),
            },
            {
              value: 'edited',
              icon: <Edit />,
              label: (
                <>
                  Edited <span className='tabular-nums text-[11px] text-muted-foreground'>{totalEditCount}</span>
                </>
              ),
            },
            { value: 'favorites', icon: <Heart />, label: 'Favorites' },
          ]}
        />
      </div>

      {requestsLoading ? (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className='vx-tile h-[292px] animate-pulse' />
          ))}
        </div>
      ) : Array.isArray(userFlags) && userFlags.length === 0 ? (
        <div className='vx-tile px-6 py-14 text-center'>
          <p className='font-medium'>Nothing here yet</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            {viewMode === 'favorites'
              ? "This user hasn't favorited any flags yet."
              : viewMode === 'edited'
                ? "This user hasn't edited any flags yet."
                : "This user hasn't contributed any flags yet."}
          </p>
        </div>
      ) : userFlags && Array.isArray(userFlags) ? (
        <>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {userFlags.map((flag, index) => {
              const flagName = 'flagName' in flag ? flag.flagName : flag.name;
              const flagImage = 'flagImage' in flag ? flag.flagImage : flag.image;
              return (
                <FlagCard
                  key={`${flagName}-${index}`}
                  id={flag.id}
                  sources={[]}
                  flagName={flagName}
                  flagImage={flagImage}
                  link={flag.link}
                  index={flag.index}
                  tags={flag.tags || []}
                  description={flag.description || ''}
                  favorites={flag.favorites}
                  isFavorite={flag.isFavorite}
                />
              );
            })}
          </div>
          {pagination}
        </>
      ) : null}
    </div>
  );
}
