'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { setPostLike } from '@/actions/community';
import { Heart } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { openSignIn } from '@/lib/sign-in';
import { cn } from '@/lib/utils';

/** Liked state shared by every like button for the same post on the page (a card and its page header). */
const listeners = new Map<string, Set<(state: { liked: boolean; likes: number }) => void>>();

function broadcast(postId: string, state: { liked: boolean; likes: number }) {
  listeners.get(postId)?.forEach((listener) => listener(state));
}

function useLike(postId: string, initial: { liked: boolean; likes: number }) {
  const { data: session } = useSession();
  const [state, setState] = React.useState(initial);
  const busy = React.useRef(false);

  React.useEffect(() => setState(initial), [initial.liked, initial.likes]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const set = listeners.get(postId) ?? new Set();
    set.add(setState);
    listeners.set(postId, set);
    return () => {
      set.delete(setState);
    };
  }, [postId]);

  async function toggle(event?: React.MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!session?.user) {
      toast.error('Sign in to like flags.', { action: { label: 'Sign in', onClick: () => void openSignIn() } });
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const previous = state;
    const next = { liked: !state.liked, likes: Math.max(0, state.likes + (state.liked ? -1 : 1)) };
    broadcast(postId, next);
    try {
      const result = await setPostLike(postId, next.liked);
      if (!result.success) {
        broadcast(postId, previous);
        toast.error(result.message);
      } else broadcast(postId, { liked: result.liked, likes: result.likes });
    } catch {
      broadcast(postId, previous);
      toast.error('Couldn’t save that. Try again.');
    } finally {
      busy.current = false;
    }
  }

  return { ...state, toggle };
}

/** The small pill on cards. */
export function LikePill({ postId, liked, likes, className }: { postId: string; liked: boolean; likes: number; className?: string }) {
  const like = useLike(postId, { liked, likes });
  return (
    <button
      type='button'
      onClick={like.toggle}
      aria-pressed={like.liked}
      aria-label={like.liked ? 'Unlike' : 'Like'}
      className={cn(
        'vx-key inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full pl-2.5 pr-3 tabular-nums text-[13px] text-subtle hover:text-foreground',
        className,
      )}
    >
      <Heart weight={like.liked ? 'fill' : 'bold'} className={cn('size-[13px]', like.liked && 'text-main')} />
      {like.likes.toLocaleString()}
    </button>
  );
}

/** The big button on a post's page. */
export function LikeButton({ postId, liked, likes }: { postId: string; liked: boolean; likes: number }) {
  const like = useLike(postId, { liked, likes });
  return (
    <Button variant={like.liked ? 'default' : 'neutral'} onClick={like.toggle} aria-pressed={like.liked}>
      <Heart weight={like.liked ? 'fill' : 'bold'} />
      {like.liked ? 'Liked' : 'Like'}
      <span className='tabular-nums opacity-80'>· {like.likes.toLocaleString()}</span>
    </Button>
  );
}
