import { createHash } from 'node:crypto';
import { redis } from '@/db/redis';

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Per-instance counts used while Redis is unreachable (or the Upstash quota is spent), so a
 * Redis outage weakens the limit instead of locking everyone out of signing in.
 */
const fallbackCounts = new Map<string, number>();
let fallbackWindow = -1;

function countLocally(key: string, window: number) {
  if (window !== fallbackWindow) {
    fallbackCounts.clear();
    fallbackWindow = window;
  }
  const count = (fallbackCounts.get(key) ?? 0) + 1;
  fallbackCounts.set(key, count);
  return count;
}

export async function allowAuthAttempt(
  scope: string,
  identifier: string,
  limit: number,
) {
  const window = Math.floor(Date.now() / WINDOW_MS);
  const digest = createHash('sha256').update(identifier).digest('hex');
  const key = `auth-limit:${scope}:${window}:${digest}`;
  let count: number | undefined;
  try {
    count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 16 * 60);
  } catch (error) {
    console.warn('[auth-rate-limit] Redis unavailable, limiting in memory:', error instanceof Error ? error.message : error);
    count ??= countLocally(key, window);
  }
  return count <= limit;
}
