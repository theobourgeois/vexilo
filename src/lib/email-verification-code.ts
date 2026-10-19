import { createHmac, randomInt } from 'node:crypto';

export const CODE_LIFETIME_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export const generateVerificationCode = () =>
  randomInt(0, 1_000_000).toString().padStart(6, '0');

export function verificationCodeHash(
  email: string,
  challengeId: string,
  code: string,
) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret)
    throw new Error('NEXTAUTH_SECRET is required for email verification');
  return createHmac('sha256', secret)
    .update(JSON.stringify(['verify-email-v1', email, challengeId, code]))
    .digest('hex');
}
