import { randomUUID } from 'node:crypto';
import { and, eq, gt, lte, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { emailChallenges, users } from '@/db/schema';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { emailDeliveryConfigured, sendVerificationEmail } from '@/lib/email';
import {
  CODE_LIFETIME_MS,
  generateVerificationCode,
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  verificationCodeHash,
} from '@/lib/email-verification-code';

export type PendingVerification = {
  email: string;
  id: string;
  expiresAt: number;
  resendAt: number;
};
export type VerificationDeliveryResult = {
  success: boolean;
  message: string;
  pending?: PendingVerification;
};
type SignupDetails = {
  email: string;
  name: string;
  hashedPassword: string;
  userId: string | null;
};

/** Only a code, not a password, is sent to the email provider. */
async function deliver(
  details: SignupDetails,
  ip: string,
  previousId?: string,
): Promise<VerificationDeliveryResult> {
  if (!emailDeliveryConfigured())
    return {
      success: false,
      message:
        'Email signup is temporarily unavailable. Please try again later.',
    };
  const allowed = await Promise.all([
    allowAuthAttempt('verification-send-email', details.email, 5),
    allowAuthAttempt('verification-send-ip', ip, 20),
  ]);
  if (allowed.some((value) => !value))
    return {
      success: false,
      message: 'Too many code requests. Try again in 15 minutes.',
    };
  // Bound retention of abandoned signup details; the expiry index keeps this cheap.
  await db
    .delete(emailChallenges)
    .where(
      lt(emailChallenges.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    );
  const now = new Date();
  const id = randomUUID();
  const code = generateVerificationCode();
  const values = {
    ...details,
    id,
    codeHash: verificationCodeHash(details.email, id, code),
    attempts: 0,
    sentAt: now,
    expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
  };
  const cooledDown = lte(
    emailChallenges.sentAt,
    new Date(now.getTime() - RESEND_COOLDOWN_MS),
  );
  const [saved] = previousId
    ? await db
        .update(emailChallenges)
        .set(values)
        .where(
          and(
            eq(emailChallenges.email, details.email),
            eq(emailChallenges.id, previousId),
            cooledDown,
          ),
        )
        .returning({ id: emailChallenges.id })
    : await db
        .insert(emailChallenges)
        .values(values)
        .onConflictDoUpdate({
          target: emailChallenges.email,
          set: values,
          setWhere: cooledDown,
        })
        .returning({ id: emailChallenges.id });
  if (!saved)
    return {
      success: false,
      message: 'Please wait a minute before requesting another code.',
    };
  const pending = {
    email: details.email,
    id,
    expiresAt: values.expiresAt.getTime(),
    resendAt: now.getTime() + RESEND_COOLDOWN_MS,
  };
  try {
    await sendVerificationEmail(details.email, code, id);
    return { success: true, message: 'Verification code sent.', pending };
  } catch {
    // Keep the challenge: a timed-out delivery may still arrive. Resending rotates it.
    return {
      success: false,
      message:
        'We couldn’t send your code. Please try resending it in a minute.',
      pending,
    };
  }
}

export const beginEmailVerification = (details: SignupDetails, ip: string) =>
  deliver(details, ip);

export async function resendEmailVerification(
  email: string,
  id: string,
  ip: string,
) {
  const [challenge] = await db
    .select()
    .from(emailChallenges)
    .where(
      and(
        eq(emailChallenges.email, email),
        eq(emailChallenges.id, id),
        gt(
          emailChallenges.expiresAt,
          new Date(Date.now() - 24 * 60 * 60 * 1000),
        ),
      ),
    )
    .limit(1);
  if (!challenge)
    return {
      success: false,
      message: 'This verification has expired. Start signup or sign in again.',
    };
  if (challenge.sentAt.getTime() + RESEND_COOLDOWN_MS > Date.now())
    return {
      success: false,
      message: 'Please wait a minute before requesting another code.',
    };
  return deliver(
    {
      email,
      name: challenge.name,
      hashedPassword: challenge.hashedPassword,
      userId: challenge.userId,
    },
    ip,
    id,
  );
}

export async function completeEmailVerification(
  email: string,
  id: string,
  code: string,
  ip: string,
) {
  const invalid = {
    success: false,
    message:
      'That code is incorrect, expired, or has already been used. Try again or request a new code.',
  };
  const allowed = await Promise.all([
    allowAuthAttempt('verification-check-email', email, 20),
    allowAuthAttempt('verification-check-ip', ip, 50),
  ]);
  if (allowed.some((value) => !value))
    return {
      success: false,
      message: 'Too many attempts. Try again in 15 minutes.',
    };
  const [attempt] = await db
    .update(emailChallenges)
    .set({ attempts: sql`${emailChallenges.attempts} + 1` })
    .where(
      and(
        eq(emailChallenges.email, email),
        eq(emailChallenges.id, id),
        gt(emailChallenges.expiresAt, new Date()),
        lt(emailChallenges.attempts, MAX_CODE_ATTEMPTS),
      ),
    )
    .returning({ id: emailChallenges.id });
  if (!attempt) return invalid;
  const hash = verificationCodeHash(email, id, code);
  // Consumption and account activation share one transaction. Concurrent correct
  // submissions cannot replay the code or overwrite a verified/OAuth account.
  const result = await db.execute<{ id: string }>(sql`
    with consumed as (
      delete from ${emailChallenges}
      where email = ${email} and id = ${id} and code_hash = ${hash}
        and expires_at > now() and attempts <= ${MAX_CODE_ATTEMPTS}
      returning *
    ), activated as (
      update ${users} u set name = c.name, hashed_password = c.hashed_password, email_verified = now()
      from consumed c where c.user_id = u.id and u.email_verified is null and u.hashed_password is not null
      returning u.id
    ), created as (
      insert into ${users} (name, email, hashed_password, email_verified)
      select name, email, hashed_password, now() from consumed where user_id is null
      on conflict (lower(email)) do nothing returning id
    ) select id from activated union all select id from created
  `);
  return result.rows.length > 0
    ? { success: true, message: 'Email verified.' }
    : invalid;
}
