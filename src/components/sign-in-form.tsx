'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  requestVerificationCode,
  resendVerificationCode,
  signUpWithEmail,
  verifyEmailCode,
} from '@/actions/auth';
import type {
  PendingVerification,
  VerificationDeliveryResult,
} from '@/lib/email-verification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleLogo, Loader2 } from '@/components/icons';
import { safeCallbackUrl } from '@/lib/sign-in';

export function SignInForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [restored, setRestored] = useState(false);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const passwordRef = useRef('');

  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem('vexilo-email-verification') || 'null',
      );
      if (
        saved &&
        typeof saved.email === 'string' &&
        saved.email.length <= 255 &&
        /^[0-9a-f-]{36}$/.test(saved.id) &&
        Number.isFinite(saved.resendAt) &&
        Number.isFinite(saved.expiresAt) &&
        saved.expiresAt > Date.now() - 24 * 60 * 60 * 1000
      )
        setPending(saved);
    } catch {
      /* Storage may be unavailable. */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      if (pending)
        sessionStorage.setItem(
          'vexilo-email-verification',
          JSON.stringify(pending),
        );
      else sessionStorage.removeItem('vexilo-email-verification');
    } catch {
      /* Verification still works without storage. */
    }
  }, [pending, restored]);
  useEffect(() => {
    if (!pending) return;
    window.scrollTo(0, 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);
  const search = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const providerError = search.get('error');
  const callback = () =>
    safeCallbackUrl(search.get('callbackUrl'), window.location.origin);

  function showChallenge(result: VerificationDeliveryResult) {
    if (result.pending) {
      setPending(result.pending);
      setCode('');
      setNow(Date.now());
    }
    if (!result.success) setError(result.message);
    else setNotice('A new code is on its way.');
  }

  async function finishSignIn(email: string, password: string) {
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: callback(),
    });
    if (result?.error === 'EmailNotVerified') {
      showChallenge(await requestVerificationCode({ email, password }));
      return;
    }
    if (!result?.ok || result.error) {
      setError(
        result?.error?.startsWith('Too many attempts')
          ? result.error
          : 'Email or password is incorrect. If you joined with Google, use Continue with Google.',
      );
      return;
    }
    passwordRef.current = '';
    queryClient.clear();
    router.replace(callback());
    router.refresh();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    passwordRef.current = password;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signup') {
        showChallenge(
          await signUpWithEmail({
            name: String(data.get('name') ?? ''),
            email,
            password,
          }),
        );
        return;
      }
      await finishSignIn(email, password);
    } catch {
      setError('Couldn’t connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await verifyEmailCode({
        email: pending.email,
        id: pending.id,
        code,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setPending(null);
      setEmailDraft(pending.email);
      setMode('signin');
      setNotice('Email verified. Sign in to continue.');
      if (passwordRef.current)
        await finishSignIn(pending.email, passwordRef.current);
    } catch {
      setError('Couldn’t verify your email. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const secondsUntilResend = pending
    ? Math.max(0, Math.ceil((pending.resendAt - now) / 1000))
    : 0;
  const expired = pending ? pending.expiresAt <= now : false;
  if (pending)
    return (
      <div className='mx-auto max-w-[440px] px-4 py-12 sm:py-16'>
        <div className='vx-tile space-y-6 p-6 sm:p-8'>
          <div>
            <p className='mb-3 text-xs font-semibold tracking-widest text-main'>
              ONE LAST STEP
            </p>
            <h1 className='text-2xl font-semibold tracking-tight'>
              Verify your email
            </h1>
            <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
              Enter the 6-digit code for{' '}
              <span className='break-all font-medium text-foreground'>
                {pending.email}
              </span>
              .
            </p>
          </div>
          <form onSubmit={verify} className='space-y-4'>
            <div className='space-y-2'>
              <label
                htmlFor='verification-code'
                className='text-sm font-medium'
              >
                Verification code
              </label>
              <Input
                autoFocus
                id='verification-code'
                name='code'
                type='text'
                inputMode='numeric'
                autoComplete='one-time-code'
                pattern='[0-9]{6}'
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                disabled={busy}
                aria-describedby='verification-expiry'
                className='h-16 text-center font-mono text-3xl tracking-[0.35em]'
              />
              <p
                id='verification-expiry'
                className='text-xs text-muted-foreground'
              >
                {expired
                  ? 'This code has expired. Request a new one below.'
                  : 'Your code expires in 10 minutes. Check your spam folder too.'}
              </p>
            </div>
            {error && (
              <p role='alert' className='text-sm text-bad'>
                {error}
              </p>
            )}
            {notice && (
              <p role='status' className='text-sm text-muted-foreground'>
                {notice}
              </p>
            )}
            <Button
              type='submit'
              disabled={busy || code.length !== 6 || expired}
              className='h-11 w-full'
            >
              {busy && <Loader2 className='animate-spin' />}Verify email
            </Button>
          </form>
          <div className='space-y-3 text-center'>
            <button
              type='button'
              disabled={busy || secondsUntilResend > 0}
              className='cursor-pointer text-sm font-medium text-foreground underline underline-offset-4 disabled:cursor-default disabled:text-muted-foreground disabled:no-underline'
              onClick={async () => {
                setBusy(true);
                setError('');
                setNotice('');
                try {
                  showChallenge(
                    await resendVerificationCode({
                      email: pending.email,
                      id: pending.id,
                    }),
                  );
                } catch {
                  setError('Couldn’t resend your code. Please try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {secondsUntilResend > 0
                ? `Resend code in ${secondsUntilResend}s`
                : 'Resend code'}
            </button>
            <div>
              <button
                type='button'
                disabled={busy}
                className='cursor-pointer text-xs text-muted-foreground underline underline-offset-4'
                onClick={() => {
                  setEmailDraft(pending.email);
                  setPending(null);
                  setCode('');
                  setError('');
                  setNotice('');
                  passwordRef.current = '';
                }}
              >
                Use a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className='mx-auto max-w-[440px] px-4 py-12 sm:py-16'>
      <div className='vx-tile space-y-6 p-6 sm:p-8'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className='mt-2 text-sm text-muted-foreground'>
            {mode === 'signup'
              ? 'Save your favourites and share your flags.'
              : 'Sign in to keep creating and exploring.'}
          </p>
        </div>
        <Button
          variant='neutral'
          className='h-11 w-full'
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signIn('google', { callbackUrl: callback() });
            } catch {
              setError('Couldn’t connect to Google. Please try again.');
              setBusy(false);
            }
          }}
        >
          <GoogleLogo />
          Continue with Google
        </Button>
        <div className='flex items-center gap-3 text-xs text-muted-foreground'>
          <span className='h-px flex-1 bg-line' />
          or use email
          <span className='h-px flex-1 bg-line' />
        </div>
        <form key={mode} onSubmit={submit} className='space-y-4'>
          <fieldset disabled={busy} className='space-y-4'>
            {mode === 'signup' && (
              <div className='space-y-1.5'>
                <label htmlFor='auth-name' className='text-sm font-medium'>
                  Name
                </label>
                <Input
                  id='auth-name'
                  name='name'
                  autoComplete='name'
                  maxLength={100}
                  required
                />
              </div>
            )}
            <div className='space-y-1.5'>
              <label htmlFor='auth-email' className='text-sm font-medium'>
                Email
              </label>
              <Input
                id='auth-email'
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                name='email'
                type='email'
                autoComplete='email'
                maxLength={255}
                required
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='auth-password' className='text-sm font-medium'>
                Password
              </label>
              <Input
                id='auth-password'
                name='password'
                type='password'
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                minLength={mode === 'signup' ? 12 : undefined}
                maxLength={128}
                required
              />
              {mode === 'signup' && (
                <p className='text-xs text-muted-foreground'>
                  Use at least 12 characters.
                </p>
              )}
            </div>
          </fieldset>
          {notice && (
            <p role='status' className='text-sm text-muted-foreground'>
              {notice}
            </p>
          )}
          {(error || providerError) && (
            <p role='alert' className='text-sm text-bad'>
              {error ||
                (providerError === 'OAuthAccountNotLinked'
                  ? 'This email already has an account. Sign in using the method you used to create it.'
                  : 'Couldn’t sign in. Please try again.')}
            </p>
          )}
          <Button type='submit' className='h-11 w-full' disabled={busy}>
            {busy && <Loader2 className='animate-spin' />}
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <p className='text-center text-sm text-muted-foreground'>
          {mode === 'signup' ? 'Already have an account?' : 'New to Vexilo?'}{' '}
          <button
            type='button'
            disabled={busy}
            className='cursor-pointer font-medium text-foreground underline underline-offset-4'
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setError('');
              setNotice('');
              passwordRef.current = '';
            }}
          >
            {mode === 'signup' ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </div>
  );
}
