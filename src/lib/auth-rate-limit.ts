import { createHash } from 'node:crypto';
import { redis } from '@/db/redis';

export async function allowAuthAttempt(
  scope: string,
  identifier: string,
  limit: number,
) {
  const window = Math.floor(Date.now() / (15 * 60 * 1000));
  const digest = createHash('sha256').update(identifier).digest('hex');
  const key = `auth-limit:${scope}:${window}:${digest}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 16 * 60);
    return count <= limit;
  } catch {
    // Authentication fails closed if the shared limiter is unavailable.
    return false;
  }
}
