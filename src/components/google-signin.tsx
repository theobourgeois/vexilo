'use client';

import { signIn } from 'next-auth/react';
import { Button } from './ui/button';
import { GoogleLogo } from '@/components/icons';
import { openSignIn } from '@/lib/sign-in';

export function GoogleSignin() {
  const handleSignIn = async () => {
    await signIn('google', { callbackUrl: window.location.href });
  };

  return (
    <div className='flex flex-col items-center gap-3'>
      <Button variant='neutral' onClick={handleSignIn}>
        <GoogleLogo />
        Sign in with Google
      </Button>
      <button
        type='button'
        onClick={() => openSignIn()}
        className='cursor-pointer text-sm text-muted-foreground underline underline-offset-4'
      >
        Use email instead
      </button>
    </div>
  );
}
