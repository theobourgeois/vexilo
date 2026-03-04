'use client';

import { Heart, Edit, Trash2, AlertTriangle, UserCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleFavoriteFlag, deleteFlag } from '@/actions/flags';
import { changeFavoriteFlag, getUserData } from '@/actions/users';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useSession } from 'next-auth/react';
import { ReportDialog } from '@/components/ReportDialog';
import { RelatedFlag } from '@/lib/types';
import { toastErrorWithLogin } from '@/lib/toast-auth';

type FlagActionsProps = {
  flag: {
    id: string;
    name: string;
    image: string;
    link: string;
    index: number;
    tags: string[];
    description: string;
    favorites?: number;
    isFavorite?: boolean;
    relatedFlags?: RelatedFlag[];
    sources: string[];
  };
};

export default function FlagActions({ flag }: FlagActionsProps) {
  const queryClient = useQueryClient();
  const session = useSession();
  const router = useRouter();
  const [isFavorite, setIsFavorite] = React.useState(flag.isFavorite || false);
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
    if (isFavorite) {
      setIsFavorite(false);
    } else {
      setIsFavorite(true);
    }
    toggleFavoriteFlag(flag.id).then((isSuccess) => {
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      if (!isSuccess) {
        setIsFavorite(false);
      }
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

  return (
    <div className='flex items-center gap-2 justify-center flex-wrap'>
      <Button
        variant='neutral'
        size='sm'
        onClick={handleFavoriteToggle}
        className='flex items-center gap-2'
      >
        <Heart
          className={`w-4 ${isFavorite ? 'fill-red-500' : 'text-gray-600'}`}
        />
        {isFavorite ? 'Favorited' : 'Favorite'}
      </Button>

      {session.data?.user && (
        <Button
          variant={isCurrentProfileFlag ? 'default' : 'neutral'}
          size='sm'
          onClick={handleSetProfileFlag}
          disabled={isSettingProfileFlag}
          className='flex items-center gap-2'
        >
          {isCurrentProfileFlag ? (
            <Check className='w-4 h-4' />
          ) : (
            <UserCircle className='w-4 h-4' />
          )}
          {isCurrentProfileFlag ? 'Your Profile Flag' : 'Set as Profile Flag'}
        </Button>
      )}

      <ReportDialog flagId={flag.id} flagName={flag.name}>
        <Button variant='neutral' size='sm' className='flex items-center gap-2'>
          <AlertTriangle className='w-4 h-4' />
          Report
        </Button>
      </ReportDialog>

      {session && (
        <Button
          variant='neutral'
          size='sm'
          onClick={handleEditClick}
          className='flex items-center gap-2 ml-2'
        >
          <Edit className='w-4 h-4' />
          Edit
        </Button>
      )}
      {session.data?.user?.isAdmin && (
        <Button
          variant='neutral'
          size='sm'
          onClick={handleDeleteClick}
          className='flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white border-red-50'
        >
          <Trash2 className='w-4 h-4' />
          Delete
        </Button>
      )}
    </div>
  );
}
