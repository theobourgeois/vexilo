'use client';

import { Heart, Edit, Trash2, AlertTriangle, UserCircle, Check, Shuffle } from '@/components/icons';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toggleFavoriteFlag, deleteFlag } from '@/actions/flags';
import { changeFavoriteFlag, getUserData } from '@/actions/users';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useSession } from 'next-auth/react';
import { ReportDialog } from '@/components/ReportDialog';
import { toastErrorWithLogin } from '@/lib/toast-auth';
import { useLiveFavorites } from '@/hooks/useLiveFavorites';

type FlagActionsProps = {
  /** `favorites` is the cached count every visitor gets; the live one comes from the browser. */
  flag: { id: string; name: string; favorites: number };
};

export default function FlagActions({ flag }: FlagActionsProps) {
  const queryClient = useQueryClient();
  const session = useSession();
  const router = useRouter();
  const { live, pending: favoritePending } = useLiveFavorites([flag.id]);
  const liveFavorite = live?.get(flag.id);
  const savedFavorite = liveFavorite?.isFavorite ?? false;
  // What the visitor picked on this page; null until they toggle.
  const [favoriteChoice, setFavoriteChoice] = React.useState<boolean | null>(null);
  const isFavorite = favoriteChoice ?? savedFavorite;
  const [isSettingProfileFlag, setIsSettingProfileFlag] = React.useState(false);

  const { data: userData } = useQuery({
    queryKey: ['userData'],
    queryFn: getUserData,
    enabled: !!session.data?.user,
  });

  const isCurrentProfileFlag = userData?.user?.favoriteFlag?.id === flag.id;

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session.data?.user) {
      toastErrorWithLogin('You must be logged in to favorite a flag');
      return;
    }
    // Toggling flips whatever is saved, so wait until we know what that is.
    if (favoritePending) return;
    const previousChoice = favoriteChoice;
    setFavoriteChoice(!isFavorite);
    toggleFavoriteFlag(flag.id).then((isSuccess) => {
      if (!isSuccess) {
        setFavoriteChoice(previousChoice);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['flags'], refetchType: 'none' });
    });
  };

  const handleSetProfileFlag = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session.data?.user) {
      toastErrorWithLogin('You must be logged in to set a profile flag');
      return;
    }

    setIsSettingProfileFlag(true);
    try {
      const result = await changeFavoriteFlag(isCurrentProfileFlag ? null : flag.id);
      queryClient.invalidateQueries({ queryKey: ['userData'] });
      if (result.success) {
        toast.success(isCurrentProfileFlag ? 'Profile flag removed' : 'Profile flag updated!');
      } else {
        toastErrorWithLogin(result.message);
      }
    } catch {
      toast.error('Failed to update profile flag');
    } finally {
      setIsSettingProfileFlag(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    if (!session.data?.user) {
      toastErrorWithLogin('You must be logged in to edit a flag');
      return;
    }
    // add mode to the url
    router.push(`/flag/${encodeURIComponent(flag.name)}?mode=edit`, {
      scroll: false,
    });
    e.stopPropagation();
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session.data?.user?.isAdmin) {
      toast.error('You must be an admin to delete flags');
      return;
    }

    const isSuccess = await deleteFlag(flag.id);
    if (isSuccess) {
      toast.success('Flag deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      router.push('/');
    } else {
      toast.error('Failed to delete flag');
    }
  };

  const favoriteCount = Math.max(
    0,
    (liveFavorite?.favorites ?? flag.favorites) + (isFavorite === savedFavorite ? 0 : isFavorite ? 1 : -1),
  );

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Button
        variant={isFavorite ? 'default' : 'neutral'}
        onClick={handleFavoriteToggle}
        aria-pressed={isFavorite}
      >
        <Heart weight={isFavorite ? 'fill' : 'bold'} />
        {isFavorite ? 'Favorited' : 'Favorite'}
        <span className='tabular-nums text-xs opacity-75'>{favoriteCount}</span>
      </Button>
      <Button variant='neutral' onClick={handleEditClick}>
        <Edit />
        Suggest edit
      </Button>
      <Button variant='neutral' asChild>
        <Link href={`/create?remix=${flag.id}`}>
          <Shuffle />
          Remix
        </Link>
      </Button>
      <span className='flex-1' />
      {session.data?.user && (
        <Button
          variant='neutral'
          size='icon'
          onClick={handleSetProfileFlag}
          disabled={isSettingProfileFlag}
          title={isCurrentProfileFlag ? 'Your profile flag' : 'Set as profile flag'}
          className={isCurrentProfileFlag ? 'text-main' : undefined}
        >
          {isCurrentProfileFlag ? <Check /> : <UserCircle />}
        </Button>
      )}
      <ReportDialog flagId={flag.id} flagName={flag.name}>
        <Button variant='neutral' size='icon' title='Report'>
          <AlertTriangle />
        </Button>
      </ReportDialog>
      {session.data?.user?.isAdmin && (
        <Button variant='danger' size='icon' onClick={handleDeleteClick} title='Delete flag'>
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
