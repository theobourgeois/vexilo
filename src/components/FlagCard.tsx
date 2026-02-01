'use client';

import Image from 'next/image';
import { Heart, Edit, UserCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Flag } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';
import React from 'react';
import { toggleFavoriteFlag } from '@/actions/flags';
import { changeFavoriteFlag, getUserData } from '@/actions/users';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import FlagFieldsForm from '@/components/FlagFieldsForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type FlagCardProps = Flag;

export default function FlagCard({
  id,
  flagName,
  flagImage,
  favorites,
  isFavorite: initialIsFavorite,
  link,
  index,
  tags,
  description,
  relatedFlags,
}: FlagCardProps) {
  const { data: session } = useSession();
  const [favoriteCount, setFavoriteCount] = React.useState(favorites || 0);
  const queryClient = useQueryClient();
  const [isFavorite, setIsFavorite] = React.useState(
    initialIsFavorite || false,
  );
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
      toast.error('You must be logged in to favorite a flag');
      return;
    }
    if (isFavorite) {
      setFavoriteCount((prev) => prev - 1);
      setIsFavorite(false);
    } else {
      setFavoriteCount((prev) => prev + 1);
      setIsFavorite(true);
    }
    toggleFavoriteFlag(id, true).then((isSuccess) => {
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      if (!isSuccess) {
        setFavoriteCount((prev) => prev - 1);
        setIsFavorite(false);
      }
    });
  };

  const handleSetProfileFlag = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) {
      toast.error('You must be logged in to set a profile flag');
      return;
    }

    setIsSettingProfileFlag(true);
    try {
      const result = await changeFavoriteFlag(isCurrentProfileFlag ? null : id);
      queryClient.invalidateQueries({ queryKey: ['userData'] });
      if (result.success) {
        toast.success(isCurrentProfileFlag ? 'Profile flag removed' : 'Profile flag updated!');
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to update profile flag');
    } finally {
      setIsSettingProfileFlag(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    if (!session?.user) {
      toast.error('You must be logged in to edit a flag');
      return;
    }
    e.stopPropagation();
    setIsDialogOpen(true);
  };

  const handleCardClick = () => {
    router.push(`/flag/${encodeURIComponent(flagName)}`);
  };

  return (
    <>
      <Card
        className='cursor-pointer px-8 relative group h-full'
        onClick={handleCardClick}
      >
        {/* Favorite Button - Only visible on hover */}
        <Button
          variant='neutral'
          size='sm'
          className='absolute top-2 right-2 z-10 bg-secondary-background/95 hover:bg-secondary-background shadow-md border border-border opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200'
          onClick={handleFavoriteToggle}
        >
          <Heart
            className={`w-4 h-4 ${
              isFavorite ? 'fill-red-500 text-red-500' : 'text-foreground/60'
            }`}
          />
        </Button>

        {/* Edit Button - Only visible on hover */}
        {session?.user && (
          <Button
            variant='neutral'
            size='sm'
            className='absolute top-2 right-14 z-10 bg-secondary-background/95 hover:bg-secondary-background shadow-md border border-border opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200'
            onClick={handleEditClick}
          >
            <Edit className='w-4 h-4 text-foreground/60' />
          </Button>
        )}

        {/* Set as Profile Flag Button - Only visible on hover */}
        {session?.user && (
          <Button
            variant='neutral'
            size='sm'
            className={`absolute top-2 right-26 z-10 shadow-md border border-border opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
              isCurrentProfileFlag 
                ? 'bg-main text-main-foreground hover:bg-main/90' 
                : 'bg-secondary-background/95 hover:bg-secondary-background'
            }`}
            onClick={handleSetProfileFlag}
            disabled={isSettingProfileFlag}
            title={isCurrentProfileFlag ? 'Your Profile Flag' : 'Set as Profile Flag'}
          >
            {isCurrentProfileFlag ? (
              <Check className='w-4 h-4' />
            ) : (
              <UserCircle className='w-4 h-4 text-foreground/60' />
            )}
          </Button>
        )}

        {/* Favorites Count Badge */}
        {Boolean(favoriteCount) && (
          <div className='absolute top-2 left-2 z-10'>
            <Badge
              variant='neutral'
              className='bg-secondary-background/95 text-foreground/80 border border-border'
            >
              <Heart className='w-3 h-3 mr-1 fill-red-500 text-red-500' />
              {favoriteCount}
            </Badge>
          </div>
        )}

        <div className='relative overflow-hidden'>
          <div className='aspect-[3/2] relative shadow-shadow'>
            <Image
              style={{
                boxShadow: '8px upx 0px 0px var(--border)',
              }}
              src={flagImage}
              alt={flagName}
              fill
              className='drop-shadow-shadow object-contain text-main-foreground bg-main/70 border-4 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none p-2 rounded-base'
              sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
            />
          </div>
        </div>

        <CardContent className='pb-2'>
          <h3 className='font-semibold text-center'>{flagName}</h3>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {session?.user && (
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
                sources: [],
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
