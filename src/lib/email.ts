import { verificationEmail } from '@/lib/emails/verify-email';

export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  challengeId: string,
) {
  if (!emailDeliveryConfigured())
    throw new Error('Email delivery is not configured');
  const message = verificationEmail(code);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `verify-email/${challengeId}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      ...message,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`Email delivery failed (${response.status})`);
  const result = await response.json();
  if (!result.id) throw new Error('Email delivery was not accepted');
}
