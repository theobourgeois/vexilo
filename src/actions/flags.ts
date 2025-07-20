"use server";

import { db } from "@/db";
import {
	favorites,
	flagOfTheDay,
	flagRequests,
	flags,
	flagTags,
	users,
} from "@/db/schema";
import { getServerAuthSession } from "@/lib/auth";
import { Flag } from "@/lib/types";
import { and, asc, count, desc, eq, ilike, sql, inArray } from "drizzle-orm";

// Helper function to update tag counts when tags are added or removed
async function updateTagCounts(oldTags: string[], newTags: string[]) {
	console.log("Updating tag counts", oldTags, newTags);
	const oldTagSet = new Set(oldTags);
	const newTagSet = new Set(newTags);

	// Find tags that were added (in newTags but not in oldTags)
	const addedTags = newTags.filter((tag) => !oldTagSet.has(tag));

	// Find tags that were removed (in oldTags but not in newTags)
	const removedTags = oldTags.filter((tag) => !newTagSet.has(tag));

	// Increment count for added tags
	for (const tag of addedTags) {
		if (tag.trim()) {
			const existingTag = await db
				.select()
				.from(flagTags)
				.where(eq(flagTags.tag, tag.trim()))
				.limit(1);

			if (existingTag.length > 0) {
				// Tag exists, increment count
				await db
					.update(flagTags)
					.set({ count: sql`count + 1` })
					.where(eq(flagTags.tag, tag.trim()));
			} else {
				// Tag doesn't exist, create it with count 1
				await db.insert(flagTags).values({
					tag: tag.trim(),
					count: 1,
				});
			}
		}
	}

	// Decrement count for removed tags
	for (const tag of removedTags) {
		if (tag.trim()) {
			const existingTag = await db
				.select()
				.from(flagTags)
				.where(eq(flagTags.tag, tag.trim()))
				.limit(1);

			if (existingTag.length > 0) {
				if (existingTag[0].count > 1) {
					// Decrement count if more than 1
					await db
						.update(flagTags)
						.set({ count: sql`count - 1` })
						.where(eq(flagTags.tag, tag.trim()));
				} else {
					// Remove tag if count would become 0
					await db.delete(flagTags).where(eq(flagTags.tag, tag.trim()));
				}
			}
		}
	}
}

// Helper function to add tags when a new flag is created
async function addTagsToCount(tags: string[]) {
	for (const tag of tags) {
		if (tag.trim()) {
			const existingTag = await db
				.select()
				.from(flagTags)
				.where(eq(flagTags.tag, tag.trim()))
				.limit(1);

			if (existingTag.length > 0) {
				// Tag exists, increment count
				await db
					.update(flagTags)
					.set({ count: sql`count + 1` })
					.where(eq(flagTags.tag, tag.trim()));
			} else {
				// Tag doesn't exist, create it with count 1
				await db.insert(flagTags).values({
					tag: tag.trim(),
					count: 1,
				});
			}
		}
	}
}

// Helper function to remove tags when a flag is deleted
async function removeTagsFromCount(tags: string[]) {
	for (const tag of tags) {
		if (tag.trim()) {
			const existingTag = await db
				.select()
				.from(flagTags)
				.where(eq(flagTags.tag, tag.trim()))
				.limit(1);

			if (existingTag.length > 0) {
				if (existingTag[0].count > 1) {
					// Decrement count if more than 1
					await db
						.update(flagTags)
						.set({ count: sql`count - 1` })
						.where(eq(flagTags.tag, tag.trim()));
				} else {
					// Remove tag if count would become 0
					await db.delete(flagTags).where(eq(flagTags.tag, tag.trim()));
				}
			}
		}
	}
}

export async function getTopFlagTags(limit: number) {
	const clampedLimit = Math.min(limit, 100);
	const topTags = await db
		.select({ tag: flagTags.tag, count: flagTags.count })
		.from(flagTags)
		.orderBy(desc(flagTags.count))
		.limit(clampedLimit);

	return topTags;
}

export async function getAllFlagTags(
	search?: string,
	page: number = 1,
	limit: number = 50,
) {
	const offset = (page - 1) * limit;

	const tags = await db
		.select({ tag: flagTags.tag, count: flagTags.count })
		.from(flagTags)
		.where(search ? ilike(flagTags.tag, `%${search}%`) : sql`1=1`)
		.orderBy(desc(flagTags.count))
		.limit(limit)
		.offset(offset);

	const totalCount = await db
		.select({ count: count() })
		.from(flagTags)
		.where(search ? ilike(flagTags.tag, `%${search}%`) : sql`1=1`);

	return {
		tags,
		totalCount: totalCount[0]?.count || 0,
		totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
		currentPage: page,
	};
}

export async function getFlagFromName(flagName: string) {
	const session = await getServerAuthSession();
	const userId = session?.user?.id;

	const flag = await db
		.select({
			id: flags.id,
			name: flags.name,
			image: flags.image,
			link: flags.link,
			index: flags.index,
			tags: flags.tags,
			description: flags.description,
			favorites: flags.favorites,
			relatedFlags: flags.relatedFlags,
			isFavorite: userId
				? sql<boolean>`EXISTS (
				SELECT 1 FROM vexilo_favorite 
				WHERE vexilo_favorite.flag_id = vexilo_flag.id 
				AND vexilo_favorite.user_id = ${userId}
			)`
				: sql<boolean>`false`,
		})
		.from(flags)
		.where(eq(flags.name, flagName))
		.limit(1);

	if (!flag?.[0]) {
		return null;
	}

	return flag[0];
}

export async function getRelatedFlags(flagId: string) {
	const session = await getServerAuthSession();
	const userId = session?.user?.id;

	// Get the flag data to extract related flags
	const flagData = await db
		.select({
			id: flags.id,
			relatedFlags: flags.relatedFlags,
		})
		.from(flags)
		.where(eq(flags.id, flagId))
		.limit(1);

	if (!flagData?.[0]) {
		return [];
	}

	// Find flags that have this flag in their related flags
	const relatedToThisFlag = (
		await db
			.select({ id: flags.id })
			.from(flags)
			.where(sql`related_flags @> ${JSON.stringify([flagId])}::jsonb`)
	).map((flag) => flag.id);

	// Extract IDs from relatedFlags - handle both string IDs and objects with id property
	const relatedFlagIds = Array.from(
		new Set(flagData[0].relatedFlags.concat(relatedToThisFlag).filter(Boolean)),
	);

	if (relatedFlagIds.length === 0) {
		return [];
	}

	// Fetch the full related flag data
	const relatedFlags = await db
		.select({
			id: flags.id,
			name: flags.name,
			image: flags.image,
			link: flags.link,
			index: flags.index,
			tags: flags.tags,
			description: flags.description,
			createdAt: flags.createdAt,
			updatedAt: flags.updatedAt,
			favorites: flags.favorites,
			relatedFlags: flags.relatedFlags,
			isFavorite: userId
				? sql<boolean>`EXISTS (
				SELECT 1 FROM vexilo_favorite 
				WHERE vexilo_favorite.flag_id = vexilo_flag.id 
				AND vexilo_favorite.user_id = ${userId}
			)`
				: sql<boolean>`false`,
		})
		.from(flags)
		.where(inArray(flags.id, relatedFlagIds));

	return relatedFlags;
}

export async function getRandomFlag() {
	const flagCount = await getFlagsCount("");
	const randomIndex = Math.floor(Math.random() * flagCount);
	const randomFlag = await db
		.select()
		.from(flags)
		.where(eq(flags.index, randomIndex))
		.limit(1);
	return randomFlag?.[0];
}

export async function getRandomFlagsForQuiz() {
	// Get 4 random flags directly from the database with favorites info
	const randomFlags = await db
		.select({
			id: flags.id,
			name: flags.name,
			image: flags.image,
			link: flags.link,
			index: flags.index,
			tags: flags.tags,
			description: flags.description,
			createdAt: flags.createdAt,
			updatedAt: flags.updatedAt,
			favorites: flags.favorites,
			isFavorite: await isFavorite(),
		})
		.from(flags)
		.orderBy(sql`RANDOM()`)
		.limit(4);
	return randomFlags;
}

async function isFavorite(userId?: string) {
	let user = userId;
	if (!user) {
		const session = await getServerAuthSession();
		if (!session?.user) {
			return sql<boolean>`false`;
		}
		user = user ?? session.user.id;
	}
	return sql<boolean>`EXISTS (SELECT 1 FROM vexilo_favorite WHERE vexilo_favorite.flag_id = vexilo_flag.id AND vexilo_favorite.user_id = ${user})`;
}

export async function getFlagOfTheDay() {
	const fotd = await db
		.select()
		.from(flagOfTheDay)
		.orderBy(desc(flagOfTheDay.createdAt))
		.limit(1);

	let fotdId = fotd?.[0]?.flagId;

	if (!fotdId) {
		await generateFlagOfTheDay();
		fotdId = (
			await db
				.select({ flagId: flagOfTheDay.flagId })
				.from(flagOfTheDay)
				.orderBy(desc(flagOfTheDay.createdAt))
				.limit(1)
		)?.[0]?.flagId;
	}

	const flag = await db
		.select({
			id: flags.id,
			name: flags.name,
			image: flags.image,
			link: flags.link,
			index: flags.index,
			tags: flags.tags,
			description: flags.description,
			favorites: flags.favorites,
			isFavorite: await isFavorite(),
		})
		.from(flags)
		.where(eq(flags.id, fotdId))
		.limit(1);

	return flag?.[0];
}

function buildWhereClause(query?: string) {
	if (!query) {
		return sql`1=1`;
	}
	// Use ILIKE OR trigram similarity above a threshold
	return sql`
    lower(${flags.name}) LIKE lower(${`%${query}%`})
    OR similarity(${flags.name}, ${query}) > 0.2
  `;
}

function orderByClause(
	orderBy: keyof typeof flags.$inferSelect,
	orderDirection: "asc" | "desc",
) {
	if (orderDirection === "asc") {
		return asc(flags[orderBy]);
	}
	return desc(flags[orderBy]);
}

export async function getFlags(
	page: number,
	limit: number,
	query?: string,
	orderBy: keyof typeof flags.$inferSelect = "updatedAt",
	orderDirection: "asc" | "desc" = "desc",
	tag?: string,
) {
	const whereClause = buildWhereClause(query);

	const boundedLimit = Math.min(limit, 100);

	return await db
		.select({
			id: flags.id,
			favorites: flags.favorites,
			name: flags.name,
			image: flags.image,
			link: flags.link,
			index: flags.index,
			tags: flags.tags,
			description: flags.description,
			isFavorite: await isFavorite(),
		})
		.from(flags)
		.where(
			and(whereClause, tag ? sql`${flags.tags} @> ARRAY[${tag}]` : sql`1=1`),
		)
		.orderBy(
			query
				? sql`similarity(${flags.name}, ${query}) DESC`
				: orderByClause(orderBy, orderDirection),
		)
		.limit(boundedLimit)
		.offset((page - 1) * boundedLimit);
}

export async function getUserFavorites(
	userId: string,
	page: number,
	limit: number,
	query?: string,
	orderBy: keyof typeof flags.$inferSelect = "updatedAt",
	orderDirection: "asc" | "desc" = "desc",
	tag?: string,
) {
	const user = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
		.then((res) => res[0]);

	if (!user) {
		return [];
	}

	const boundedLimit = Math.min(limit, 100);

	function orderByClause(orderBy: keyof typeof flags.$inferSelect) {
		if (orderBy === "updatedAt") {
			return desc(favorites.createdAt);
		}
		return orderDirection === "asc"
			? asc(flags[orderBy])
			: desc(flags[orderBy]);
	}

	const flgs = await db
		.select({
			id: flags.id,
			favorites: flags.favorites,
			name: flags.name,
			image: flags.image,
			link: flags.link,
			index: flags.index,
			tags: flags.tags,
			description: flags.description,
			isFavorite: await isFavorite(),
		})
		.from(flags)
		.leftJoin(
			favorites,
			and(eq(favorites.flagId, flags.id), eq(favorites.userId, userId)),
		)
		.where(
			and(
				ilike(flags.name, `%${query}%`),
				await isFavorite(userId),
				tag ? sql`${flags.tags} @> ARRAY[${tag}]` : sql`1=1`,
			),
		)
		.orderBy(
			query
				? sql`similarity(${flags.name}, ${query}) DESC`
				: orderByClause(orderBy),
		)
		.limit(boundedLimit)
		.offset((page - 1) * boundedLimit);

	return flgs;
}

export async function getFavouriteFlags(
	page: number,
	limit: number,
	query?: string,
	orderBy: keyof typeof flags.$inferSelect = "updatedAt",
	orderDirection: "asc" | "desc" = "desc",
	tag?: string,
) {
	const session = await getServerAuthSession();
	if (!session?.user) {
		return [];
	}

	return await getUserFavorites(
		session.user.id,
		page,
		limit,
		query,
		orderBy,
		orderDirection,
		tag,
	);
}

export async function getFlagsCount(query?: string, tag?: string) {
	const whereClause = buildWhereClause(query);

	const cnt = await db
		.select({ count: count() })
		.from(flags)
		.where(
			and(whereClause, tag ? sql`${flags.tags} @> ARRAY[${tag}]` : sql`1=1`),
		);

	return cnt[0].count;
}

export async function getFavoriteFlagsCount(query?: string, tag?: string) {
	const session = await getServerAuthSession();
	if (!session?.user) {
		return 0;
	}

	const cnt = await db
		.select({ count: count() })
		.from(flags)
		.where(
			and(
				ilike(flags.name, `%${query}%`),
				await isFavorite(),
				tag ? sql`${flags.tags} @> ARRAY[${tag}]` : sql`1=1`,
			),
		);

	return cnt[0].count;
}

export async function createAdminFlags(flagList: Flag[]) {
	const session = await getServerAuthSession();
	if (!session?.user?.isAdmin) {
		return false;
	}

	try {
		// Validate and truncate flags to fit database constraints
		const validatedFlags = flagList.map((flag, index) => {
			// Check for any flags that might be too long
			if (
				flag.flagName.length > 255 ||
				flag.flagImage.length > 255 ||
				flag.link.length > 255
			) {
				console.log(`Flag at index ${index} has long values:`, {
					nameLength: flag.flagName.length,
					imageLength: flag.flagImage.length,
					linkLength: flag.link.length,
					name: flag.flagName.substring(0, 50) + "...",
					image: flag.flagImage.substring(0, 50) + "...",
					link: flag.link.substring(0, 50) + "...",
				});
			}

			return {
				name: flag.flagName,
				image: flag.flagImage,
				link: flag.link,
				index: flag.index,
				tags: flag.tags || [],
			};
		});

		await db.insert(flags).values(validatedFlags);

		// Update tag counts for all created flags
		for (const flag of validatedFlags) {
			await addTagsToCount(flag.tags);
		}

		return true;
	} catch (error) {
		console.error("Error creating admin flags:", error);
		throw new Error(
			`Failed to import flags: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		);
	}
}

export async function generateFlagOfTheDay() {
	const flagCount = await getFlagsCount("");
	const randomIndex = Math.floor(Math.random() * flagCount);
	const fotd = await db
		.select()
		.from(flags)
		.where(eq(flags.index, randomIndex))
		.limit(1);

	await db.insert(flagOfTheDay).values({
		flagId: fotd[0].id,
	});
}

export async function toggleFavoriteFlag(flagId: string) {
	const session = await getServerAuthSession();
	if (!session?.user) {
		return false;
	}

	const existingFavorite = await db
		.select()
		.from(favorites)
		.where(
			and(eq(favorites.userId, session.user.id), eq(favorites.flagId, flagId)),
		);

	if (existingFavorite.length > 0) {
		await db.delete(favorites).where(eq(favorites.id, existingFavorite[0].id));

		await db
			.update(flags)
			.set({
				favorites: sql`favorites - 1`,
			})
			.where(eq(flags.id, flagId));

		return true;
	}

	await db.insert(favorites).values({
		userId: session.user.id,
		flagId: flagId,
	});

	await db
		.update(flags)
		.set({
			favorites: sql`favorites + 1`,
		})
		.where(eq(flags.id, flagId));

	return true;
}

const REQUESTS_PER_PAGE = 12;

export async function getUserFlags(userNumber: string, page: number) {
	const session = await getServerAuthSession();

	const user = await db
		.select()
		.from(users)
		.where(eq(users.userNumber, userNumber))
		.limit(1)
		.then((res) => res[0]);

	if (!user) {
		return {
			success: false,
			message: "User not found.",
		};
	}

	const userFlags = await db
		.select({
			id: flags.id,
			flagName: flags.name,
			flagImage: flags.image,
			link: flags.link,
			description: flags.description,
			tags: flags.tags,
			index: flags.index,
			favorites: flags.favorites,
			isFavorite: session
				? sql<boolean>`EXISTS (SELECT 1 FROM vexilo_favorite WHERE vexilo_favorite.flag_id = vexilo_flag.id AND vexilo_favorite.user_id = ${session.user.id})`
				: sql<boolean>`false`,
		})
		.from(flags)
		.innerJoin(flagRequests, eq(flags.id, sql`${flagRequests.flagId}::uuid`))
		.where(
			and(
				eq(flagRequests.userId, user.id),
				eq(flagRequests.approved, true),
				eq(flagRequests.isEdit, false),
			),
		)
		.orderBy(desc(flagRequests.createdAt))
		.limit(REQUESTS_PER_PAGE)
		.offset((page - 1) * REQUESTS_PER_PAGE);

	if (user.isAnonymous) {
		user.name = "Anonymous User";
		user.image = "/logo.svg";
	}

	const totalFlagsCount = await db
		.select({ count: count() })
		.from(flagRequests)
		.where(
			and(
				eq(flagRequests.userId, user.id),
				eq(flagRequests.approved, true),
				eq(flagRequests.isEdit, false),
			),
		);

	return {
		flags: userFlags,
		count: totalFlagsCount[0].count,
	};
}

export async function getUserContributionCounts(userNumber: string) {
	const user = await db
		.select()
		.from(users)
		.where(eq(users.userNumber, userNumber))
		.limit(1)
		.then((res) => res[0]);

	const totalFlagCount = await db
		.select({ count: count() })
		.from(flagRequests)
		.where(
			and(
				eq(flagRequests.userId, user.id),
				eq(flagRequests.approved, true),
				eq(flagRequests.isEdit, false),
			),
		);

	const totalEditCount = await db
		.select({ count: count() })
		.from(flagRequests)
		.where(
			and(
				eq(flagRequests.userId, user.id),
				eq(flagRequests.approved, true),
				eq(flagRequests.isEdit, true),
			),
		);

	return {
		totalFlagCount: totalFlagCount[0].count,
		totalEditCount: totalEditCount[0].count,
	};
}

export async function getProfileUserFavorites(
	userNumber: string,
	page: number,
) {
	const user = await db
		.select()
		.from(users)
		.where(eq(users.userNumber, userNumber))
		.limit(1)
		.then((res) => res[0]);

	if (!user) {
		return {
			success: false,
			message: "User not found.",
		};
	}

	const userFlags = await getUserFavorites(
		user.id,
		page,
		REQUESTS_PER_PAGE,
		"",
		"updatedAt",
	);

	const totalFlagsCount = await db
		.select({ count: count() })
		.from(flags)
		.where(await isFavorite(user.id));

	return {
		flags: userFlags,
		count: totalFlagsCount[0].count,
	};
}

export async function deleteFlag(flagId: string) {
	const session = await getServerAuthSession();
	if (!session?.user?.isAdmin) {
		return false;
	}

	const flagToDelete = await db
		.select()
		.from(flags)
		.where(eq(flags.id, flagId))
		.limit(1);

	if (!flagToDelete?.[0]) {
		return false;
	}

	const oldTags = flagToDelete[0].tags;

	await db.delete(flags).where(eq(flags.id, flagId));
	await removeTagsFromCount(oldTags);

	return true;
}

export async function updateFlag(
	flagId: string,
	data: {
		name?: string;
		image?: string;
		link?: string;
		description?: string;
		tags?: string[];
	},
) {
	const session = await getServerAuthSession();
	if (!session?.user?.isAdmin) {
		throw new Error("Unauthorized");
	}

	const flagToUpdate = await db
		.select()
		.from(flags)
		.where(eq(flags.id, flagId))
		.limit(1);

	if (!flagToUpdate?.[0]) {
		return false;
	}

	const oldTags = flagToUpdate[0].tags;
	const newTags = data.tags || [];

	await db
		.update(flags)
		.set({
			...data,
			updatedAt: new Date(),
		})
		.where(eq(flags.id, flagId));

	await updateTagCounts(oldTags, newTags);

	return true;
}
