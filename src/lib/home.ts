import { unstable_cache } from 'next/cache';
import { and, count, desc, eq, gt, gte, inArray, isNotNull, ne, sql, sum } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { flagOfTheDay, flags, flagTags, follows, gameResults, postLikes, savedFlags } from '@/db/schema';
import { FLAGS_TAG } from '@/lib/cache-tags';
import { inEncyclopedia } from '@/lib/encyclopedia';
import { getMostRemixedFlags, getTopCreators, isPublished, listPosts, type PostCard } from '@/lib/posts';

/**
 * Data for the home page. Everything that's the same for every visitor is cached for a few minutes,
 * so anonymous home views don't reach the database; only the signed-in extras run per request.
 */

const MINUTES = 60;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Today's flag, from Next's data cache rather than Redis (the home page is the busiest page, and
 * Redis has a monthly command quota). Null if today's pick hasn't been made yet; the caller falls back.
 */
export const getHomeFlagOfTheDay = unstable_cache(
  async () => {
    const [row] = await db
      .select({ id: flags.id, name: flags.name, image: flags.image, description: flags.description, tags: flags.tags })
      .from(flagOfTheDay)
      .innerJoin(flags, eq(flags.id, flagOfTheDay.flagId))
      .where(inEncyclopedia)
      .orderBy(desc(flagOfTheDay.createdAt))
      .limit(1);
    return row ?? null;
  },
  ['home-fotd-v1'],
  { revalidate: 10 * MINUTES, tags: [FLAGS_TAG] },
);

/** The most-used flag tags, for the chips under the search box. */
export const getHomeTags = unstable_cache(
  () => db.select({ tag: flagTags.tag, count: flagTags.count }).from(flagTags).where(gt(flagTags.count, 0)).orderBy(desc(flagTags.count)).limit(14),
  ['home-tags-v1'],
  { revalidate: 60 * MINUTES, tags: [FLAGS_TAG] },
);

/** How many people finished each daily puzzle today (UTC date, which is what most players are on). */
export const getPlayedToday = unstable_cache(
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db
      .select({ game: gameResults.game, played: count() })
      .from(gameResults)
      .where(eq(gameResults.date, today))
      .groupBy(gameResults.game);
    const played = (game: string) => rows.find((row) => row.game === game)?.played ?? 0;
    return { unfurl: played('unfurl'), grid: played('grid') };
  },
  ['home-played-today-v1'],
  { revalidate: 5 * MINUTES },
);

/** The most-liked posts of the week, or of all time when the week is quiet. */
export const getTrendingPosts = unstable_cache(
  async (): Promise<{ posts: PostCard[]; range: 'week' | 'all' }> => {
    const week = await listPosts({ sort: 'popular', range: 'week', viewerId: null, limit: 4 });
    if (week.posts.length >= 4) return { posts: week.posts, range: 'week' };
    const all = await listPosts({ sort: 'popular', range: 'all', viewerId: null, limit: 4 });
    return { posts: all.posts, range: 'all' };
  },
  ['home-trending-v1'],
  { revalidate: 5 * MINUTES },
);

/** Creators with the most likes on what they posted in the last 30 days, or of all time when that's empty. */
export const getHomeTopCreators = unstable_cache(
  async () => {
    const month = await getTopCreators({ viewerId: null, range: 'month', limit: 4 });
    if (month.length > 0) return { creators: month, range: 'month' as const };
    return { creators: await getTopCreators({ viewerId: null, range: 'all', limit: 4 }), range: 'all' as const };
  },
  ['home-top-creators-v1'],
  { revalidate: 15 * MINUTES },
);

export const getHomeMostRemixed = unstable_cache(() => getMostRemixedFlags(4), ['home-most-remixed-v1'], { revalidate: 30 * MINUTES });

/** Cached cards carry nobody's likes; this marks the ones the viewer liked. */
export async function withViewerLikes(posts: PostCard[], viewerId: string | null): Promise<PostCard[]> {
  if (!viewerId || posts.length === 0) return posts;
  const rows = await db
    .select({ postId: postLikes.postId })
    .from(postLikes)
    .where(and(eq(postLikes.userId, viewerId), inArray(postLikes.postId, posts.map((post) => post.id))));
  const liked = new Set(rows.map((row) => row.postId));
  return posts.map((post) => ({ ...post, liked: liked.has(post.id) }));
}

/** The newest posts from people the viewer follows, and how many they posted in the last 7 days. */
export async function getFollowingPreview(viewerId: string) {
  const [page, [recent], [followingCount]] = await Promise.all([
    listPosts({ sort: 'following', viewerId, limit: 4 }),
    db
      .select({ n: count() })
      .from(savedFlags)
      .innerJoin(follows, and(eq(follows.followingId, savedFlags.userId), eq(follows.followerId, viewerId)))
      .where(and(isPublished, isNotNull(savedFlags.slug), gte(savedFlags.publishedAt, new Date(Date.now() - WEEK_MS)))),
    db.select({ n: count() }).from(follows).where(eq(follows.followerId, viewerId)),
  ]);
  return { posts: page.posts, newThisWeek: recent?.n ?? 0, following: followingCount?.n ?? 0 };
}

/** What happened to the viewer's posts in the last 7 days, and where they rank by likes over 30 days. */
export async function getViewerWeek(viewerId: string) {
  const since = new Date(Date.now() - WEEK_MS);
  const remix = alias(savedFlags, 'remix');
  const [[likes], [remixes], [followers], rank] = await Promise.all([
    db
      .select({ n: count() })
      .from(postLikes)
      .innerJoin(savedFlags, eq(savedFlags.id, postLikes.postId))
      .where(and(eq(savedFlags.userId, viewerId), ne(postLikes.userId, viewerId), gte(postLikes.createdAt, since))),
    db
      .select({ n: count() })
      .from(remix)
      .innerJoin(savedFlags, eq(savedFlags.id, remix.remixOfPostId))
      .where(
        and(eq(savedFlags.userId, viewerId), ne(remix.userId, viewerId), isNotNull(remix.publishedAt), gte(remix.publishedAt, since)),
      ),
    db
      .select({ n: count() })
      .from(follows)
      .where(and(eq(follows.followingId, viewerId), gte(follows.createdAt, since))),
    getMonthRank(viewerId),
  ]);
  return { likes: likes?.n ?? 0, remixes: remixes?.n ?? 0, followers: followers?.n ?? 0, rank };
}

/** 1 + how many creators got more likes than the viewer on posts from the last 30 days; null if they posted none. */
async function getMonthRank(viewerId: string): Promise<number | null> {
  const since = new Date(Date.now() - MONTH_MS);
  const likes = sum(savedFlags.likes).mapWith(Number);
  const [mine] = await db
    .select({ likes, posts: count() })
    .from(savedFlags)
    .where(and(isPublished, eq(savedFlags.userId, viewerId), gte(savedFlags.publishedAt, since)));
  if (!mine || mine.posts === 0) return null;
  const totals = db
    .select({ userId: savedFlags.userId, likes: sql<number>`sum(${savedFlags.likes})`.as('likes') })
    .from(savedFlags)
    .where(and(isPublished, gte(savedFlags.publishedAt, since)))
    .groupBy(savedFlags.userId)
    .as('totals');
  const [ahead] = await db
    .select({ n: count() })
    .from(totals)
    .where(sql`${totals.likes} > ${mine.likes ?? 0}`);
  return (ahead?.n ?? 0) + 1;
}
