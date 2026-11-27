'use server';

import { and, count, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import sharp from 'sharp';
import { z } from 'zod';
import { db } from '@/db';
import { flagRequests, flags, savedFlags } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import type { StoredStudioDesign } from '@/lib/studio-design';
import { studioDesignSchema } from '@/lib/studio-design-schema';
import { uploadFile } from '@/lib/storage/s3';
import { deleteImageIfUnused } from '@/lib/storage/unused-image';

/**
 * Where a saved flag stands: never posted (or its post was declined), waiting for a moderator,
 * or live on Browse. A posted flag can also have an update waiting (`updatePending`).
 */
export type SavedFlagStatus = 'draft' | 'review' | 'posted' | 'declined';

export type MyFlag = {
  id: string;
  name: string;
  image: string;
  /** Height : width. */
  ratio: [number, number];
  status: SavedFlagStatus;
  updatePending: boolean;
  /** The flag on Browse, once posted. */
  flagName: string | null;
  remixOfName: string | null;
  updatedAt: Date;
};

/** A saved flag, opened in the flag maker. */
export type SavedFlagSource = {
  id: string;
  name: string;
  design: StoredStudioDesign;
  remix: { id: string; name: string } | null;
  status: SavedFlagStatus;
  updatePending: boolean;
  flagName: string | null;
  /** What the post says, to start the post dialog from. */
  post: { description: string; tags: string[] };
};

/** How many flags one person can keep. */
const MAX_SAVED_FLAGS = 500;
const THUMBNAIL_WIDTH = 800;
const SAVED_PREFIX = 'saved/';

const remixFlags = alias(flags, 'remix');

function statusOf(row: {
  flagName: string | null;
  requestApproved: boolean | null;
  requestDeleted: boolean | null;
}): { status: SavedFlagStatus; updatePending: boolean } {
  const pending = row.requestApproved === false && row.requestDeleted === false;
  if (row.flagName) return { status: 'posted', updatePending: pending };
  if (pending) return { status: 'review', updatePending: false };
  return { status: row.requestDeleted ? 'declined' : 'draft', updatePending: false };
}

async function signedInUserId() {
  const session = await getServerAuthSession();
  return session?.user?.id ?? null;
}

/** The signed-in person's saved flags, most recently changed first. Null when signed out. */
export async function getMyFlags(): Promise<MyFlag[] | null> {
  const userId = await signedInUserId();
  if (!userId) return null;

  const rows = await db
    .select({
      id: savedFlags.id,
      name: savedFlags.name,
      image: savedFlags.image,
      ratio: sql<[number, number] | null>`${savedFlags.design}->'ratio'`,
      updatedAt: savedFlags.updatedAt,
      flagName: flags.name,
      remixOfName: remixFlags.name,
      requestApproved: flagRequests.approved,
      requestDeleted: flagRequests.deleted,
    })
    .from(savedFlags)
    .leftJoin(flags, eq(flags.id, savedFlags.flagId))
    .leftJoin(remixFlags, eq(remixFlags.id, savedFlags.remixOf))
    .leftJoin(flagRequests, eq(flagRequests.id, savedFlags.requestId))
    .where(eq(savedFlags.userId, userId))
    .orderBy(desc(savedFlags.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    image: row.image,
    ratio: Array.isArray(row.ratio) && row.ratio.length === 2 ? row.ratio : [2, 3],
    ...statusOf(row),
    flagName: row.flagName,
    remixOfName: row.remixOfName,
    updatedAt: row.updatedAt,
  }));
}

/** One of the signed-in person's saved flags, for the flag maker. Null if it isn't theirs. */
export async function getSavedFlagSource(id: string): Promise<SavedFlagSource | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const userId = await signedInUserId();
  if (!userId) return null;

  const [row] = await db
    .select({
      id: savedFlags.id,
      name: savedFlags.name,
      design: savedFlags.design,
      remixId: remixFlags.id,
      remixName: remixFlags.name,
      flagName: flags.name,
      flagDescription: flags.description,
      flagTags: flags.tags,
      requestApproved: flagRequests.approved,
      requestDeleted: flagRequests.deleted,
      requestFlag: flagRequests.flag,
    })
    .from(savedFlags)
    .leftJoin(flags, eq(flags.id, savedFlags.flagId))
    .leftJoin(remixFlags, eq(remixFlags.id, savedFlags.remixOf))
    .leftJoin(flagRequests, eq(flagRequests.id, savedFlags.requestId))
    .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, userId)))
    .limit(1);
  if (!row) return null;

  const { status, updatePending } = statusOf(row);
  // What's waiting for review is the latest version of the post; else what's live.
  const post =
    row.requestFlag && row.requestApproved === false && row.requestDeleted === false
      ? { description: row.requestFlag.description, tags: row.requestFlag.tags }
      : row.flagName
        ? { description: row.flagDescription ?? '', tags: row.flagTags ?? [] }
        : { description: '', tags: [] };

  return {
    id: row.id,
    name: row.name,
    design: row.design,
    remix: row.remixId && row.remixName ? { id: row.remixId, name: row.remixName } : null,
    status,
    updatePending,
    flagName: row.flagName,
    post,
  };
}

/** Stores a picture of a saved flag. Re-encoding through sharp strips anything that isn't pixels. */
async function uploadThumbnail(userId: string, dataUrl: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('Not a PNG');
  const png = await sharp(Buffer.from(match[1], 'base64'))
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer();
  const key = `${SAVED_PREFIX}${userId}/${crypto.randomUUID()}.png`;
  await uploadFile(png, process.env.S3_BUCKET_NAME!, key, 'image/png');
  return `${CLOUD_FRONT_URL}/${key}`;
}

const saveSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  design: studioDesignSchema,
  image: z.string().startsWith('data:image/png;base64,').max(8_000_000),
  remixOf: z.string().uuid().nullable(),
});

/**
 * Saves a design to the signed-in person's flags: a new one without `id`, else updates theirs.
 * It never changes a posted flag; posting an update does that.
 */
export async function saveMyFlag(input: {
  id: string | null;
  name: string;
  design: StoredStudioDesign;
  image: string;
  remixOf: string | null;
}) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: 'Something about this flag is invalid. Try again.' };
  const userId = await signedInUserId();
  if (!userId) return { success: false as const, message: 'Sign in to save your flags.' };
  const { id, name, design, remixOf } = parsed.data;

  const [existing] = id
    ? await db
        .select({ id: savedFlags.id, image: savedFlags.image })
        .from(savedFlags)
        .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, userId)))
        .limit(1)
    : [];
  if (id && !existing) return { success: false as const, message: 'That flag isn’t in your flags any more.' };
  if (!existing) {
    const [{ total }] = await db.select({ total: count() }).from(savedFlags).where(eq(savedFlags.userId, userId));
    if (total >= MAX_SAVED_FLAGS) {
      return { success: false as const, message: `You can keep up to ${MAX_SAVED_FLAGS} flags. Delete some to make room.` };
    }
  }

  let image: string;
  try {
    image = await uploadThumbnail(userId, parsed.data.image);
  } catch {
    return { success: false as const, message: 'Couldn’t save a picture of your flag. Try again.' };
  }

  const now = new Date();
  if (existing) {
    await db.update(savedFlags).set({ name, design, image, updatedAt: now }).where(eq(savedFlags.id, existing.id));
    // Pictures it was posted with belong to the post too; only its own saved pictures go.
    await deleteImageIfUnused(existing.image, { prefix: SAVED_PREFIX }).catch(() => {});
    return { success: true as const, id: existing.id, savedAt: now };
  }

  const remix = remixOf ? (await db.select({ id: flags.id }).from(flags).where(eq(flags.id, remixOf)).limit(1))[0] : undefined;
  const [row] = await db
    .insert(savedFlags)
    .values({ userId, name, design, image, remixOf: remix?.id ?? null, createdAt: now, updatedAt: now })
    .returning({ id: savedFlags.id });
  return { success: true as const, id: row.id, savedAt: now };
}

/** Takes a flag out of the signed-in person's flags. A posted flag stays on Browse. */
export async function deleteMyFlag(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { success: false as const, message: 'That flag doesn’t exist.' };
  const userId = await signedInUserId();
  if (!userId) return { success: false as const, message: 'Sign in to manage your flags.' };
  const [row] = await db
    .delete(savedFlags)
    .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, userId)))
    .returning({ image: savedFlags.image });
  if (!row) return { success: false as const, message: 'That flag isn’t in your flags any more.' };
  await deleteImageIfUnused(row.image, { prefix: SAVED_PREFIX }).catch(() => {});
  return { success: true as const };
}

/** A copy of one of the signed-in person's flags, as a new draft. */
export async function duplicateMyFlag(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { success: false as const, message: 'That flag doesn’t exist.' };
  const userId = await signedInUserId();
  if (!userId) return { success: false as const, message: 'Sign in to manage your flags.' };
  const [source] = await db
    .select()
    .from(savedFlags)
    .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, userId)))
    .limit(1);
  if (!source) return { success: false as const, message: 'That flag isn’t in your flags any more.' };
  const [{ total }] = await db.select({ total: count() }).from(savedFlags).where(eq(savedFlags.userId, userId));
  if (total >= MAX_SAVED_FLAGS) {
    return { success: false as const, message: `You can keep up to ${MAX_SAVED_FLAGS} flags. Delete some to make room.` };
  }
  const name = `${source.name.slice(0, 113)} (copy)`;
  // The copy shares the picture until it's saved; pictures are only deleted once nothing uses them.
  const [row] = await db
    .insert(savedFlags)
    .values({ userId, name, design: source.design, image: source.image, remixOf: source.remixOf })
    .returning({ id: savedFlags.id });
  return { success: true as const, id: row.id };
}
