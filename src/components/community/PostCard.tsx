'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FlagImage from '@/components/FlagImage';
import { Shuffle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { PostCard as PostCardData } from '@/lib/posts';
import { profilePath } from '@/lib/post-slug';
import { LikePill } from './LikeButton';
import UserAvatar from './UserAvatar';

/** A post in a grid: the flag, its title, who made it and its likes. */
export default function PostCard({ post, showAuthor = true }: { post: PostCardData; showAuthor?: boolean }) {
  const router = useRouter();
  return (
    <article
      className='vx-tile group relative flex h-full cursor-pointer flex-col overflow-hidden transition-shadow duration-200 hover:shadow-tile-hover'
      onClick={() => router.push(post.path)}
    >
      <div className='absolute right-2.5 top-2.5 z-10 flex gap-1.5 transition-[opacity,transform] duration-200 sm:-translate-y-0.5 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100'>
        <Button
          variant='neutral'
          size='icon-sm'
          title='Remix'
          aria-label={`Remix ${post.name}`}
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/create?remixPost=${post.id}`);
          }}
        >
          <Shuffle />
        </Button>
      </div>

      <div className='flag-stage bg-stage relative h-[228px] px-6 py-7'>
        {post.remixOf && (
          <span
            className='absolute left-2.5 top-2.5 z-[1] inline-flex h-6 max-w-[70%] items-center gap-1 truncate rounded-full bg-surface/90 px-2.5 text-[11.5px] font-medium text-subtle shadow-tile'
            title={`Remix of ${post.remixOf.name}`}
          >
            <Shuffle className='size-3 shrink-0' />
            <span className='truncate'>{post.remixOf.name}</span>
          </span>
        )}
        <FlagImage src={post.image} alt={post.name} maxHeight={180} area={250 * 166} />
      </div>

      <div className='flex items-center gap-2.5 py-3 pl-4 pr-3.5'>
        <div className='min-w-0 flex-1'>
          <h3 className='truncate text-[15px] font-medium'>
            <Link href={post.path} onClick={(event) => event.stopPropagation()}>
              {post.name}
            </Link>
          </h3>
          {showAuthor ? (
            <Link
              href={profilePath(post.author.username)}
              onClick={(event) => event.stopPropagation()}
              className='mt-1 flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground'
            >
              <UserAvatar username={post.author.username} image={post.author.image} className='size-[18px] text-[9px]' />
              <span className='truncate'>@{post.author.username}</span>
            </Link>
          ) : (
            <p className='mt-0.5 text-[11.5px] text-muted-foreground'>
              {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        <LikePill postId={post.id} liked={post.liked} likes={post.likes} />
      </div>
    </article>
  );
}

export function PostGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className='vx-tile h-[300px] animate-pulse' />
      ))}
    </div>
  );
}
