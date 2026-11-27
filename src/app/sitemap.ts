import type { MetadataRoute } from 'next';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { contests, flags, savedFlags, users } from '@/db/schema';
import { CONTESTS_TAG } from '@/lib/cache-tags';
import { COLLECTIONS, collectionPath } from '@/lib/collections';
import { absoluteUrl, contestPath, flagPath } from '@/lib/seo';
import { inEncyclopedia } from '@/lib/encyclopedia';
import { postPath, profilePath } from '@/lib/post-slug';
import { INDEXABLE_LIKES } from '@/lib/posts';

// Rendered on request so the build doesn't need the database; the flag and contest lists are cached for a day.
export const dynamic = 'force-dynamic';

// No /contest: it redirects to the current contest, and each contest page is listed below.
// No /create: robots.txt keeps crawlers out of the flag maker.
const STATIC_PATHS = ['/', '/browse', '/flags', '/play', '/play/quiz', '/play/grid', '/play/unfurl', '/flag-of-the-day', '/leaderboard', '/tags', '/community'];

const getFlagEntries = unstable_cache(
  () => db.select({ name: flags.name, updatedAt: flags.updatedAt }).from(flags).where(inEncyclopedia),
  ['sitemap-flags-v2'],
  { revalidate: 60 * 60 * 24 },
);

const getContestEntries = unstable_cache(
  () => db.select({ slug: contests.slug, updatedAt: contests.updatedAt }).from(contests).where(eq(contests.published, true)),
  ['sitemap-contests-v1'],
  { revalidate: 60 * 60 * 24, tags: [CONTESTS_TAG] },
);

// Only posts people liked (the rest are noindex), and the profiles of whoever made them.
const getPostEntries = unstable_cache(
  () =>
    db
      .select({ slug: savedFlags.slug, username: users.name, updatedAt: savedFlags.updatedAt })
      .from(savedFlags)
      .innerJoin(users, eq(users.id, savedFlags.userId))
      .where(
        and(
          isNotNull(savedFlags.publishedAt),
          isNotNull(savedFlags.slug),
          gte(savedFlags.likes, INDEXABLE_LIKES),
          eq(users.isAnonymous, false),
          sql`${users.name} is not null`,
        ),
      ),
  ['sitemap-posts-v1'],
  { revalidate: 60 * 60 * 24 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [flagRows, contestRows, postRows] = await Promise.all([getFlagEntries(), getContestEntries(), getPostEntries()]);
  const profiles = new Map<string, number>();
  for (const post of postRows) {
    const at = new Date(post.updatedAt).getTime();
    profiles.set(post.username, Math.max(profiles.get(post.username) ?? 0, at));
  }
  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...COLLECTIONS.map(({ slug }) => ({ url: absoluteUrl(collectionPath(slug)) })),
    ...contestRows.map((contest) => ({ url: absoluteUrl(contestPath(contest.slug)), lastModified: new Date(contest.updatedAt) })),
    ...flagRows.map((flag) => ({ url: absoluteUrl(flagPath(flag.name)), lastModified: new Date(flag.updatedAt) })),
    ...[...profiles].map(([username, at]) => ({ url: absoluteUrl(profilePath(username)), lastModified: new Date(at) })),
    ...postRows.map((post) => ({ url: absoluteUrl(postPath(post.username, post.slug!)), lastModified: new Date(post.updatedAt) })),
  ];
}
