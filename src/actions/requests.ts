"use server";

import { db } from "@/db";
import { flagRequests, flags, leaderboard, users, flagTags } from "@/db/schema";
import { getServerAuthSession } from "@/lib/auth";
import { Flag } from "@/lib/types";
import { and, count, eq, max, sql } from "drizzle-orm";
import { base64ImageToS3URI, deleteFileFromUrl } from "./s3";
import { CLOUD_FRONT_URL } from "@/lib/constant";
import { redis } from "@/db/redis";

// Helper function to update tag counts when tags are added or removed
async function updateTagCounts(oldTags: string[], newTags: string[]) {
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

export async function getPendingFlagRequests(page: number, limit: number) {
	const session = await getServerAuthSession();
	if (!session?.user?.isAdmin) {
		return null;
	}

	const flagReqs = await db
		.select({
			id: flagRequests.id,
			userId: flagRequests.userId,
			oldFlag: flagRequests.oldFlag,
			approved: flagRequests.approved,
			flag: flagRequests.flag,
			flagId: flagRequests.flagId,
			isEdit: flagRequests.isEdit,
			createdAt: flagRequests.createdAt,
			updatedAt: flagRequests.updatedAt,
			deleted: flagRequests.deleted,
			userMessage: flagRequests.userMessage,
			userName: users.name,
		})
		.from(flagRequests)
		.leftJoin(users, eq(flagRequests.userId, users.id))
		.limit(limit)
		.where(
			and(eq(flagRequests.approved, false), eq(flagRequests.deleted, false)),
		)
		.offset((page - 1) * limit);

	const total = await db
		.select({ count: count() })
		.from(flagRequests)
		.where(
			and(eq(flagRequests.approved, false), eq(flagRequests.deleted, false)),
		);

	return {
		flagRequests: flagReqs,
		total: total[0].count,
	};
}

export async function declineFlagRequest(flagRequestId: string) {
	const session = await getServerAuthSession();
	if (!session?.user?.isAdmin) {
		return null;
	}

	const flagRequest = await db
		.select()
		.from(flagRequests)
		.where(eq(flagRequests.id, flagRequestId))
		.limit(1)
		.then((res) => res[0]);

	if (!flagRequest) {
		return false;
	}

	// only delete the flag image if it's a new flag
	if (!flagRequest.flagId) {
		const flagImage = flagRequest.flag.flagImage;
		if (flagImage.includes(CLOUD_FRONT_URL)) {
			await deleteFileFromUrl(flagImage);
		}
	}

	await db
		.update(flagRequests)
		.set({
			deleted: true,
		})
		.where(eq(flagRequests.id, flagRequestId));

	return true;
}

async function updateLeaderboard(userId: string) {
	// Verify user exists before updating leaderboard
	const user = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
		.then((res) => res[0]);

	if (!user) {
		console.warn(
			`User ${userId} not found in database, skipping leaderboard update`,
		);
		return;
	}

	const leaderboardEntry = await db
		.select()
		.from(leaderboard)
		.where(eq(leaderboard.userId, userId))
		.limit(1)
		.then((res) => res[0]);

	if (leaderboardEntry) {
		await db
			.update(leaderboard)
			.set({
				contributions: sql`contributions + 1`,
				updatedAt: new Date(),
			})
			.where(eq(leaderboard.userId, userId));
	} else {
		await db.insert(leaderboard).values({
			userId: userId,
			contributions: 1,
		});
	}
}

export async function approveFlagRequest(flagRequestId: string) {
	const session = await getServerAuthSession();
	if (!session?.user?.isAdmin) {
		return null;
	}

	const flagRequest = await db
		.select()
		.from(flagRequests)
		.where(eq(flagRequests.id, flagRequestId))
		.limit(1)
		.then((res) => res[0]);

	if (!flagRequest) {
		return false;
	}

	const index = await db
		.select({ maxIndex: max(flags.index) })
		.from(flags)
		.then((res) => (res[0].maxIndex ?? 0) + 1);

	const flag = await db
		.insert(flags)
		.values({
			name: flagRequest.flag.flagName,
			relatedFlags: flagRequest.flag.relatedFlags?.map((flag) => flag.id),
			image: flagRequest.flag.flagImage,
			link: flagRequest.flag.link,
			index: index,
			description: flagRequest.flag.description,
			tags: flagRequest.flag.tags,
		})
		.returning({ id: flags.id })
		.then((res) => res[0]);

	// Update tag counts for the new flag
	await addTagsToCount(flagRequest.flag.tags);

	await updateLeaderboard(flagRequest.userId);

	await db
		.update(flagRequests)
		.set({
			approved: true,
			flagId: flag.id,
		})
		.where(eq(flagRequests.id, flagRequestId));

	await redis.del(`flags:home`);
	await redis.del("leaderboard");
	await redis.del("tags");

	return true;
}

export async function approveFlagEditRequest(flagRequestId: string) {
	const session = await getServerAuthSession();
	if (!session?.user?.isAdmin) {
		return null;
	}

	const flagRequest = await db
		.select()
		.from(flagRequests)
		.where(eq(flagRequests.id, flagRequestId))
		.limit(1)
		.then((res) => res[0]);

	if (!flagRequest) {
		return false;
	}

	const flag = await db
		.select()
		.from(flags)
		.where(eq(flags.id, flagRequest.flagId ?? ""))
		.limit(1)
		.then((res) => res[0]);

	if (!flag) {
		return false;
	}

	const isImageChanged =
		flagRequest.flag.flagImage !== flagRequest.oldFlag?.flagImage;

	if (
		isImageChanged &&
		flagRequest.oldFlag?.flagImage?.includes(CLOUD_FRONT_URL)
	) {
		await deleteFileFromUrl(flagRequest.oldFlag?.flagImage ?? "");
	}

	// Check if tags have changed
	const tagsChanged =
		JSON.stringify(flagRequest.flag.tags.sort()) !==
		JSON.stringify(flag.tags.sort());

	const newTags = tagsChanged ? flagRequest.flag.tags : flag.tags;

	await db
		.update(flags)
		.set({
			relatedFlags: flagRequest.flag.relatedFlags?.map((flag) => flag.id),
			name:
				flagRequest.flag.flagName === flagRequest.oldFlag?.flagName
					? flag.name
					: flagRequest.flag.flagName,
			image:
				flagRequest.flag.flagImage === flagRequest.oldFlag?.flagImage
					? flag.image
					: flagRequest.flag.flagImage,
			link:
				flagRequest.flag.link === flagRequest.oldFlag?.link
					? flag.link
					: flagRequest.flag.link,
			description:
				flagRequest.flag.description === flagRequest.oldFlag?.description
					? flag.description
					: flagRequest.flag.description,
			tags: newTags,
			updatedAt: new Date(),
		})
		.where(eq(flags.id, flagRequest.flagId ?? ""));

	// Update tag counts if tags have changed
	if (tagsChanged) {
		await updateTagCounts(flag.tags, newTags);
	}

	await updateLeaderboard(flagRequest.userId);

	await db
		.update(flagRequests)
		.set({
			approved: true,
			isEdit: true,
		})
		.where(eq(flagRequests.id, flagRequestId));

	await redis.del(`flags:home`);
	await redis.del("leaderboard");
	await redis.del("tags");

	return true;
}

const MAX_FLAG_REQUESTS = 100;

export async function createFlagRequest(
	flag: Omit<Flag, "index" | "id">,
	flagId?: string,
	userMessage?: string,
) {
	const session = await getServerAuthSession();
	if (!session?.user) {
		return {
			success: false,
			message: "You must be logged in to create a flag request.",
		};
	}

	const user = await db
		.select()
		.from(users)
		.where(eq(users.id, session.user.id))
		.limit(1)
		.then((res) => res[0]);

	if (!user) {
		return {
			success: false,
			message: "User not found in database. Please try logging in again.",
		};
	}

	const numFlagRequests = await db
		.select({ count: count() })
		.from(flagRequests)
		.where(
			and(
				eq(flagRequests.userId, session.user.id),
				eq(flagRequests.approved, false),
			),
		);

	if (numFlagRequests[0].count >= MAX_FLAG_REQUESTS) {
		return {
			success: false,
			message: `You have reached the maximum number of flag requests. Please wait for your request to be approved or contact an admin.`,
		};
	}

	// check if the source is a valid url
	if (!flag.link.startsWith("http")) {
		return {
			success: false,
			message: "Invalid source URL. Please provide a valid URL.",
		};
	}

	let imageUrl = flag.flagImage;

	if (
		flag.flagImage.startsWith("data:image") ||
		flag.flagImage.startsWith("blob:")
	) {
		imageUrl = await base64ImageToS3URI(flag.flagImage);
	}

	let oldFlag = null;

	if (flagId) {
		const oldFlagDb = await db
			.select()
			.from(flags)
			.where(eq(flags.id, flagId ?? ""))
			.limit(1)
			.then((res) => res[0]);
		oldFlag = oldFlagDb
			? {
					flagName: oldFlagDb.name,
					flagImage: oldFlagDb.image,
					link: oldFlagDb.link,
					description: oldFlagDb.description,
					tags: oldFlagDb.tags,
					index: oldFlagDb.index,
				}
			: null;
	}

	await db.insert(flagRequests).values({
		userId: session.user.id,
		flagId: flagId ?? null,
		oldFlag: oldFlag ?? null,
		userMessage: userMessage ?? "",
		flag: {
			...flag,
			index: -1,
			flagImage: imageUrl,
		},
	});

	return {
		success: true,
		message: "Flag request created successfully.",
	};
}
