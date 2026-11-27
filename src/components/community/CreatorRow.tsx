'use client';

import Link from 'next/link';
import { profilePath } from '@/lib/post-slug';
import FollowButton from './FollowButton';
import UserAvatar from './UserAvatar';

/** A person in a list: picture, username, a line about them, and Follow. */
export default function CreatorRow({
  person,
  detail,
}: {
  person: { id: string; username: string; image: string | null; following: boolean };
  detail?: string;
}) {
  return (
    <div className='flex items-center gap-3 py-2'>
      <Link href={profilePath(person.username)} className='flex min-w-0 flex-1 items-center gap-2.5'>
        <UserAvatar username={person.username} image={person.image} className='size-9 text-sm' />
        <span className='min-w-0'>
          <b className='block truncate text-[13.5px] font-semibold'>{person.username}</b>
          {detail && <span className='block truncate text-[12px] text-muted-foreground'>{detail}</span>}
        </span>
      </Link>
      <FollowButton userId={person.id} following={person.following} size='sm' />
    </div>
  );
}
