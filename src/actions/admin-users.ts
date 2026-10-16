'use server';

import { db } from '@/db';
import { flagRequests, leaderboard, users } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';

const PAGE_SIZE = 20;

export async function getAdminUsers(query: string, page: number) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const search = query.trim();
  const where = search
    ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
    : undefined;

  const pendingCounts = db
    .select({
      userId: flagRequests.userId,
      pending: count().as('pending'),
    })
    .from(flagRequests)
    .where(and(eq(flagRequests.approved, false), eq(flagRequests.deleted, false)))
    .groupBy(flagRequests.userId)
    .as('pending_counts');

  const [rows, total] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        userNumber: users.userNumber,
        isAdmin: users.isAdmin,
        isTrusted: users.isTrusted,
        contributions: sql<number>`coalesce(${leaderboard.contributions}, 0)`,
        pending: sql<number>`coalesce(${pendingCounts.pending}, 0)`,
      })
      .from(users)
      .leftJoin(leaderboard, eq(leaderboard.userId, users.id))
      .leftJoin(pendingCounts, eq(pendingCounts.userId, users.id))
      .where(where)
      .orderBy(
        desc(users.isTrusted),
        desc(sql`coalesce(${pendingCounts.pending}, 0)`),
        desc(sql`coalesce(${leaderboard.contributions}, 0)`),
      )
      .limit(PAGE_SIZE)
      .offset((Math.max(page, 1) - 1) * PAGE_SIZE),
    db
      .select({ count: count() })
      .from(users)
      .where(where)
      .then((res) => res[0].count),
  ]);

  return {
    users: rows.map((row) => ({
      ...row,
      contributions: Number(row.contributions),
      pending: Number(row.pending),
    })),
    total,
    pageSize: PAGE_SIZE,
  };
}

export async function setUserTrusted(userId: string, isTrusted: boolean) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const [updated] = await db
    .update(users)
    .set({ isTrusted })
    .where(eq(users.id, userId))
    .returning({ id: users.id, isTrusted: users.isTrusted });

  return updated ?? false;
}
