'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { loadPosts } from '@/actions/community';
import { ArrowRight, UsersThree } from '@/components/icons';
import { Button } from '@/components/ui/button';
import PostCard from './PostCard';

/** Under browse search results: community designs with the same name, so made-up flags are still a search away. */
export default function CommunityMatches({ query, className }: { query: string; className?: string }) {
  const search = query.trim().slice(0, 80);
  const { data } = useQuery({
    queryKey: ['community-matches', search],
    queryFn: () => loadPosts({ search, sort: 'popular', range: 'all' }),
    enabled: search.length >= 2,
    staleTime: 5 * 60_000,
  });
  const posts = data?.posts.slice(0, 4) ?? [];
  if (posts.length === 0) return null;

  return (
    <section className={className}>
      <div className='mb-4 flex flex-wrap items-center gap-2.5'>
        <UsersThree className='size-[18px] text-muted-foreground' />
        <h2 className='text-[17px] font-semibold tracking-[-0.02em]'>Community designs</h2>
        <span className='text-[13px] text-muted-foreground'>Made by people on Vexilo, not official flags</span>
        <span className='flex-1' />
        <Button variant='neutral' size='sm' asChild>
          <Link href={`/community?q=${encodeURIComponent(search)}&range=all`}>
            See all <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
