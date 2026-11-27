'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { setFollow } from '@/actions/community';
import { Loader2, UserCheck, UserPlus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { openSignIn } from '@/lib/sign-in';

/** Follow / Following. `onChange` gets the new follower count. */
export default function FollowButton({
  userId,
  following: initial,
  size = 'default',
  onChange,
  className,
}: {
  userId: string;
  following: boolean;
  size?: 'default' | 'sm';
  onChange?: (followers: number) => void;
  className?: string;
}) {
  const { data: session } = useSession();
  const [following, setFollowing] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [hover, setHover] = React.useState(false);

  React.useEffect(() => setFollowing(initial), [initial]);

  if (session?.user?.id === userId) return null;

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!session?.user) {
      toast.error('Sign in to follow people.', { action: { label: 'Sign in', onClick: () => void openSignIn() } });
      return;
    }
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const result = await setFollow(userId, next);
      if (!result.success) {
        setFollowing(!next);
        toast.error(result.message);
        return;
      }
      onChange?.(result.followers);
    } catch {
      setFollowing(!next);
      toast.error('Couldn’t save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={following ? 'neutral' : 'default'}
      size={size}
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={className}
    >
      {busy ? <Loader2 className='animate-spin' /> : following ? <UserCheck /> : <UserPlus />}
      {following ? (hover ? 'Unfollow' : 'Following') : 'Follow'}
    </Button>
  );
}
