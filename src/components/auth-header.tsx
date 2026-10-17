'use client';

import { useSession, signOut, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button';
import { GoogleLogo, LogOut, Moon, Settings, Shield, Sun, User } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { getUserData } from '@/actions/users';
import FlagImage from './FlagImage';

export function AuthHeader() {
  const { data: session, status } = useSession();
  const { data: userData } = useQuery({
    queryKey: ['userData'],
    queryFn: getUserData,
    enabled: !!session?.user,
  });
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  if (status === 'loading') {
    return <div className='size-[34px] animate-pulse rounded-full bg-foreground/[0.07]' />;
  }

  if (!session) {
    return (
      <Button variant='neutral' onClick={() => signIn('google', { callbackUrl: '/' })}>
        <GoogleLogo />
        Sign in
      </Button>
    );
  }

  const name = userData?.user?.name || session.user?.name || 'User';
  const profileFlag = userData?.user?.favoriteFlag;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className='relative cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
          <Avatar className='size-[34px]'>
            <AvatarImage src={session.user?.image || ''} alt={name} />
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-60'>
        <div className='flex items-center gap-3 px-2.5 pb-2.5 pt-1.5'>
          <div className='min-w-0 flex-1'>
            <div className='truncate text-sm font-semibold'>{name}</div>
            {profileFlag && (
              <div className='truncate text-xs text-muted-foreground'>{profileFlag.name}</div>
            )}
          </div>
          {profileFlag && (
            <FlagImage src={profileFlag.image} alt={profileFlag.name} maxHeight={22} fixed />
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/profile/${userData?.user?.userNumber || 'me'}`)}>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
          {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        {session.user?.isAdmin && (
          <DropdownMenuItem onClick={() => router.push('/admin')}>
            <Shield />
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: '/' })}
          className='text-bad focus:bg-bad-soft focus:text-bad'
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
