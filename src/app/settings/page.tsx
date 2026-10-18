'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, Flag, Loader2, Search, Trash2, Upload, X } from '@/components/icons';
import FlagImage from '@/components/FlagImage';
import { cn } from '@/lib/utils';
import {
  changeName,
  changeIsAnonymous,
  getUserData,
  changeFavoriteFlag,
  changeProfilePicture,
  removeProfilePicture,
} from '@/actions/users';
import { getFlags } from '@/actions/flags';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { toastErrorWithLogin } from '@/lib/toast-auth';

const PROFILE_PICTURE_MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const PROFILE_PICTURE_UPLOAD_SIZE = 512;

/** Center-crops an image to a square and shrinks it so uploads stay small. */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(side, PROFILE_PICTURE_UPLOAD_SIZE);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), 'image/webp', 0.9),
  );
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className='vx-tile p-5 sm:p-6'>
      <div className='mb-4'>
        <h2 className='text-sm font-semibold tracking-[-0.01em]'>{title}</h2>
        {description && <p className='mt-0.5 text-[13px] text-muted-foreground'>{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [name, setName] = useState(session?.user?.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isAnonymousLoading, setIsAnonymousLoading] = useState(false);
  const [isFavoriteFlagLoading, setIsFavoriteFlagLoading] = useState(false);
  const [flagSearch, setFlagSearch] = useState('');
  const [isFlagDropdownOpen, setIsFlagDropdownOpen] = useState(false);
  const [isPictureLoading, setIsPictureLoading] = useState(false);
  const flagDropdownRef = useRef<HTMLDivElement>(null);
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [debouncedFlagSearch] = useDebounce(flagSearch, 300);

  const { data: userData, isLoading: userDataLoading } = useQuery({
    queryKey: ['userData'],
    queryFn: getUserData,
  });

  const { data: flagSearchResults, isLoading: flagSearchLoading } = useQuery({
    queryKey: ['flagSearch', debouncedFlagSearch],
    queryFn: () => getFlags(1, 10, debouncedFlagSearch),
    enabled: debouncedFlagSearch.length > 0,
  });

  useEffect(() => {
    if (userData) {
      setName(userData.user?.name || '');
      setIsAnonymous(userData.user?.isAnonymous || false);
    }
  }, [userData]);

  // Close flag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        flagDropdownRef.current &&
        !flagDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFlagDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      const result = await changeName(name.trim());
      queryClient.invalidateQueries({ queryKey: ['userData'] });
      if (result.success) {
        await updateSession();
        toast.success(result.message);
      } else {
        toastErrorWithLogin(result.message);
      }
    } catch {
      toast.error('Failed to update name. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > PROFILE_PICTURE_MAX_SOURCE_BYTES) {
      toast.error('Image must be 15 MB or smaller.');
      return;
    }

    setIsPictureLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', await toSquareWebp(file), 'avatar.webp');
      const result = await changeProfilePicture(formData);
      if (result.success) {
        await updateSession();
        queryClient.invalidateQueries({ queryKey: ['userData'] });
        toast.success(result.message);
      } else {
        toastErrorWithLogin(result.message);
      }
    } catch {
      toast.error('Failed to update profile picture. Please try again.');
    } finally {
      setIsPictureLoading(false);
    }
  };

  const handlePictureRemove = async () => {
    setIsPictureLoading(true);
    try {
      const result = await removeProfilePicture();
      if (result.success) {
        await updateSession();
        queryClient.invalidateQueries({ queryKey: ['userData'] });
        toast.success(result.message);
      } else {
        toastErrorWithLogin(result.message);
      }
    } catch {
      toast.error('Failed to remove profile picture. Please try again.');
    } finally {
      setIsPictureLoading(false);
    }
  };

  const handleAnonymousChange = async (checked: boolean) => {
    setIsAnonymousLoading(true);
    try {
      const result = await changeIsAnonymous(checked);
      queryClient.invalidateQueries({ queryKey: ['userData'] });
      if (result.success) {
        setIsAnonymous(checked);
        toast.success(result.message);
      } else {
        toastErrorWithLogin(result.message);
      }
    } catch {
      toast.error('Failed to update anonymization setting. Please try again.');
    } finally {
      setIsAnonymousLoading(false);
    }
  };

  const handleFavoriteFlagChange = async (flagId: string | null) => {
    setIsFavoriteFlagLoading(true);
    try {
      const result = await changeFavoriteFlag(flagId);
      queryClient.invalidateQueries({ queryKey: ['userData'] });
      if (result.success) {
        toast.success(result.message);
        setFlagSearch('');
        setIsFlagDropdownOpen(false);
      } else {
        toastErrorWithLogin(result.message);
      }
    } catch {
      toast.error('Failed to update favorite flag. Please try again.');
    } finally {
      setIsFavoriteFlagLoading(false);
    }
  };

  if (status === 'loading' || userDataLoading) {
    return (
      <div className='mx-auto max-w-[760px] px-4 pb-16 md:px-8'>
        <div className='pb-[18px] pt-7'>
          <div className='h-6 w-28 animate-pulse rounded bg-foreground/[0.06]' />
          <div className='mt-2 h-3.5 w-56 animate-pulse rounded bg-foreground/[0.06]' />
        </div>
        <div className='space-y-4'>
          <div className='vx-tile h-[150px] animate-pulse' />
          <div className='vx-tile h-[300px] animate-pulse' />
          <div className='vx-tile h-[110px] animate-pulse' />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className='mx-auto max-w-[760px] px-4 pb-16 pt-7 md:px-8'>
        <div className='vx-tile mx-auto max-w-md px-6 py-10 text-center'>
          <h1 className='text-[17px] font-semibold tracking-[-0.02em]'>Sign in required</h1>
          <p className='mt-1 text-[13px] text-muted-foreground'>
            You need to be signed in to access settings.
          </p>
          <Button variant='neutral' className='mt-5' onClick={() => router.push('/')}>
            Go to browse
          </Button>
        </div>
      </div>
    );
  }

  const favoriteFlag = userData?.user?.favoriteFlag ?? null;
  const profilePicture = userData?.user?.image ?? null;
  const displayName = userData?.user?.name || session.user?.name || 'User';

  return (
    <div className='mx-auto max-w-[760px] px-4 pb-16 md:px-8'>
      <div className='pb-[18px] pt-7'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Settings</h1>
        <p className='mt-0.5 text-[13px] text-muted-foreground'>
          {userData?.user?.email ?? session.user?.email ?? 'Manage your account preferences.'}
        </p>
      </div>

      <div className='space-y-4'>
        {/* Profile */}
        <SettingsPanel title='Profile' description='Your name and picture as shown on flags, edits and the leaderboard.'>
          <div className='mb-5 flex flex-wrap items-center gap-4'>
            <Avatar className='size-16 text-xl'>
              <AvatarImage src={profilePicture || ''} alt={displayName} />
              <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className='min-w-0 flex-1'>
              <p className='text-[13px] font-medium'>Profile picture</p>
              <p className='mt-0.5 text-[13px] text-muted-foreground'>PNG, JPG, WebP or GIF. Cropped to a square.</p>
            </div>
            <div className='flex gap-2'>
              <input
                ref={pictureInputRef}
                type='file'
                accept='image/png,image/jpeg,image/webp,image/gif'
                className='hidden'
                onChange={handlePictureChange}
              />
              <Button
                variant='neutral'
                onClick={() => pictureInputRef.current?.click()}
                disabled={isPictureLoading}
              >
                {isPictureLoading ? <Loader2 className='animate-spin' /> : <Upload />}
                {profilePicture ? 'Change' : 'Upload'}
              </Button>
              {profilePicture && (
                <Button
                  variant='neutral'
                  size='icon'
                  title='Remove profile picture'
                  onClick={handlePictureRemove}
                  disabled={isPictureLoading}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
          <form onSubmit={handleNameChange} className='space-y-2'>
            <Label htmlFor='name' className='text-[13px] font-medium'>
              Display name
            </Label>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <Input
                id='name'
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Enter your display name'
                disabled={isLoading}
                className='flex-1'
              />
              <Button type='submit' disabled={isLoading} className='sm:w-[120px]'>
                {isLoading ? (
                  <>
                    <Loader2 className='animate-spin' />
                    Saving
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </form>
        </SettingsPanel>

        {/* Profile flag */}
        <SettingsPanel title='Profile flag' description='Shown as a badge on your profile picture.'>
          <div className='space-y-4'>
            {favoriteFlag ? (
              <div className='vx-well flex items-center gap-4 rounded-[14px] p-2.5 pr-3'>
                <div className='flag-stage relative h-[64px] w-[92px] shrink-0 rounded-[10px] bg-stage shadow-[inset_0_0_0_2px_var(--main)]'>
                  <FlagImage
                    src={favoriteFlag.image}
                    alt={favoriteFlag.name}
                    maxHeight={44}
                    area={66 * 44}
                  />
                </div>
                <div className='min-w-0 flex-1'>
                  <span className='vx-label flex items-center gap-1.5 text-main'>
                    <Check className='size-3' />
                    Current
                  </span>
                  <p className='mt-1.5 truncate font-semibold tracking-[-0.015em]'>{favoriteFlag.name}</p>
                </div>
                <Button
                  variant='neutral'
                  onClick={() => handleFavoriteFlagChange(null)}
                  disabled={isFavoriteFlagLoading}
                >
                  {isFavoriteFlagLoading ? <Loader2 className='animate-spin' /> : <X />}
                  Remove
                </Button>
              </div>
            ) : (
              <div className='vx-well flex items-center gap-4 rounded-[14px] p-2.5'>
                <div className='grid h-[64px] w-[92px] shrink-0 place-items-center rounded-[10px] text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)] [border-style:dashed]'>
                  <Flag className='size-5' />
                </div>
                <p className='text-[13px] text-muted-foreground'>No profile flag selected.</p>
              </div>
            )}

            <div className='space-y-2' ref={flagDropdownRef}>
              <Label htmlFor='flag-search' className='text-[13px] font-medium'>
                {favoriteFlag ? 'Change profile flag' : 'Select a profile flag'}
              </Label>
              <div className='relative'>
                <Search className='pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='flag-search'
                  placeholder='Search for a flag'
                  value={flagSearch}
                  onChange={(e) => setFlagSearch(e.target.value)}
                  className='pl-10'
                  onFocus={() => setIsFlagDropdownOpen(true)}
                  disabled={isFavoriteFlagLoading}
                  autoComplete='off'
                />
              </div>

              {flagSearch && isFlagDropdownOpen && (
                <div className='pt-2'>
                  {flagSearchLoading || flagSearch !== debouncedFlagSearch ? (
                    <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5'>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className='h-[118px] animate-pulse rounded-[14px] bg-foreground/[0.06]' />
                      ))}
                    </div>
                  ) : flagSearchResults && flagSearchResults.length > 0 ? (
                    <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5'>
                      {flagSearchResults.map((flag) => {
                        const isCurrent = favoriteFlag?.id === flag.id;
                        return (
                          <button
                            key={flag.id}
                            type='button'
                            onClick={() => handleFavoriteFlagChange(flag.id)}
                            disabled={isFavoriteFlagLoading}
                            aria-pressed={isCurrent}
                            title={flag.name}
                            className={cn(
                              'vx-key relative flex cursor-pointer flex-col overflow-hidden rounded-[14px] text-left transition-[transform,box-shadow] disabled:cursor-wait disabled:opacity-60',
                              isCurrent && 'outline-2 outline-offset-2 outline-main',
                            )}
                          >
                            {isCurrent && (
                              <span className='absolute right-1.5 top-1.5 z-10 grid size-5 place-items-center rounded-full bg-main text-main-foreground'>
                                <Check className='size-3' />
                              </span>
                            )}
                            <div className='flag-stage h-[80px] px-3'>
                              <FlagImage src={flag.image} alt={flag.name} maxHeight={56} area={84 * 56} />
                            </div>
                            <span className='truncate border-t border-line px-2.5 py-2 text-[12.5px] font-medium'>
                              {flag.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className='rounded-[14px] py-6 text-center text-[13px] text-muted-foreground shadow-[inset_0_0_0_1px_var(--line)]'>
                      No flags found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SettingsPanel>

        {/* Privacy */}
        <SettingsPanel title='Privacy'>
          <div className='flex items-center justify-between gap-6'>
            <div>
              <Label htmlFor='anonymous' className='text-[14px] font-medium'>
                Anonymous mode
              </Label>
              <p className='mt-1 text-[13px] text-muted-foreground'>
                Your name won&apos;t appear on leaderboards and your profile will be hidden.
              </p>
            </div>
            <Switch
              id='anonymous'
              checked={isAnonymous}
              onCheckedChange={handleAnonymousChange}
              disabled={isAnonymousLoading}
            />
          </div>
        </SettingsPanel>
      </div>
    </div>
  );
}
