import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { flags } from '@/db/schema';
import { COLLECTIONS, collectionPath } from '@/lib/collections';
import { absoluteUrl, flagPath } from '@/lib/seo';

// Rendered on request so the build doesn't need the database; the flag list is cached for a day.
export const dynamic = 'force-dynamic';

const STATIC_PATHS = ['/', '/flags', '/play', '/play/quiz', '/play/grid', '/play/unfurl', '/flag-of-the-day', '/contest', '/leaderboard', '/tags', '/create'];

const getFlagEntries = unstable_cache(
  () => db.select({ name: flags.name, updatedAt: flags.updatedAt }).from(flags),
  ['sitemap-flags-v1'],
  { revalidate: 60 * 60 * 24 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const flagRows = await getFlagEntries();
  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...COLLECTIONS.map(({ slug }) => ({ url: absoluteUrl(collectionPath(slug)) })),
    ...flagRows.map((flag) => ({ url: absoluteUrl(flagPath(flag.name)), lastModified: new Date(flag.updatedAt) })),
  ];
}
