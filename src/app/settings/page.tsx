'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Settings,
  User,
  Loader2,
  Eye,
  Flag,
  Search,
  X,
} from 'lucide-react';
import {
  changeName,
  changeIsAnonymous,
  getUserData,
  changeFavoriteFlag,
} from '@/actions/users';
import { getFlags } from '@/actions/flags';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import Image from 'next/image';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState(session?.user?.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isAnonymousLoading, setIsAnonymousLoading] = useState(false);
  const [isFavoriteFlagLoading, setIsFavoriteFlagLoading] = useState(false);
  const [flagSearch, setFlagSearch] = useState('');
  const [isFlagDropdownOpen, setIsFlagDropdownOpen] = useState(false);
  const flagDropdownRef = useRef<HTMLDivElement>(null);
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

  const handleBackToHome = () => {
    router.push('/');
  };

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
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to update name. Please try again.');
    } finally {
      setIsLoading(false);
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
        toast.error(result.message);
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
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to update favorite flag. Please try again.');
    } finally {
      setIsFavoriteFlagLoading(false);
    }
  };

  if (status === 'loading' || userDataLoading) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-12'>
        <div className='flex items-center justify-center min-h-[400px]'>
          <Loader2 className='h-8 w-8 animate-spin' />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-12'>
        <Card className='w-full max-w-md mx-auto'>
          <CardHeader className='text-center'>
            <CardTitle className='text-2xl'>Sign in Required</CardTitle>
            <CardDescription>
              You need to be signed in to access settings
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 flex flex-col items-center'>
            <Button onClick={() => router.push('/')}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto px-4 py-12'>
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex items-center gap-4'>
          <Button
            variant='neutral'
            size='icon'
            onClick={handleBackToHome}
            className='h-10 w-10'
          >
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div>
            <h1 className='text-3xl font-bold tracking-tight flex items-center gap-2'>
              <Settings className='h-8 w-8' />
              Settings
            </h1>
            <p className='text-muted-foreground mt-1'>
              Manage your account preferences
            </p>
          </div>
        </div>

        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <User className='h-5 w-5' />
              Profile Settings
            </CardTitle>
            <CardDescription>Update your profile information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameChange} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Display Name</Label>
                <Input
                  id='name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Enter your display name'
                  disabled={isLoading}
                />
              </div>
              <Button type='submit' disabled={isLoading} className='w-full'>
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Updating...
                  </>
                ) : (
                  'Update Name'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Eye className='h-5 w-5' />
              Privacy Settings
            </CardTitle>
            <CardDescription>
              Control your privacy and visibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base'>Anonymous Mode</Label>
                  <p className='text-sm text-muted-foreground'>
                    When enabled, your name won&apos;t appear on leaderboards
                    and your profile will be hidden
                  </p>
                </div>
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={handleAnonymousChange}
                  disabled={isAnonymousLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Favorite Flag Settings */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Flag className='h-5 w-5' />
              Profile Flag
            </CardTitle>
            <CardDescription>
              Choose a flag to display as a badge on your profile picture
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {/* Current favorite flag display */}
              {userData?.user?.favoriteFlag && (
                <div className='flex items-center gap-3 p-3 bg-secondary-background rounded-lg border-2 border-border'>
                  <div className='relative w-10 h-7 rounded overflow-hidden border border-border flex-shrink-0'>
                    <Image
                      src={userData.user.favoriteFlag.image}
                      alt={userData.user.favoriteFlag.name}
                      fill
                      className='object-cover'
                    />
                  </div>
                  <span className='font-medium flex-1'>
                    {userData.user.favoriteFlag.name}
                  </span>
                  <Button
                    variant='neutral'
                    size='sm'
                    onClick={() => handleFavoriteFlagChange(null)}
                    disabled={isFavoriteFlagLoading}
                  >
                    {isFavoriteFlagLoading ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <X className='h-4 w-4' />
                    )}
                    Remove
                  </Button>
                </div>
              )}

              {/* Flag search */}
              <div className='space-y-2' ref={flagDropdownRef}>
                <Label>
                  {userData?.user?.favoriteFlag
                    ? 'Change favorite flag'
                    : 'Select a favorite flag'}
                </Label>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
                  <Input
                    placeholder='Search for a flag...'
                    value={flagSearch}
                    onChange={(e) => setFlagSearch(e.target.value)}
                    className='pl-10'
                    onFocus={() => setIsFlagDropdownOpen(true)}
                    disabled={isFavoriteFlagLoading}
                  />

                  {/* Search Results Dropdown */}
                  {flagSearch && isFlagDropdownOpen && (
                    <Card className='absolute top-full left-0 right-0 z-50 mt-2 max-h-60 overflow-y-auto shadow-lg border-2'>
                      <CardContent className='p-2'>
                        {flagSearchLoading ? (
                          <div className='flex items-center justify-center py-4'>
                            <Loader2 className='h-6 w-6 animate-spin' />
                          </div>
                        ) : flagSearchResults &&
                          flagSearchResults.length > 0 ? (
                          <div className='space-y-0'>
                            {flagSearchResults.map((flag) => (
                              <div
                                key={flag.id}
                                className='flex items-center gap-3 p-2 rounded-md hover:bg-secondary-background transition-colors cursor-pointer'
                                onClick={() =>
                                  handleFavoriteFlagChange(flag.id)
                                }
                              >
                                <div className='relative w-8 h-6 rounded overflow-hidden border border-border flex-shrink-0'>
                                  <Image
                                    src={flag.image}
                                    alt={flag.name}
                                    fill
                                    className='object-cover'
                                  />
                                </div>
                                <span className='font-medium text-sm'>
                                  {flag.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className='text-center py-4 text-muted-foreground text-sm'>
                            No flags found
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
