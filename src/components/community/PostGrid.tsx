'use client';

import React from 'react';
import { loadPosts, type FeedRequest } from '@/actions/community';
import { Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { PostCard as PostCardData } from '@/lib/posts';
import { cn } from '@/lib/utils';
import PostCard from './PostCard';

/**
 * A grid of posts that loads more as you reach the end. The first page comes from the server;
 * `request` says which list it is, so later pages match.
 */
export default function PostGrid({
  initial,
  hasMore: initialHasMore,
  request,
  showAuthor = true,
  empty,
  columns = 'four',
}: {
  initial: PostCardData[];
  hasMore: boolean;
  request?: FeedRequest;
  showAuthor?: boolean;
  empty?: React.ReactNode;
  columns?: 'three' | 'four';
}) {
  const [posts, setPosts] = React.useState(initial);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const sentinel = React.useRef<HTMLDivElement>(null);
  const key = JSON.stringify(request ?? null);

  React.useEffect(() => {
    setPosts(initial);
    setHasMore(initialHasMore);
    setFailed(false);
  }, [initial, initialHasMore, key]);

  const loadMore = React.useCallback(async () => {
    if (!request || loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadPosts({ ...request, offset: posts.length });
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !seen.has(post.id))];
      });
      setHasMore(page.hasMore);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [request, loading, hasMore, posts.length]);

  React.useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || failed) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '600px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, failed, loadMore]);

  if (posts.length === 0) return <>{empty ?? null}</>;

  return (
    <>
      <div
        className={cn(
          'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
          columns === 'four' && 'xl:grid-cols-4',
        )}
      >
        {posts.map((post) => (
          <PostCard key={post.id} post={post} showAuthor={showAuthor} />
        ))}
      </div>
      {request && hasMore && (
        <div ref={sentinel} className='mt-8 flex justify-center'>
          {failed ? (
            <Button variant='neutral' onClick={loadMore}>
              Load more
            </Button>
          ) : (
            <Loader2 className={cn('size-5 animate-spin text-muted-foreground', !loading && 'opacity-0')} />
          )}
        </div>
      )}
    </>
  );
}
