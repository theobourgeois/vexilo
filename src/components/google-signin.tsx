'use client';

import { signIn } from 'next-auth/react';
import { Button } from './ui/button';
import { GoogleLogo } from '@/components/icons';

export function GoogleSignin() {
  const handleSignIn = async () => {
    await signIn('google', { callbackUrl: '/' });
  };

  return (
    <Button variant='neutral' onClick={handleSignIn}>
      <GoogleLogo />
      Sign in with Google
    </Button>
  );
}
