'use client';

import { Heart, Edit, UserCircle, Check, Shuffle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Flag } from '@/lib/types';
import { useSession } from 'next-auth/react';
import React from 'react';
import Link from 'next/link';
import { toggleFavoriteFlag } from '@/actions/flags';
import { changeFavoriteFlag, getUserData } from '@/actions/users';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import FlagFieldsForm from '@/components/FlagFieldsForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toastErrorWithLogin } from '@/lib/toast-auth';
import FlagImage from '@/components/FlagImage';
import { cn } from '@/lib/utils';
import { useHydrated } from '@/hooks/useHydrated';
import { MakerBadge } from '@/components/MakerBadge';

type FlagCardProps = Flag & {
  /** The visitor's own favorites are still loading (see useLiveFavorites), so the heart waits. */
  favoritesPending?: boolean;
};

export default function FlagCard({
  id,
  flagName,
  flagImage,
  favorites,
  isFavorite: savedFavorite = false,
  favoritesPending,
  link,
  index,
  tags,
  description,
  relatedFlags,
  sources,
}: FlagCardProps) {
  const { data: session } = useSession();
  // Signed-in controls wait for hydration: the server renders every card signed out.
  const showUserControls = useHydrated() && Boolean(session?.user);
  const queryClient = useQueryClient();
  // What the visitor picked on this card; null until they toggle. The heart and the count are
  // worked out from the props, which can arrive after the card does.
  const [favoriteChoice, setFavoriteChoice] = React.useState<boolean | null>(null);
  const isFavorite = favoriteChoice ?? savedFavorite;
  const favoriteCount = Math.max(0, (favorites ?? 0) + (isFavorite === savedFavorite ? 0 : isFavorite ? 1 : -1));
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSettingProfileFlag, setIsSettingProfileFlag] = React.useState(false);
  const router = useRouter();

  const { data: userData } = useQuery({
    queryKey: ['userData'],
    queryFn: getUserData,
    enabled: !!session?.user,
  });

  const isCurrentProfileFlag = userData?.user?.favoriteFlag?.id === id;

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) {
      toastErrorWithLogin('You must be logged in to favorite a flag');
      return;
    }
    if (favoritesPending) return;
    const previousChoice = favoriteChoice;
    setFavoriteChoice(!isFavorite);
    toggleFavoriteFlag(id, true).then((isSuccess) => {
      if (!isSuccess) {
        setFavoriteChoice(previousChoice);
        return;
      }
      // Mark lists stale without refetching the one on screen, so the grid doesn't
      // reorder under the cursor. The new order shows on the next visit or refresh.
      queryClient.invalidateQueries({ queryKey: ['flags'], refetchType: 'none' });
    });
  };

  const handleSetProfileFlag = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) {
      toastErrorWithLogin('You must be logged in to set a profile flag');
      return;
    }

    setIsSettingProfileFlag(true);
    try {
      const result = await changeFavoriteFlag(isCurrentProfileFlag ? null : id);
      queryClient.invalidateQueries({ queryKey: ['userData'] });
      if (result.success) {
        toast.success(
          isCurrentProfileFlag
            ? 'Profile flag removed'
            : 'Profile flag updated!',
        );
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
    if (!session?.user) {
      toastErrorWithLogin('You must be logged in to edit a flag');
      return;
    }
    e.stopPropagation();
    setIsDialogOpen(true);
  };

  const handleCardClick = () => {
    router.push(`/flag/${encodeURIComponent(flagName)}`);
  };

  const card = (
    <article
      className='vx-tile group relative flex h-full cursor-pointer flex-col overflow-hidden transition-shadow duration-200 hover:shadow-tile-hover'
      onClick={handleCardClick}
    >
      <div className='absolute right-2.5 top-2.5 z-10 flex gap-1.5 transition-[opacity,transform] duration-200 sm:-translate-y-0.5 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100'>
        <Button
          variant='neutral'
          size='icon-sm'
          title='Remix'
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/create?remix=${id}`);
          }}
        >
          <Shuffle />
        </Button>
        {showUserControls && (
          <>
            <Button
              variant='neutral'
              size='icon-sm'
              onClick={handleSetProfileFlag}
              disabled={isSettingProfileFlag}
              title={isCurrentProfileFlag ? 'Your profile flag' : 'Set as profile flag'}
              className={cn(isCurrentProfileFlag && 'text-main')}
            >
              {isCurrentProfileFlag ? <Check /> : <UserCircle />}
            </Button>
            <Button variant='neutral' size='icon-sm' onClick={handleEditClick} title='Edit'>
              <Edit />
            </Button>
          </>
        )}
      </div>

      <div className='flag-stage bg-stage relative h-[228px] px-6 py-7'>
        <MakerBadge tags={tags} className='absolute left-2.5 top-2.5 z-[1]' />
        <FlagImage src={flagImage} alt={flagName} maxHeight={180} area={250 * 166} />
      </div>

      <div className='flex items-center gap-2.5 py-3.5 pl-4 pr-3.5'>
        <div className='min-w-0 flex-1'>
          <h3 className='truncate text-[15px] font-medium'>
            {/* A real link so search engines can follow cards; the card's own click handles the rest. */}
            <Link href={`/flag/${encodeURIComponent(flagName)}`} onClick={(e) => e.stopPropagation()}>
              {flagName}
            </Link>
          </h3>
          <p className='mt-0.5 truncate tabular-nums text-[11.5px] text-muted-foreground'>
            #{String(index).padStart(4, '0')}
            {tags?.[0] ? ` · ${tags[0]}` : ''}
          </p>
        </div>
        <button
          type='button'
          onClick={handleFavoriteToggle}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className='vx-key inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full pl-2.5 pr-3 tabular-nums text-[13px] text-subtle hover:text-foreground'
        >
          <Heart weight={isFavorite ? 'fill' : 'bold'} className={cn('size-[13px]', isFavorite && 'text-main')} />
          {favoriteCount}
        </button>
      </div>
    </article>
  );

  return (
    <>
      {card}

      {/* Edit Dialog */}
      {showUserControls && (
        <Dialog
          open={isDialogOpen}
          onOpenChange={(val) => {
            if (session?.user) {
              setIsDialogOpen(val);
            }
          }}
        >
          <DialogContent className='max-w-[60vw]! h-11/12 overflow-y-auto'>
            <FlagFieldsForm
              initialFlag={{
                id,
                flagName,
                flagImage,
                link,
                sources: sources ?? [],
                index,
                tags,
                description,
                relatedFlags,
              }}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
