import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CreatorRow from '@/components/community/CreatorRow';
import UserAvatar from '@/components/community/UserAvatar';
import { ChevronRight } from '@/components/icons';
import { getServerAuthSession } from '@/lib/auth';
import { profilePath } from '@/lib/post-slug';
import { getProfile, listFollows } from '@/lib/posts';
import { cn } from '@/lib/utils';

export type FollowDirection = 'followers' | 'following';

export async function followListMetadata(username: string, direction: FollowDirection): Promise<Metadata> {
  const name = decodeURIComponent(username);
  return {
    title: `${direction === 'followers' ? 'Followers of' : 'People followed by'} @${name} | Vexilo`,
    robots: { index: false, follow: true },
  };
}

/** Who follows someone, or whom they follow. */
export default async function FollowList({ username, direction }: { username: string; direction: FollowDirection }) {
  const session = await getServerAuthSession();
  const viewerId = session?.user?.id ?? null;
  const profile = await getProfile(decodeURIComponent(username), viewerId);
  if (!profile) notFound();
  const people = await listFollows(profile.id, direction, viewerId, 200);
  const base = profilePath(profile.username);

  return (
    <div className='mx-auto max-w-[640px] px-4 pb-16 pt-8 md:px-8'>
      <Link href={base} className='flex items-center gap-3'>
        <UserAvatar username={profile.username} image={profile.image} className='size-11 text-base' />
        <span>
          <b className='block text-[17px] font-semibold'>@{profile.username}</b>
          <span className='flex items-center gap-1 text-[13px] text-muted-foreground'>
            Back to profile <ChevronRight className='size-3' />
          </span>
        </span>
      </Link>
      <nav className='mt-6 flex border-b border-line'>
        {(
          [
            ['followers', 'Followers', profile.stats.followers],
            ['following', 'Following', profile.stats.following],
          ] as const
        ).map(([key, label, n]) => (
          <Link
            key={key}
            href={`${base}/${key}`}
            aria-current={direction === key ? 'page' : undefined}
            className={cn(
              '-mb-px flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-[14px] font-medium',
              direction === key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label} <span className='tabular-nums text-[12px] text-muted-foreground'>{n.toLocaleString()}</span>
          </Link>
        ))}
      </nav>
      {people.length === 0 ? (
        <p className='py-12 text-center text-[14px] text-subtle'>
          {direction === 'followers'
            ? profile.isMe
              ? 'Nobody follows you yet. Post a design and people can find you.'
              : `Nobody follows @${profile.username} yet.`
            : profile.isMe
              ? 'You don’t follow anyone yet. Their new designs show up in your Following feed.'
              : `@${profile.username} doesn’t follow anyone yet.`}
        </p>
      ) : (
        <div className='divide-y divide-line'>
          {people.map((person) => (
            <CreatorRow key={person.id} person={person} detail={person.bio || undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
