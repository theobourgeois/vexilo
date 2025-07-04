"use server";

import { db } from "@/db";
import { leaderboard, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const LEADER_BOARD_LIMIT = 3;
export async function getLeaderboard(limit?: number) {
  const ldbrd = (
    await db
      .select()
      .from(leaderboard)
      .leftJoin(users, eq(leaderboard.userId, users.id))
      .orderBy(desc(leaderboard.contributions))
      .limit(limit || LEADER_BOARD_LIMIT)
  ).map((entry) => ({
    leaderboard: entry.leaderboard,
    user: {
      ...entry.user,
      name: entry.user?.isAnonymous
        ? "Anonymous User"
        : entry.user?.name || "Anonymous User",
      image: entry.user?.isAnonymous
        ? "/logo.svg"
        : entry.user?.image || undefined,
    },
  }));

  return ldbrd;
}

export async function getFullLeaderboard() {
  const ldbrd = (
    await db
      .select()
      .from(leaderboard)
      .leftJoin(users, eq(leaderboard.userId, users.id))
      .orderBy(desc(leaderboard.contributions))
      .limit(100)
  ).map((entry) => ({
    leaderboard: entry.leaderboard,
    user: {
      ...entry.user,
      name: entry.user?.isAnonymous
        ? "Anonymous User"
        : entry.user?.name || "Anonymous User",
      image: entry.user?.isAnonymous
        ? "/logo.svg"
        : entry.user?.image || undefined,
    },
  }));

  return ldbrd;
}
