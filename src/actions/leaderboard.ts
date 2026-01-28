"use server";

import { db } from "@/db";
import { redis } from "@/db/redis";
import { flags, leaderboard, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const LEADER_BOARD_LIMIT = 3;
export async function getLeaderboard(limit?: number) {
	const leaderboardCache = await redis.get("leaderboard");
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
						? "Anonymous User"
						: entry.user?.name || "Anonymous User",
					image: entry.user?.isAnonymous
						? "/logo.svg"
						: entry.user?.image || undefined,
					favoriteFlag,
				},
			};
		})
	);

	await redis.set("leaderboard", ldbrd);

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
						? "Anonymous User"
						: entry.user?.name || "Anonymous User",
					image: entry.user?.isAnonymous
						? "/logo.svg"
						: entry.user?.image || undefined,
					favoriteFlag,
				},
			};
		})
	);

	return ldbrd;
}
