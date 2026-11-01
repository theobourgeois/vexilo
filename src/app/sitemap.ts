import type { MetadataRoute } from 'next';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { contests, flags } from '@/db/schema';
import { CONTESTS_TAG } from '@/lib/cache-tags';
import { COLLECTIONS, collectionPath } from '@/lib/collections';
import { absoluteUrl, contestPath, flagPath } from '@/lib/seo';

// Rendered on request so the build doesn't need the database; the flag and contest lists are cached for a day.
export const dynamic = 'force-dynamic';

// No /contest: it redirects to the current contest, and each contest page is listed below.
const STATIC_PATHS = ['/', '/flags', '/play', '/play/quiz', '/play/grid', '/play/unfurl', '/flag-of-the-day', '/leaderboard', '/tags', '/create'];

const getFlagEntries = unstable_cache(
  () => db.select({ name: flags.name, updatedAt: flags.updatedAt }).from(flags),
  ['sitemap-flags-v1'],
  { revalidate: 60 * 60 * 24 },
);

const getContestEntries = unstable_cache(
  () => db.select({ slug: contests.slug, updatedAt: contests.updatedAt }).from(contests).where(eq(contests.published, true)),
  ['sitemap-contests-v1'],
  { revalidate: 60 * 60 * 24, tags: [CONTESTS_TAG] },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [flagRows, contestRows] = await Promise.all([getFlagEntries(), getContestEntries()]);
  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...COLLECTIONS.map(({ slug }) => ({ url: absoluteUrl(collectionPath(slug)) })),
    ...contestRows.map((contest) => ({ url: absoluteUrl(contestPath(contest.slug)), lastModified: new Date(contest.updatedAt) })),
    ...flagRows.map((flag) => ({ url: absoluteUrl(flagPath(flag.name)), lastModified: new Date(flag.updatedAt) })),
  ];
}
