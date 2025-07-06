"use server";

import { db } from "@/db";
import { flagRequests, flags, leaderboard, users } from "@/db/schema";
import { getServerAuthSession } from "@/lib/auth";
import { Flag } from "@/lib/types";
import { and, count, eq, max, sql } from "drizzle-orm";
import { base64ImageToS3URI, deleteFileFromUrl } from "./s3";
import { CLOUD_FRONT_URL } from "@/lib/constant";

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
      and(
        eq(flagRequests.approved, false),
        eq(flagRequests.deleted, false)
      )
    )
    .offset((page - 1) * limit);

  const total = await db
    .select({ count: count() })
    .from(flagRequests)
    .where(
      and(
        eq(flagRequests.approved, false),
        eq(flagRequests.deleted, false)
      )
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
      `User ${userId} not found in database, skipping leaderboard update`
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
      image: flagRequest.flag.flagImage,
      link: flagRequest.flag.link,
      index: index,
      description: flagRequest.flag.description,
      tags: flagRequest.flag.tags,
    })
    .returning({ id: flags.id })
    .then((res) => res[0]);

  await updateLeaderboard(flagRequest.userId);

  await db
    .update(flagRequests)
    .set({
      approved: true,
      flagId: flag.id,
    })
    .where(eq(flagRequests.id, flagRequestId));

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

  const isImageChanged = flagRequest.flag.flagImage !== flagRequest.oldFlag?.flagImage;

  if (isImageChanged && flagRequest.oldFlag?.flagImage?.includes(CLOUD_FRONT_URL)) {
    await deleteFileFromUrl(flagRequest.oldFlag?.flagImage ?? "");
  }

  await db
    .update(flags)
    .set({
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
        flagRequest.flag.description ===
          flagRequest.oldFlag?.description
          ? flag.description
          : flagRequest.flag.description,
      tags:
        flagRequest.flag.tags.every((tag) => flagRequest.oldFlag?.tags.includes(tag))
          ? flag.tags
          : flagRequest.flag.tags,
      updatedAt: new Date(),
    })
    .where(eq(flags.id, flagRequest.flagId ?? ""));

  await updateLeaderboard(flagRequest.userId);

  await db
    .update(flagRequests)
    .set({
      approved: true,
      isEdit: true,
    })
    .where(eq(flagRequests.id, flagRequestId));

  return true;
}

const MAX_FLAG_REQUESTS = 100;

export async function createFlagRequest(
  flag: Omit<Flag, "index" | "id">,
  flagId?: string,
  userMessage?: string
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
        eq(flagRequests.approved, false)
      )
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
