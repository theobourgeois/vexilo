'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { getFullLeaderboard } from '@/actions/leaderboard';
import { getUserData } from '@/actions/users';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import FlagImage from '@/components/FlagImage';
import { cn } from '@/lib/utils';

type Entry = Awaited<ReturnType<typeof getFullLeaderboard>>[number];

const MEDALS = [
  'text-[#3B2A00] bg-[radial-gradient(circle_at_35%_30%,#FFF4C2,#F2C94C_55%,#C8971A)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_0_0_1px_rgb(120_85_0/0.35),0_2px_4px_rgb(0_0_0/0.15)]',
  'text-[#2E3135] bg-[radial-gradient(circle_at_35%_30%,#FFFFFF,#CDD1D6_55%,#9AA0A7)] shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_0_0_1px_rgb(60_65_70/0.3),0_2px_4px_rgb(0_0_0/0.15)]',
  'text-[#3A1E08] bg-[radial-gradient(circle_at_35%_30%,#FFE0C2,#D9935A_55%,#A9622A)] shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_0_0_1px_rgb(110_55_15/0.35),0_2px_4px_rgb(0_0_0/0.15)]',
];

const initials = (name?: string | null) =>
  (name || 'U')
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

function UserAvatar({ user, className }: { user: Entry['user']; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={user?.image || ''} alt={user?.name || ''} />
      <AvatarFallback>{initials(user?.name)}</AvatarFallback>
    </Avatar>
  );
}

function PodiumCard({ entry, rank }: { entry: Entry; rank: number }) {
  const { user } = entry;
  const flag = user?.favoriteFlag;

  return (
    <Link
      href={`/profile/${user?.userNumber}`}
      className='vx-tile flex flex-col overflow-hidden transition-[transform,box-shadow] duration-300 hover:shadow-tile-hover'
    >
      <div className='bg-stage relative h-[190px] border-b border-line [container-type:size]'>
        <span className={cn('absolute right-3.5 top-3.5 grid size-[30px] place-items-center rounded-full tabular-nums text-[13px] font-semibold', MEDALS[rank])}>
          {rank + 1}
        </span>
        {flag ? (
          <div className='flag-stage absolute inset-0 px-8 pb-7 pt-10'>
            <FlagImage src={flag.image} alt={flag.name} maxHeight={130} area={200 * 130} />
          </div>
        ) : (
          <div className='absolute inset-0 grid place-items-center'>
            <UserAvatar user={user} className='size-20 text-xl' />
          </div>
        )}
      </div>
      <div className='flex items-center gap-3 px-[18px] pb-[18px] pt-4'>
        <UserAvatar user={user} className='size-10' />
        <div className='min-w-0 flex-1'>
          <b className='block truncate text-[15px] font-semibold tracking-[-0.015em]'>{user?.name}</b>
          <span className='block truncate tabular-nums text-xs text-muted-foreground'>{flag?.name ?? 'No profile flag'}</span>
        </div>
        <div className='text-right'>
          <b className='block tabular-nums text-xl font-semibold leading-none tracking-[-0.02em]'>
            {entry.leaderboard.contributions.toLocaleString()}
          </b>
          <span className='tabular-nums text-[11px] text-muted-foreground'>flags</span>
        </div>
      </div>
    </Link>
  );
}

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['fullLeaderboard'],
    queryFn: getFullLeaderboard,
  });
  const { data: me } = useQuery({
    queryKey: ['userData'],
    queryFn: getUserData,
    enabled: !!session?.user,
  });

  const podium = leaderboard?.slice(0, 3) ?? [];
  const rest = leaderboard?.slice(3) ?? [];
  const top = rest[0]?.leaderboard.contributions || 1;
  const myNumber = me?.user?.userNumber;

  return (
    <div className='mx-auto max-w-[1040px] px-4 md:px-8'>
      <div className='pb-[18px] pt-7'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Leaderboard</h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>Top contributors by approved flags and edits.</p>
      </div>

      {isLoading ? (
        <div className='grid gap-4 md:grid-cols-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='vx-tile h-[262px] animate-pulse' />
          ))}
        </div>
      ) : !leaderboard?.length ? (
        <div className='vx-tile px-6 py-16 text-center text-muted-foreground'>No contributors yet. Post the first flag.</div>
      ) : (
        <>
          <div className='grid gap-4 md:grid-cols-3'>
            {podium.map((entry, i) => (
              <PodiumCard key={entry.leaderboard.id} entry={entry} rank={i} />
            ))}
          </div>

          {rest.length > 0 && (
            <div className='vx-tile mt-4 p-1.5'>
              <div className='vx-label grid h-[38px] grid-cols-[40px_1fr_90px] items-center gap-3 px-3.5 sm:grid-cols-[52px_1fr_120px_160px]'>
                <span>#</span>
                <span>Contributor</span>
                <span className='hidden sm:block'>Profile flag</span>
                <span className='text-right'>Flags</span>
              </div>
              {rest.map((entry, i) => {
                const { user } = entry;
                const isMe = !!myNumber && user?.userNumber === myNumber;
                const count = entry.leaderboard.contributions;
                return (
                  <Link
                    key={entry.leaderboard.id}
                    href={`/profile/${user?.userNumber}`}
                    className={cn(
                      'grid h-[60px] grid-cols-[40px_1fr_90px] items-center gap-3 rounded-xl px-3.5 shadow-[0_-1px_0_var(--line)] transition-colors hover:bg-foreground/[0.03] sm:grid-cols-[52px_1fr_120px_160px]',
                      isMe && 'bg-main-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--main)_30%,transparent)] hover:bg-main-soft',
                    )}
                  >
                    <span className='tabular-nums text-[13px] font-medium text-muted-foreground'>
                      {String(i + 4).padStart(2, '0')}
                    </span>
                    <span className='flex min-w-0 items-center gap-3 font-medium'>
                      <UserAvatar user={user} className='size-8' />
                      <span className='truncate'>{user?.name}</span>
                      {isMe && (
                        <span className='rounded-md bg-main-soft px-1.5 py-1 tabular-nums text-xs font-medium text-main'>
                          You
                        </span>
                      )}
                    </span>
                    <span className='hidden items-center sm:flex'>
                      {user?.favoriteFlag && (
                        <FlagImage src={user.favoriteFlag.image} alt={user.favoriteFlag.name} maxHeight={24} fixed />
                      )}
                    </span>
                    <span className='flex items-center gap-2.5'>
                      <span className='vx-well hidden h-1.5 flex-1 overflow-hidden rounded-full sm:block'>
                        <i
                          className={cn('block h-full rounded-full', isMe ? 'bg-main' : 'bg-subtle/55')}
                          style={{ width: `${Math.max(4, (count / top) * 100)}%` }}
                        />
                      </span>
                      <span className='w-full text-right tabular-nums text-[13px] font-medium sm:w-10'>
                        {count.toLocaleString()}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
