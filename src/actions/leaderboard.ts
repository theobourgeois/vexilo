'use server';

import { db } from '@/db';
import { redis } from '@/db/redis';
import { flagRequests, flags, leaderboard, users } from '@/db/schema';
import { TOP_CONTRIBUTORS_CACHE_KEY } from '@/lib/cache-keys';
import { and, asc, count, desc, eq, gte, inArray, min, sql } from 'drizzle-orm';

const LEADER_BOARD_LIMIT = 5;
export async function getLeaderboard(limit?: number) {
  const leaderboardCache = await redis.get('leaderboard');
  if (leaderboardCache) {
    return leaderboardCache as typeof ldbrd;
  }

  const entries = await db
    .select()
    .from(leaderboard)
    .leftJoin(users, eq(leaderboard.userId, users.id))
    .orderBy(desc(leaderboard.contributions))
    .limit(limit || LEADER_BOARD_LIMIT);

  const ldbrd = await Promise.all(
    entries.map(async (entry) => {
      // Fetch favorite flag if user has one
      let favoriteFlag = null;
      if (entry.user?.favoriteFlagId) {
        const flag = await db
          .select({
            id: flags.id,
            name: flags.name,
            image: flags.image,
          })
          .from(flags)
          .where(eq(flags.id, entry.user.favoriteFlagId))
          .limit(1)
          .then((res) => res[0]);
        favoriteFlag = flag || null;
      }

      return {
        leaderboard: entry.leaderboard,
        user: {
          ...entry.user,
          name: entry.user?.isAnonymous
            ? 'Anonymous User'
            : entry.user?.name || 'Anonymous User',
          image: entry.user?.isAnonymous
            ? '/logo.svg'
            : entry.user?.image || undefined,
          favoriteFlag,
        },
      };
    }),
  );

  await redis.set('leaderboard', ldbrd);

  return ldbrd;
}

export async function getFullLeaderboard() {
  const entries = await db
    .select()
    .from(leaderboard)
    .leftJoin(users, eq(leaderboard.userId, users.id))
    .orderBy(desc(leaderboard.contributions))
    .limit(100);

  const ldbrd = await Promise.all(
    entries.map(async (entry) => {
      // Fetch favorite flag if user has one
      let favoriteFlag = null;
      if (entry.user?.favoriteFlagId) {
        const flag = await db
          .select({
            id: flags.id,
            name: flags.name,
            image: flags.image,
          })
          .from(flags)
          .where(eq(flags.id, entry.user.favoriteFlagId))
          .limit(1)
          .then((res) => res[0]);
        favoriteFlag = flag || null;
      }

      return {
        leaderboard: entry.leaderboard,
        user: {
          ...entry.user,
          name: entry.user?.isAnonymous
            ? 'Anonymous User'
            : entry.user?.name || 'Anonymous User',
          image: entry.user?.isAnonymous
            ? '/logo.svg'
            : entry.user?.image || undefined,
          favoriteFlag,
        },
      };
    }),
  );

  return ldbrd;
}

const TOP_CONTRIBUTORS = 3;
const TOP_CONTRIBUTOR_FLAGS = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type TopContributor = {
  userNumber: string;
  name: string;
  image: string | null;
  contributions: number;
  /** A few of the flags they added or edited this week, newest first. */
  flags: { name: string; image: string }[];
};

/**
 * The three people with the most approved requests in the past seven days, leaving out admins.
 * Empty when fewer than three people contributed, so a quiet week shows nothing.
 */
export async function getTopContributorsThisWeek(): Promise<TopContributor[]> {
  const cached = await redis.get<TopContributor[]>(TOP_CONTRIBUTORS_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const since = new Date(Date.now() - WEEK_MS);
  const approvedSince = and(eq(flagRequests.approved, true), gte(flagRequests.approvedAt, since));
  const contributions = count(flagRequests.id);

  const top = await db
    .select({
      userId: users.id,
      userNumber: users.userNumber,
      name: users.name,
      image: users.image,
      isAnonymous: users.isAnonymous,
      contributions,
    })
    .from(flagRequests)
    .innerJoin(users, eq(flagRequests.userId, users.id))
    .where(and(approvedSince, eq(users.isAdmin, false)))
    .groupBy(users.id)
    // Ties go to whoever started contributing first.
    .orderBy(desc(contributions), asc(min(flagRequests.approvedAt)))
    .limit(TOP_CONTRIBUTORS);

  let result: TopContributor[] = [];
  if (top.length === TOP_CONTRIBUTORS) {
    const recent = await db
      .select({
        userId: flagRequests.userId,
        name: sql<string>`${flagRequests.flag}->>'flagName'`,
        image: sql<string>`${flagRequests.flag}->>'flagImage'`,
      })
      .from(flagRequests)
      .where(and(approvedSince, inArray(flagRequests.userId, top.map((user) => user.userId))))
      .orderBy(desc(flagRequests.approvedAt));

    result = top.map((user) => {
      const userFlags = new Map<string, { name: string; image: string }>();
      for (const flag of recent) {
        if (flag.userId === user.userId && flag.image && userFlags.size < TOP_CONTRIBUTOR_FLAGS) {
          userFlags.set(flag.image, { name: flag.name, image: flag.image });
        }
      }

      return {
        userNumber: user.userNumber,
        name: user.isAnonymous ? 'Anonymous User' : user.name || 'Anonymous User',
        image: user.isAnonymous ? '/logo.svg' : user.image,
        contributions: user.contributions,
        flags: [...userFlags.values()],
      };
    });
  }

  // Approvals clear this; the expiry keeps the seven-day window moving.
  await redis.set(TOP_CONTRIBUTORS_CACHE_KEY, result, { ex: 10 * 60 });

  return result;
}
