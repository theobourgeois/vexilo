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
import { toastErrorWithLogin } from '@/lib/toast-auth';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import FlagHoverPreview from '@/components/FlagHoverPreview';
import { usePrefersFineHover } from '@/hooks/useIsMobile';

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
  sources,
}: FlagCardProps) {
  const { data: session } = useSession();
  const [favoriteCount, setFavoriteCount] = React.useState(favorites || 0);
  const queryClient = useQueryClient();
  const [isFavorite, setIsFavorite] = React.useState(
    initialIsFavorite || false,
  );
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isHoverOpen, setIsHoverOpen] = React.useState(false);
  const [isSettingProfileFlag, setIsSettingProfileFlag] = React.useState(false);
  const router = useRouter();
  const canHover = usePrefersFineHover();

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
    <Card
      className='cursor-pointer p-5 relative group h-full transition-all duration-300 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_12px_oklch(0%_0_0/0.15)] dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_6px_12px_oklch(0%_0_0/0.5)] hover:-translate-y-1'
      onClick={handleCardClick}
    >
      {/* Top Action Buttons - Only visible on hover */}
      <div className='absolute top-3 right-3 z-10 flex gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
        {session?.user && (
          <Button
            variant='neutral'
            size='sm'
            className={`bg-gradient-to-b shadow-[0_2px_4px_oklch(0%_0_0/0.2),inset_0_1px_1px_oklch(100%_0_0/0.5)] border border-white/40 backdrop-blur-md px-2.5 ${
              isCurrentProfileFlag
                ? 'from-main to-[oklch(55%_0.15_259)] text-main-foreground border-[oklch(45%_0.15_259)]'
                : 'from-white/90 to-white/70 dark:from-white/20 dark:to-white/10'
            }`}
            onClick={handleSetProfileFlag}
            disabled={isSettingProfileFlag}
            title={
              isCurrentProfileFlag
                ? 'Your Profile Flag'
                : 'Set as Profile Flag'
            }
          >
            {isCurrentProfileFlag ? (
              <Check className='w-4 h-4' />
            ) : (
              <UserCircle className='w-4 h-4 text-foreground/70' />
            )}
          </Button>
        )}

        {session?.user && (
          <Button
            variant='neutral'
            size='sm'
            className='bg-gradient-to-b from-white/90 to-white/70 dark:from-white/20 dark:to-white/10 shadow-[0_2px_4px_oklch(0%_0_0/0.2),inset_0_1px_1px_oklch(100%_0_0/0.5)] border border-white/40 backdrop-blur-md px-2.5'
            onClick={handleEditClick}
          >
            <Edit className='w-4 h-4 text-foreground/70' />
          </Button>
        )}

        <Button
          variant='neutral'
          size='sm'
          className='bg-gradient-to-b from-white/90 to-white/70 dark:from-white/20 dark:to-white/10 shadow-[0_2px_4px_oklch(0%_0_0/0.2),inset_0_1px_1px_oklch(100%_0_0/0.5)] border border-white/40 backdrop-blur-md px-2.5'
          onClick={handleFavoriteToggle}
        >
          <Heart
            className={`w-4 h-4 ${
              isFavorite ? 'fill-red-500 text-red-500' : 'text-foreground/70'
            }`}
          />
        </Button>
      </div>

      {/* Favorites Count Badge */}
      {Boolean(favoriteCount) && (
        <div className='absolute top-3.5 left-3.5 z-10'>
          <Badge
            variant='neutral'
            className='text-foreground/80 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.5)] border-white/40 backdrop-blur-md px-2'
          >
            <Heart className='w-3 h-3 mr-1 fill-red-500 text-red-500' />
            {favoriteCount}
          </Badge>
        </div>
      )}

      {/* Flag Image Recessed Container */}
      <div className='relative w-full mt-2'>
        <div className='aspect-[3/2] relative rounded-md overflow-hidden bg-black/5 dark:bg-white/5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_1px_6px_rgba(0,0,0,0.5)] border border-black/5 dark:border-white/5'>
          <Image
            src={flagImage}
            alt={flagName}
            fill
            className='object-contain p-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-105'
            sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
          />
        </div>
      </div>

      <CardContent className='p-0 mt-0 flex-grow flex items-center justify-center px-1'>
        <h3 className='text-[15px] font-medium text-center text-foreground/80 leading-snug line-clamp-2 [text-shadow:0_1px_0_rgba(255,255,255,0.5)] dark:[text-shadow:0_1px_0_rgba(0,0,0,0.5)]'>
          {flagName}
        </h3>
      </CardContent>
    </Card>
  );

  return (
    <>
      {canHover ? (
        <HoverCard
          open={!isDialogOpen && isHoverOpen}
          onOpenChange={setIsHoverOpen}
          openDelay={350}
          closeDelay={120}
        >
          <HoverCardTrigger asChild>
            <div className='h-full'>{card}</div>
          </HoverCardTrigger>
          <HoverCardContent
            side='top'
            align='center'
            sideOffset={12}
            collisionPadding={16}
            className='w-[340px] rounded-2xl border border-white/15 bg-zinc-950/90 p-3 text-white shadow-[0_24px_64px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl dark:bg-black/85'
          >
            <FlagHoverPreview
              flagName={flagName}
              flagImage={flagImage}
              index={index}
              tags={tags}
              description={description}
              favorites={favoriteCount}
              sources={sources}
              relatedFlags={relatedFlags}
              onNavigate={() => {
                setIsHoverOpen(false);
                handleCardClick();
              }}
              onClose={() => setIsHoverOpen(false)}
            />
          </HoverCardContent>
        </HoverCard>
      ) : (
        card
      )}

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
