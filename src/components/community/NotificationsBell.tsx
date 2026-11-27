'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { getNotifications, getUnreadNotificationCount, markNotificationsRead, type NotificationGroup } from '@/actions/community';
import FlagImage from '@/components/FlagImage';
import { Bell, Heart, Loader2, Shuffle, UserPlus } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { profilePath } from '@/lib/post-slug';
import { cn } from '@/lib/utils';
import UserAvatar from './UserAvatar';

const ago = (date: Date) => {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** The bell in the header: likes, follows and remixes of your designs. */
export default function NotificationsBell({ className }: { className?: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const signedIn = !!session?.user;

  // Cheap count, checked now and then; the list only loads when the bell opens.
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: getUnreadNotificationCount,
    enabled: signedIn,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: getNotifications,
    enabled: signedIn && open,
    staleTime: 30_000,
  });

  if (!signedIn) return null;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && unread > 0) {
      queryClient.setQueryData(['notifications', 'unread'], 0);
      void markNotificationsRead().then(() => queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] }));
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
          className={cn(
            'relative flex size-[34px] items-center justify-center rounded-full text-subtle transition-colors hover:bg-foreground/[0.06] hover:text-foreground',
            className,
          )}
        >
          <Bell className='size-[19px]' />
          {unread > 0 && (
            <span className='absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1 text-[10.5px] font-semibold tabular-nums text-white'>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[min(380px,calc(100vw-2rem))] p-0'>
        <div className='flex items-center border-b border-line px-4 py-3'>
          <b className='text-[14px] font-semibold'>Notifications</b>
        </div>
        <div className='max-h-[min(460px,70vh)] overflow-y-auto'>
          {isLoading || !data ? (
            <div className='flex justify-center py-10 text-muted-foreground'>
              <Loader2 className='size-5 animate-spin' />
            </div>
          ) : data.groups.length === 0 ? (
            <p className='px-6 py-10 text-center text-[13.5px] text-subtle'>
              When people like, remix or follow you, it shows up here.
            </p>
          ) : (
            <ul className='divide-y divide-line'>
              {data.groups.map((group) => (
                <li key={group.key}>
                  <Item group={group} onNavigate={() => onOpenChange(false)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Item({ group, onNavigate }: { group: NotificationGroup; onNavigate: () => void }) {
  const [first] = group.actors;
  const others = group.total - 1;
  const who = (
    <>
      <b className='font-semibold'>{first?.username}</b>
      {others > 0 && (
        <>
          {' '}and {others.toLocaleString()} {others === 1 ? 'other' : 'others'}
        </>
      )}
    </>
  );
  const href = group.type === 'follow' && group.total === 1 && first ? profilePath(first.username) : group.post?.path ?? (first ? profilePath(first.username) : '#');
  const Icon = group.type === 'like' ? Heart : group.type === 'remix' ? Shuffle : UserPlus;

  return (
    <Link href={href} onClick={onNavigate} className={cn('flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.04]', group.unread && 'bg-[hsl(var(--primary)/0.06)]')}>
      <span className='relative shrink-0'>
        <UserAvatar username={first?.username ?? '?'} image={first?.image ?? null} className='size-9 text-sm' />
        <span
          className={cn(
            'absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full border-2 border-popover text-white',
            group.type === 'like' ? 'bg-rose-500' : group.type === 'remix' ? 'bg-violet-500' : 'bg-sky-500',
          )}
        >
          <Icon weight='fill' className='size-2.5' />
        </span>
      </span>
      <span className='min-w-0 flex-1 text-[13.5px] leading-snug'>
        {who}{' '}
        {group.type === 'like' && <>liked {group.post ? <b className='font-medium'>{group.post.name}</b> : 'your design'}</>}
        {group.type === 'remix' && <>remixed your design: {group.post ? <b className='font-medium'>{group.post.name}</b> : 'a new post'}</>}
        {group.type === 'follow' && 'followed you'}
        <span className='ml-1.5 text-[12px] text-muted-foreground'>{ago(group.at)}</span>
      </span>
      {group.post && group.type !== 'follow' && <FlagImage src={group.post.image} alt='' maxHeight={28} fixed />}
    </Link>
  );
}
