'use client';

import { Heart, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleFavoriteFlag, deleteFlag } from '@/actions/flags';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useSession } from 'next-auth/react';
import { ReportDialog } from '@/components/ReportDialog';
import { RelatedFlag } from '@/lib/types';

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

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session.data?.user) {
      toast.error('You must be logged in to favorite a flag');
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

  const handleEditClick = (e: React.MouseEvent) => {
    if (!session.data?.user) {
      toast.error('You must be logged in to edit a flag');
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
    <div className='flex items-center gap-2 justify-center'>
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
