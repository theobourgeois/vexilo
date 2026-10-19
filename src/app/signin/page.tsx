import { Suspense } from 'react';
import { SignInForm } from '@/components/sign-in-form';

export const metadata = { title: 'Sign in - Vexilo' };

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className='py-24 text-center text-muted-foreground'>Loading…</div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
