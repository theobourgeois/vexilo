import { z } from 'zod';

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
  name: z.string().trim().min(1, 'Enter your name.').max(100),
  email: emailSchema,
  password: passwordSchema,
});
