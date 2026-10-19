'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { signupSchema } from '@/lib/auth-validation';
import { hashPassword } from '@/lib/password';
import { verifyPassword } from '@/lib/password';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import {
  beginEmailVerification,
  completeEmailVerification,
  resendEmailVerification,
} from '@/lib/email-verification';
import { emailSchema } from '@/lib/auth-validation';
import { emailDeliveryConfigured } from '@/lib/email';
import { z } from 'zod';

async function requestIp() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip') ||
    'unknown'
  );
}

export async function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
}) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0].message };
  const ip = await requestIp();
  if (!(await allowAuthAttempt('signup', ip, 5)))
    return {
      success: false,
      message: 'Too many attempts. Try again in 15 minutes.',
    };
  const { name, email, password } = parsed.data;
  const [existing] = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      hashedPassword: users.hashedPassword,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (existing && (existing.emailVerified || !existing.hashedPassword))
    return {
      success: false,
      message:
        'An account already uses this email. Sign in with your password or Google.',
    };
  try {
    if (!emailDeliveryConfigured())
      return {
        success: false,
        message:
          'Email signup is temporarily unavailable. Please try again later.',
      };
    return await beginEmailVerification(
      {
        email,
        name,
        hashedPassword: await hashPassword(password),
        userId: existing?.id ?? null,
      },
      ip,
    );
  } catch {
    return {
      success: false,
      message: 'Could not create your account. Please try again.',
    };
  }
}

const challengeSchema = z.object({ email: emailSchema, id: z.uuid() });

export async function resendVerificationCode(input: {
  email: string;
  id: string;
}) {
  const parsed = challengeSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      message: 'Start signup or sign in again to request a code.',
    };
  try {
    return await resendEmailVerification(
      parsed.data.email,
      parsed.data.id,
      await requestIp(),
    );
  } catch {
    return {
      success: false,
      message: 'Couldn’t request a code. Please try again.',
    };
  }
}

export async function verifyEmailCode(input: {
  email: string;
  id: string;
  code: string;
}) {
  const parsed = challengeSchema
    .extend({ code: z.string().regex(/^\d{6}$/) })
    .safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      message: 'Enter the 6-digit code from your email.',
    };
  try {
    return await completeEmailVerification(
      parsed.data.email,
      parsed.data.id,
      parsed.data.code,
      await requestIp(),
    );
  } catch {
    return {
      success: false,
      message: 'Couldn’t verify your email. Please try again.',
    };
  }
}

/** Resume verification for an older email account after checking its password. */
export async function requestVerificationCode(input: {
  email: string;
  password: string;
}) {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1).max(128) })
    .safeParse(input);
  if (!parsed.success)
    return { success: false, message: 'Email or password is incorrect.' };
  const ip = await requestIp();
  const allowed = await Promise.all([
    allowAuthAttempt('verification-resume', ip, 30),
    allowAuthAttempt('verification-resume-email', parsed.data.email, 10),
  ]);
  if (allowed.some((value) => !value))
    return {
      success: false,
      message: 'Too many attempts. Try again in 15 minutes.',
    };
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      emailVerified: users.emailVerified,
      hashedPassword: users.hashedPassword,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`)
    .limit(1);
  if (
    !(await verifyPassword(
      parsed.data.password,
      user?.hashedPassword ?? null,
    )) ||
    !user
  )
    return { success: false, message: 'Email or password is incorrect.' };
  if (user.emailVerified)
    return {
      success: false,
      message: 'This email is already verified. Sign in to continue.',
    };
  try {
    return await beginEmailVerification(
      {
        email: parsed.data.email,
        name: user.name ?? 'Vexilo member',
        hashedPassword: user.hashedPassword!,
        userId: user.id,
      },
      ip,
    );
  } catch {
    return {
      success: false,
      message: 'Couldn’t request a code. Please try again.',
    };
  }
}

export async function getUser() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user[0]) throw new Error('User not found');
  const { hashedPassword: _password, ...safeUser } = user[0];
  void _password;
  return safeUser;
}
