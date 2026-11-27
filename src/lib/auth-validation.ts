import { z } from 'zod';
import { usernameSchema } from '@/lib/username';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .pipe(z.email());
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters for your password.')
  .max(128, 'Use at most 128 characters for your password.');
export const signupSchema = z.object({
  name: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});
