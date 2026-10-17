'use client';

import { useSession } from 'next-auth/react';
import { GoogleSignin } from '@/components/google-signin';
import { Loader2 } from '@/components/icons';
import Link from 'next/link';
import { SvgLogo } from '@/components/svg-logo';
import BatchCreateFlags from '@/components/batch-create/BatchCreateFlags';

export default function PostFlagPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className='mx-auto max-w-[760px] px-4 pt-7 md:px-8'>
        <div className='flex min-h-[400px] items-center justify-center text-muted-foreground'>
          <Loader2 className='size-6 animate-spin' />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className='mx-auto max-w-[760px] px-4 pb-16 pt-7 md:px-8'>
        <h1 className='text-[22px] font-semibold tracking-[-0.03em]'>Post flags</h1>
        <p className='mt-1 text-[13px] text-muted-foreground'>
          Add flags to the catalogue. New submissions are reviewed by moderators before they go live.
        </p>

        <section className='vx-tile mt-6 flex flex-col items-center px-6 py-10 text-center'>
          <SvgLogo className='size-12' />
          <h2 className='mt-4 text-[17px] font-semibold tracking-[-0.02em]'>Sign in to continue</h2>
          <p className='mt-1 max-w-sm text-[13px] text-subtle'>
            You need an account to post flags and suggest edits.
          </p>
          <div className='mt-5'>
            <GoogleSignin />
          </div>
          <p className='mt-5 text-[12.5px] text-muted-foreground'>
            By signing in, you agree to the{' '}
            <Link
              href='/community-guidelines'
              className='border-b border-border text-subtle hover:border-foreground hover:text-foreground'
            >
              community guidelines
            </Link>
            .
          </p>
        </section>
      </div>
    );
  }

  return <BatchCreateFlags />;
}
