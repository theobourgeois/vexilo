"use server";

import { db } from "@/db";
import { flagRequests, flags } from "@/db/schema";
import { getServerAuthSession } from "@/lib/auth";
import { Flag } from "@/lib/types";
import { count, eq, max } from "drizzle-orm";
import { base64ImageToS3URI, deleteFileFromUrl } from "./s3";
import { CLOUD_FRONT_URL } from "@/lib/constant";

export async function getFlagRequests(page: number, limit: number) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const flagReqs = await db
    .select()
    .from(flagRequests)
    .limit(limit)
    .offset((page - 1) * limit);

  return flagReqs;
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

  await db.delete(flagRequests).where(eq(flagRequests.id, flagRequestId));

  return true;
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

  await db.insert(flags).values({
    name: flagRequest.flag.flagName,
    image: flagRequest.flag.flagImage,
    link: flagRequest.flag.link,
    index: index,
    description: flagRequest.flag.description,
    tags: flagRequest.flag.tags,
  });

  // delete the flag request
  await db.delete(flagRequests).where(eq(flagRequests.id, flagRequestId));

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

  await db
    .update(flags)
    .set({
      name: flagRequest.flag.flagName,
      image: flagRequest.flag.flagImage,
      link: flagRequest.flag.link,
      description: flagRequest.flag.description,
      tags: flagRequest.flag.tags,
      updatedAt: new Date(),
    })
    .where(eq(flags.id, flagRequest.flagId ?? ""));

  await db.delete(flagRequests).where(eq(flagRequests.id, flagRequestId));

  return true;
}

const MAX_FLAG_REQUESTS = 50;

export async function createFlagRequest(
  flag: Omit<Flag, "index" | "id">,
  flagId?: string
) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return {
      success: false,
      message: "You must be logged in to create a flag request.",
    };
  }

  const numFlagRequests = await db
    .select({ count: count() })
    .from(flagRequests)
    .where(eq(flagRequests.userId, session.user.id));

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

  await db.insert(flagRequests).values({
    userId: session.user.id,
    flagId: flagId ?? null,
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
