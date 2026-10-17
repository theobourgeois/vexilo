'use server';

import { db } from '@/db';
import { flagRequests, flags, leaderboard, users, flagTags } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { Flag, RelatedFlag } from '@/lib/types';
import { and, count, eq, inArray, max, ne, sql } from 'drizzle-orm';
import { base64ImageToS3URI, deleteFileFromUrl } from './s3';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { redis } from '@/db/redis';
import { relatedFlagsCacheKey } from '@/lib/cache-keys';
import { saveFlagColorsLater } from '@/lib/flag-palette';
import { upsertFlagMetadataMirror } from './flag-ai-metadata';
import { findExistingFlags } from './batch-flags';

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
      userIsTrusted: users.isTrusted,
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

/**
 * Deletes a stored image unless a flag still uses it. Requests can point at any
 * CloudFront URL (including another flag's image), so never delete blindly.
 */
async function deleteImageIfUnused(
  imageUrl: string,
  options: { uploadsOnly?: boolean; ignoreFlagId?: string } = {},
) {
  if (!imageUrl.startsWith(`${CLOUD_FRONT_URL}/`)) return;
  if (options.uploadsOnly && !imageUrl.startsWith(`${CLOUD_FRONT_URL}/images/`)) return;

  const [inUse] = await db
    .select({ id: flags.id })
    .from(flags)
    .where(
      and(
        eq(flags.image, imageUrl),
        options.ignoreFlagId ? ne(flags.id, options.ignoreFlagId) : undefined,
      ),
    )
    .limit(1);
  if (inUse) return;

  await deleteFileFromUrl(imageUrl);
}

async function declineRequest(flagRequest: typeof flagRequests.$inferSelect) {
  // Only new flags own their image; only clean up images uploaded for the request.
  if (!flagRequest.flagId) {
    await deleteImageIfUnused(flagRequest.flag.flagImage, { uploadsOnly: true });
  }

  await db
    .update(flagRequests)
    .set({
      deleted: true,
    })
    .where(eq(flagRequests.id, flagRequest.id));
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

  await declineRequest(flagRequest);
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

type FlagRequestRow = typeof flagRequests.$inferSelect;

async function getFlagRequest(flagRequestId: string) {
  return db
    .select()
    .from(flagRequests)
    .where(eq(flagRequests.id, flagRequestId))
    .limit(1)
    .then((res) => res[0]);
}

/** Creates the flag for a new-flag request and marks the request approved. */
async function publishNewFlagRequest(flagRequest: FlagRequestRow) {
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
      sources: flagRequest.flag.sources,
      index: index,
      description: flagRequest.flag.description,
      tags: flagRequest.flag.tags,
    })
    .returning({ id: flags.id })
    .then((res) => res[0]);
  saveFlagColorsLater(flag.id, flagRequest.flag.flagImage);

  await upsertFlagMetadataMirror({
    flagId: flag.id,
    name: flagRequest.flag.flagName,
    link: flagRequest.flag.link,
    sources: flagRequest.flag.sources,
    tags: flagRequest.flag.tags,
    description: flagRequest.flag.description,
  });

  // Update tag counts for the new flag
  await addTagsToCount(flagRequest.flag.tags);

  await updateLeaderboard(flagRequest.userId);

  await db
    .update(flagRequests)
    .set({
      approved: true,
      flagId: flag.id,
    })
    .where(eq(flagRequests.id, flagRequest.id));

  await redis.del('leaderboard');
  await redis.del('tags');

  return flag.id;
}

/** Applies an edit request to its flag and marks the request approved. */
async function publishFlagEditRequest(flagRequest: FlagRequestRow) {
  const flag = await db
    .select()
    .from(flags)
    .where(eq(flags.id, flagRequest.flagId ?? ''))
    .limit(1)
    .then((res) => res[0]);

  if (!flag) {
    return false;
  }

  const isImageChanged =
    flagRequest.flag.flagImage !== flagRequest.oldFlag?.flagImage;

  if (isImageChanged && flagRequest.oldFlag?.flagImage) {
    await deleteImageIfUnused(flagRequest.oldFlag.flagImage, {
      ignoreFlagId: flag.id,
    });
  }

  // Check if tags have changed
  const tagsChanged =
    JSON.stringify(flagRequest.flag.tags.sort()) !==
    JSON.stringify(flag.tags.sort());

  const nextName =
    flagRequest.flag.flagName === flagRequest.oldFlag?.flagName
      ? flag.name
      : flagRequest.flag.flagName;
  const nextImage =
    flagRequest.flag.flagImage === flagRequest.oldFlag?.flagImage
      ? flag.image
      : flagRequest.flag.flagImage;
  const nextLink =
    flagRequest.flag.link === flagRequest.oldFlag?.link
      ? flag.link
      : flagRequest.flag.link;
  const nextSources =
    flagRequest.flag.sources === flagRequest.oldFlag?.sources
      ? flag.sources
      : flagRequest.flag.sources;
  const nextDescription =
    flagRequest.flag.description === flagRequest.oldFlag?.description
      ? flag.description
      : flagRequest.flag.description;
  const newTags = tagsChanged ? flagRequest.flag.tags : flag.tags;

  await db
    .update(flags)
    .set({
      relatedFlags: flagRequest.flag.relatedFlags?.map((flag) => flag.id),
      name: nextName,
      image: nextImage,
      link: nextLink,
      sources: nextSources,
      description: nextDescription,
      tags: newTags,
      updatedAt: new Date(),
    })
    .where(eq(flags.id, flagRequest.flagId ?? ''));
  if (nextImage !== flag.image) saveFlagColorsLater(flag.id, nextImage);

  await upsertFlagMetadataMirror({
    flagId: flag.id,
    name: nextName,
    link: nextLink,
    sources: nextSources,
    tags: newTags,
    description: nextDescription,
  });

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
    .where(eq(flagRequests.id, flagRequest.id));

  await redis.del('leaderboard');
  await redis.del('tags');
  await redis.del(`flag-${flagRequest.flagId}`);
  await redis.del(`recommendations-${flagRequest.flagId}`, relatedFlagsCacheKey(flagRequest.flagId ?? ''));

  return true;
}

export async function approveFlagRequest(flagRequestId: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const flagRequest = await getFlagRequest(flagRequestId);
  if (!flagRequest) {
    return false;
  }

  await publishNewFlagRequest(flagRequest);
  return true;
}

export async function approveFlagEditRequest(flagRequestId: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const flagRequest = await getFlagRequest(flagRequestId);
  if (!flagRequest) {
    return false;
  }

  return publishFlagEditRequest(flagRequest);
}

/**
 * Publishes a request immediately for trusted creators. Failures leave the
 * request pending for a moderator instead of failing the submission.
 */
async function autoApproveFlagRequest(flagRequest: FlagRequestRow) {
  try {
    if (flagRequest.flagId) {
      return await publishFlagEditRequest(flagRequest);
    }
    await publishNewFlagRequest(flagRequest);
    return true;
  } catch (error) {
    console.error(`Auto-approving flag request ${flagRequest.id} failed`, error);
    return false;
  }
}

/** Approves every pending request from a user (e.g. right after trusting them). */
export async function approvePendingFlagRequestsForUser(userId: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const pending = await db
    .select()
    .from(flagRequests)
    .where(
      and(
        eq(flagRequests.userId, userId),
        eq(flagRequests.approved, false),
        eq(flagRequests.deleted, false),
      ),
    )
    .orderBy(flagRequests.createdAt);

  let approved = 0;
  // Sequential on purpose: new flags take the next free index one at a time.
  for (const flagRequest of pending) {
    if (await autoApproveFlagRequest(flagRequest)) {
      approved += 1;
    }
  }

  return { approved, total: pending.length };
}

const MAX_FLAG_REQUESTS = 100;

export async function createFlagRequest(
  flag: Omit<Flag, 'index' | 'id'>,
  flagId?: string,
  userMessage?: string,
) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return {
      success: false,
      message: 'You must be logged in to create a flag request.',
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
      message: 'User not found in database. Please try logging in again.',
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

  if (!user.isTrusted && numFlagRequests[0].count >= MAX_FLAG_REQUESTS) {
    return {
      success: false,
      message: `You have reached the maximum number of flag requests. Please wait for your request to be approved or contact an admin.`,
    };
  }

  let imageUrl = flag.flagImage;

  if (
    flag.flagImage.startsWith('data:image') ||
    flag.flagImage.startsWith('blob:')
  ) {
    imageUrl = await base64ImageToS3URI(flag.flagImage);
  }

  let oldFlag = null;

  if (flagId) {
    const oldFlagDb = await db
      .select()
      .from(flags)
      .where(eq(flags.id, flagId ?? ''))
      .limit(1)
      .then((res) => res[0]);
    oldFlag = oldFlagDb
      ? {
          flagName: oldFlagDb.name,
          flagImage: oldFlagDb.image,
          link: oldFlagDb.link,
          sources: oldFlagDb.sources,
          description: oldFlagDb.description,
          tags: oldFlagDb.tags,
          index: oldFlagDb.index,
        }
      : null;
  }

  const [flagRequest] = await db
    .insert(flagRequests)
    .values({
      userId: session.user.id,
      flagId: flagId ?? null,
      oldFlag: oldFlag ?? null,
      userMessage: userMessage ?? '',
      flag: {
        ...flag,
        index: -1,
        flagImage: imageUrl,
      },
    })
    .returning();

  const autoApproved = user.isTrusted
    ? await autoApproveFlagRequest(flagRequest)
    : false;

  return {
    success: true,
    autoApproved,
    message: autoApproved
      ? 'Flag published.'
      : 'Flag request created successfully.',
  };
}

async function countPendingFlagRequests(userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(flagRequests)
    .where(
      and(eq(flagRequests.userId, userId), eq(flagRequests.approved, false)),
    );
  return result.count;
}

export async function getRemainingFlagRequestSlots() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return { remaining: 0, max: MAX_FLAG_REQUESTS, isTrusted: false };
  }

  const [user, pending] = await Promise.all([
    db
      .select({ isTrusted: users.isTrusted })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((res) => res[0]),
    countPendingFlagRequests(session.user.id),
  ]);
  const isTrusted = user?.isTrusted ?? false;

  return {
    // Trusted creators aren't limited; their requests never stay pending.
    remaining: Math.max(MAX_FLAG_REQUESTS - pending, 0),
    max: MAX_FLAG_REQUESTS,
    isTrusted,
  };
}

export type BatchFlagRequestInput = {
  flagName: string;
  flagImage: string;
  sources: string[];
  tags: string[];
  description: string;
  relatedFlags: RelatedFlag[];
  userMessage: string;
};

export async function createFlagRequests(batch: BatchFlagRequestInput[]) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return {
      success: false as const,
      message: 'You must be logged in to create a flag request.',
    };
  }

  const user = await db
    .select({
      id: users.id,
      userNumber: users.userNumber,
      isTrusted: users.isTrusted,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((res) => res[0]);

  if (!user) {
    return {
      success: false as const,
      message: 'User not found in database. Please try logging in again.',
    };
  }

  if (batch.length === 0) {
    return { success: false as const, message: 'Add at least one flag.' };
  }

  const invalid = batch.find(
    (flag) =>
      !flag.flagName.trim() ||
      !/^https?:\/\//.test(flag.flagImage) ||
      flag.sources.length === 0,
  );
  if (invalid) {
    return {
      success: false as const,
      message: `"${invalid.flagName || 'Untitled flag'}" needs a name, an uploaded image and a source.`,
    };
  }

  const pending = await countPendingFlagRequests(session.user.id);
  const remaining = MAX_FLAG_REQUESTS - pending;
  if (!user.isTrusted && batch.length > remaining) {
    return {
      success: false as const,
      message:
        remaining > 0
          ? `You can only have ${MAX_FLAG_REQUESTS} flags waiting for review. You can submit ${remaining} more right now.`
          : `You have reached the maximum number of flag requests. Please wait for your requests to be approved or contact an admin.`,
    };
  }

  const inserted = await db.insert(flagRequests).values(
    batch.map((flag) => ({
      userId: session.user.id,
      flagId: null,
      oldFlag: null,
      userMessage: flag.userMessage.trim(),
      flag: {
        flagName: flag.flagName.trim(),
        flagImage: flag.flagImage,
        link: '',
        sources: flag.sources,
        tags: flag.tags,
        description: flag.description.trim(),
        relatedFlags: flag.relatedFlags,
        index: -1,
      },
    })),
  ).returning();

  // Sequential on purpose: new flags take the next free index one at a time.
  const autoApprovedIds: string[] = [];
  if (user.isTrusted) {
    for (const flagRequest of inserted) {
      if (await autoApproveFlagRequest(flagRequest)) {
        autoApprovedIds.push(flagRequest.id);
      }
    }
  }

  return {
    success: true as const,
    created: batch.length,
    // Index-aligned with the submitted batch.
    published: inserted.map((flagRequest) =>
      autoApprovedIds.includes(flagRequest.id),
    ),
    userNumber: user.userNumber,
  };
}

export type ReviewQueueItem = {
  id: string;
  flagId: string | null;
  isEdit: boolean;
  flag: Omit<Flag, 'id'>;
  oldFlag: Omit<Flag, 'id'> | null;
  userMessage: string;
  createdAt: Date;
  duplicateOf: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    userNumber: string | null;
    isTrusted: boolean;
    approvedCount: number;
    declinedCount: number;
  };
};

const REVIEW_QUEUE_LIMIT = 500;

export async function getReviewQueue(): Promise<{
  items: ReviewQueueItem[];
  total: number;
} | null> {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const pendingWhere = and(
    eq(flagRequests.approved, false),
    eq(flagRequests.deleted, false),
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: flagRequests.id,
        flagId: flagRequests.flagId,
        flag: flagRequests.flag,
        oldFlag: flagRequests.oldFlag,
        userMessage: flagRequests.userMessage,
        createdAt: flagRequests.createdAt,
        userId: flagRequests.userId,
        userName: users.name,
        userImage: users.image,
        userNumber: users.userNumber,
        userIsTrusted: users.isTrusted,
      })
      .from(flagRequests)
      .leftJoin(users, eq(flagRequests.userId, users.id))
      .where(pendingWhere)
      .orderBy(flagRequests.createdAt)
      .limit(REVIEW_QUEUE_LIMIT),
    db.select({ total: count() }).from(flagRequests).where(pendingWhere),
  ]);

  const userIds = Array.from(new Set(rows.map((row) => row.userId)));
  const history =
    userIds.length > 0
      ? await db
          .select({
            userId: flagRequests.userId,
            approved: sql<number>`count(*) filter (where ${flagRequests.approved})`,
            declined: sql<number>`count(*) filter (where ${flagRequests.deleted})`,
          })
          .from(flagRequests)
          .where(inArray(flagRequests.userId, userIds))
          .groupBy(flagRequests.userId)
      : [];
  const historyByUser = new Map(history.map((entry) => [entry.userId, entry]));

  const duplicates = await findExistingFlags(
    rows
      .filter((row) => !row.flagId)
      .map((row) => ({
        key: row.id,
        name: row.flag.flagName,
        sources: row.flag.sources ?? [],
      })),
  );
  const duplicateById = new Map(
    duplicates
      .filter((match) => match.status === 'live')
      .map((match) => [match.key, match.name]),
  );

  return {
    total,
    items: rows.map((row) => {
      const userHistory = historyByUser.get(row.userId);
      return {
        id: row.id,
        flagId: row.flagId,
        isEdit: row.flagId !== null,
        flag: row.flag,
        oldFlag: row.oldFlag,
        userMessage: row.userMessage,
        createdAt: row.createdAt,
        duplicateOf: duplicateById.get(row.id) ?? null,
        user: {
          id: row.userId,
          name: row.userName,
          image: row.userImage,
          userNumber: row.userNumber,
          isTrusted: row.userIsTrusted ?? false,
          approvedCount: Number(userHistory?.approved ?? 0),
          declinedCount: Number(userHistory?.declined ?? 0),
        },
      };
    }),
  };
}

async function getPendingRequestsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select()
    .from(flagRequests)
    .where(
      and(
        inArray(flagRequests.id, ids),
        eq(flagRequests.approved, false),
        eq(flagRequests.deleted, false),
      ),
    )
    .orderBy(flagRequests.createdAt);
}

export async function approveFlagRequests(ids: string[]) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const approved: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];
  // Sequential on purpose: new flags take the next free index one at a time.
  for (const flagRequest of await getPendingRequestsByIds(ids)) {
    try {
      if (flagRequest.flagId) {
        if (!(await publishFlagEditRequest(flagRequest))) {
          throw new Error('The flag being edited no longer exists.');
        }
      } else {
        await publishNewFlagRequest(flagRequest);
      }
      approved.push(flagRequest.id);
    } catch (error) {
      console.error(`Approving flag request ${flagRequest.id} failed`, error);
      failed.push({
        id: flagRequest.id,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { approved, failed };
}

export async function declineFlagRequests(ids: string[]) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const declined: string[] = [];
  for (const flagRequest of await getPendingRequestsByIds(ids)) {
    await declineRequest(flagRequest);
    declined.push(flagRequest.id);
  }

  return { declined };
}

/** Lets an admin tweak a pending request (typo, tags...) before approving it. */
export async function updatePendingFlagRequest(
  id: string,
  patch: Partial<
    Pick<Flag, 'flagName' | 'description' | 'tags' | 'sources'>
  >,
) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const [flagRequest] = await getPendingRequestsByIds([id]);
  if (!flagRequest) {
    return false;
  }

  await db
    .update(flagRequests)
    .set({
      flag: { ...flagRequest.flag, ...patch },
      updatedAt: new Date(),
    })
    .where(eq(flagRequests.id, id));

  return true;
}

export async function addTagsToFlagRequests(ids: string[], tags: string[]) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const cleanTags = tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  for (const flagRequest of await getPendingRequestsByIds(ids)) {
    await db
      .update(flagRequests)
      .set({
        flag: {
          ...flagRequest.flag,
          tags: Array.from(new Set([...flagRequest.flag.tags, ...cleanTags])),
        },
        updatedAt: new Date(),
      })
      .where(eq(flagRequests.id, flagRequest.id));
  }

  return true;
}

export type AiFlagDraftSubmission = {
  flagName: string;
  flagImage: string;
  sources: string[];
  tags: string[];
  description: string;
  imageOrigin: 'commons' | 'drawn';
};

/**
 * Adds AI-generated drafts to the review queue. Unlike createFlagRequests these are
 * never auto-approved, even for trusted admins, so every generated flag gets a look.
 * Drawn fictional flags may have no sources.
 */
export async function submitAiFlagDrafts(drafts: AiFlagDraftSubmission[]) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return { success: false as const, message: 'Only admins can add generated flags.' };
  }
  if (drafts.length === 0) {
    return { success: false as const, message: 'Select at least one draft.' };
  }

  const invalid = drafts.find(
    (draft) =>
      !draft.flagName.trim() ||
      !draft.flagImage.startsWith(`${CLOUD_FRONT_URL}/`) ||
      (draft.imageOrigin === 'commons' && draft.sources.length === 0),
  );
  if (invalid) {
    return {
      success: false as const,
      message: `"${invalid.flagName || 'Untitled flag'}" needs a name, an image and a source.`,
    };
  }

  await db.insert(flagRequests).values(
    drafts.map((draft) => ({
      userId: session.user.id,
      flagId: null,
      oldFlag: null,
      userMessage:
        draft.imageOrigin === 'drawn'
          ? 'Created with AI. The image was drawn by AI, so check it closely.'
          : 'Created with AI. Image from Wikimedia Commons.',
      flag: {
        flagName: draft.flagName.trim(),
        flagImage: draft.flagImage,
        link: '',
        sources: draft.sources.filter((source) => /^https?:\/\//.test(source)),
        tags: draft.tags,
        description: draft.description.trim(),
        relatedFlags: [],
        index: -1,
      },
    })),
  );

  return { success: true as const, created: drafts.length };
}
