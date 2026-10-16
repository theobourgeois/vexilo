'use client';

import { useSession } from 'next-auth/react';
import { GoogleSignin } from '@/components/google-signin';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { SvgLogo } from '@/components/svg-logo';
import BatchCreateFlags from '@/components/batch-create/BatchCreateFlags';

export default function PostFlagPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
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
            <SvgLogo className='w-16 h-16 mx-auto' />
            <CardTitle className='text-2xl'>Sign in to Add Flags</CardTitle>
            <CardDescription>
              You need to be signed in to share flags with the community
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 flex flex-col items-center'>
            <GoogleSignin />
            <p className='text-sm text-muted-foreground text-center'>
              By signing in, you agree to our{' '}
              <Link
                href='/community-guidelines'
                className='text-main hover:underline'
              >
                community guidelines
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <BatchCreateFlags />;
}
