import { revalidateTag } from 'next/cache';

/**
 * Next data-cache tags. Shared, per-visitor-identical data is cached under these so anonymous page
 * views don't reach the database; expire the tag after a write so edits show up right away.
 */
export const FLAGS_TAG = 'flags';
export const CONTESTS_TAG = 'contests';

/** Expires a cache tag. Outside a request (scripts, pipelines run from the CLI) the caches just time out. */
export function expireCache(tag: string) {
  try {
    revalidateTag(tag);
  } catch {
    // No Next request context.
  }
}

/** The data cache stores JSON, so dates come back as strings. */
export function toDate(value: Date | string): Date;
export function toDate(value: Date | string | null): Date | null;
export function toDate(value: Date | string | null) {
  return value === null ? null : new Date(value);
}
