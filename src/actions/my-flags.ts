'use server';

import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '@/db';
import { flags, savedFlags, users } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { inEncyclopedia } from '@/lib/encyclopedia';
import { postPath } from '@/lib/post-slug';
import { SAVED_PREFIX, uploadSavedFlagImage } from '@/lib/saved-flag-image';
import type { StoredStudioDesign } from '@/lib/studio-design';
import { studioDesignSchema } from '@/lib/studio-design-schema';
import { deleteImageIfUnused } from '@/lib/storage/unused-image';

/** Where a saved flag stands: only in My flags, or posted on the maker's profile. */
export type SavedFlagStatus = 'draft' | 'posted';

export type MyFlag = {
  id: string;
  name: string;
  image: string;
  /** Height : width. */
  ratio: [number, number];
  status: SavedFlagStatus;
  /** Its address while it's posted. */
  path: string | null;
  likes: number;
  /** False for flags uploaded as pictures: they can't open in the flag maker. */
  hasDesign: boolean;
  description: string;
  tags: string[];
  remixOfName: string | null;
  updatedAt: Date;
};

/** What a design is a remix of, as the flag maker shows it. */
export type RemixLink = { flagId: string | null; postId: string | null; name: string; href: string };

/** A saved flag, opened in the flag maker. */
export type SavedFlagSource = {
  id: string;
  name: string;
  design: StoredStudioDesign;
  remix: RemixLink | null;
  status: SavedFlagStatus;
  path: string | null;
  /** What the post says, to start the post dialog from. */
  post: { description: string; tags: string[] };
};

/** How many flags one person can keep. */
const MAX_SAVED_FLAGS = 500;

const remixFlags = alias(flags, 'remix');
const parentPosts = alias(savedFlags, 'parent');
const parentAuthors = alias(users, 'parent_author');

async function signedIn() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return null;
  const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, session.user.id)).limit(1);
  return user ?? null;
}

/** The signed-in person's saved flags, most recently changed first. Null when signed out. */
export async function getMyFlags(): Promise<MyFlag[] | null> {
  const user = await signedIn();
  if (!user) return null;

  const rows = await db
    .select({
      id: savedFlags.id,
      name: savedFlags.name,
      image: savedFlags.image,
      ratio: sql<[number, number] | null>`${savedFlags.design}->'ratio'`,
      hasDesign: sql<boolean>`${savedFlags.design} IS NOT NULL`,
      description: savedFlags.description,
      tags: savedFlags.tags,
      updatedAt: savedFlags.updatedAt,
      slug: savedFlags.slug,
      publishedAt: savedFlags.publishedAt,
      likes: savedFlags.likes,
      remixOfName: remixFlags.name,
      parentName: parentPosts.name,
    })
    .from(savedFlags)
    .leftJoin(remixFlags, eq(remixFlags.id, savedFlags.remixOf))
    .leftJoin(parentPosts, eq(parentPosts.id, savedFlags.remixOfPostId))
    .where(eq(savedFlags.userId, user.id))
    .orderBy(desc(savedFlags.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    image: row.image,
    ratio: Array.isArray(row.ratio) && row.ratio.length === 2 ? row.ratio : [2, 3],
    status: row.publishedAt ? 'posted' : 'draft',
    path: row.slug && row.publishedAt ? postPath(user.name, row.slug) : null,
    likes: row.likes,
    hasDesign: Boolean(row.hasDesign),
    description: row.description,
    tags: row.tags,
    remixOfName: row.parentName ?? row.remixOfName,
    updatedAt: row.updatedAt,
  }));
}

/** One of the signed-in person's saved flags, for the flag maker. Null if it isn't theirs (or has no design). */
export async function getSavedFlagSource(id: string): Promise<SavedFlagSource | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const user = await signedIn();
  if (!user) return null;

  const [row] = await db
    .select({
      id: savedFlags.id,
      name: savedFlags.name,
      design: savedFlags.design,
      slug: savedFlags.slug,
      publishedAt: savedFlags.publishedAt,
      description: savedFlags.description,
      tags: savedFlags.tags,
      remixId: remixFlags.id,
      remixName: remixFlags.name,
      parentId: parentPosts.id,
      parentName: parentPosts.name,
      parentSlug: parentPosts.slug,
      parentAuthor: parentAuthors.name,
    })
    .from(savedFlags)
    .leftJoin(remixFlags, eq(remixFlags.id, savedFlags.remixOf))
    .leftJoin(parentPosts, eq(parentPosts.id, savedFlags.remixOfPostId))
    .leftJoin(parentAuthors, eq(parentAuthors.id, parentPosts.userId))
    .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, user.id)))
    .limit(1);
  if (!row?.design) return null;

  const remix: RemixLink | null =
    row.parentId && row.parentName && row.parentSlug && row.parentAuthor
      ? { flagId: null, postId: row.parentId, name: row.parentName, href: postPath(row.parentAuthor, row.parentSlug) }
      : row.remixId && row.remixName
        ? { flagId: row.remixId, postId: null, name: row.remixName, href: `/flag/${encodeURIComponent(row.remixName)}` }
        : null;

  return {
    id: row.id,
    name: row.name,
    design: row.design,
    remix,
    status: row.publishedAt ? 'posted' : 'draft',
    path: row.slug && row.publishedAt ? postPath(user.name, row.slug) : null,
    post: { description: row.description, tags: row.tags },
  };
}

const saveSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  design: studioDesignSchema,
  image: z.string().startsWith('data:image/png;base64,').max(8_000_000),
  remixOf: z.string().uuid().nullable(),
  remixOfPostId: z.string().uuid().nullable().default(null),
});

/**
 * Saves a design to the signed-in person's flags: a new one without `id`, else updates theirs.
 * A posted flag is its post, so saving one updates the post too.
 */
export async function saveMyFlag(input: {
  id: string | null;
  name: string;
  design: StoredStudioDesign;
  image: string;
  remixOf: string | null;
  remixOfPostId?: string | null;
}) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: 'Something about this flag is invalid. Try again.' };
  const user = await signedIn();
  if (!user) return { success: false as const, message: 'Sign in to save your flags.' };
  const userId = user.id;
  const { id, name, design, remixOf, remixOfPostId } = parsed.data;

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
    image = await uploadSavedFlagImage(userId, parsed.data.image);
  } catch {
    return { success: false as const, message: 'Couldn’t save a picture of your flag. Try again.' };
  }

  const now = new Date();
  if (existing) {
    await db.update(savedFlags).set({ name, design, image, updatedAt: now }).where(eq(savedFlags.id, existing.id));
    // Pictures from before posts (flags that were in the encyclopedia) are under images/ and stay.
    await deleteImageIfUnused(existing.image, { prefix: SAVED_PREFIX }).catch(() => {});
    return { success: true as const, id: existing.id, savedAt: now };
  }

  const [parent] = remixOfPostId
    ? await db
        .select({ id: savedFlags.id })
        .from(savedFlags)
        .where(and(eq(savedFlags.id, remixOfPostId), isNotNull(savedFlags.publishedAt)))
        .limit(1)
    : [];
  const [remix] =
    !parent && remixOf ? await db.select({ id: flags.id }).from(flags).where(and(eq(flags.id, remixOf), inEncyclopedia)).limit(1) : [];
  const [row] = await db
    .insert(savedFlags)
    .values({ userId, name, design, image, remixOf: remix?.id ?? null, remixOfPostId: parent?.id ?? null, createdAt: now, updatedAt: now })
    .returning({ id: savedFlags.id });
  return { success: true as const, id: row.id, savedAt: now };
}

/**
 * Deletes one of the signed-in person's flags, and so its post if it's posted (with its likes).
 * A flag that was in the encyclopedia before posts stays out of it.
 */
export async function deleteMyFlag(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { success: false as const, message: 'That flag doesn’t exist.' };
  const user = await signedIn();
  if (!user) return { success: false as const, message: 'Sign in to manage your flags.' };
  const [row] = await db
    .delete(savedFlags)
    .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, user.id)))
    .returning({ image: savedFlags.image });
  if (!row) return { success: false as const, message: 'That flag isn’t in your flags any more.' };
  await db
    .update(users)
    .set({ pinnedPostIds: sql`array_remove(${users.pinnedPostIds}, ${id}::uuid)` })
    .where(eq(users.id, user.id));
  await deleteImageIfUnused(row.image, { prefix: SAVED_PREFIX }).catch(() => {});
  return { success: true as const };
}

/** A copy of one of the signed-in person's flags, as a new draft. */
export async function duplicateMyFlag(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { success: false as const, message: 'That flag doesn’t exist.' };
  const user = await signedIn();
  if (!user) return { success: false as const, message: 'Sign in to manage your flags.' };
  const [source] = await db
    .select()
    .from(savedFlags)
    .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, user.id)))
    .limit(1);
  if (!source) return { success: false as const, message: 'That flag isn’t in your flags any more.' };
  if (!source.design) return { success: false as const, message: 'Only flags made in the flag maker can be copied.' };
  const [{ total }] = await db.select({ total: count() }).from(savedFlags).where(eq(savedFlags.userId, user.id));
  if (total >= MAX_SAVED_FLAGS) {
    return { success: false as const, message: `You can keep up to ${MAX_SAVED_FLAGS} flags. Delete some to make room.` };
  }
  const name = `${source.name.slice(0, 113)} (copy)`;
  // The copy shares the picture until it's saved; pictures are only deleted once nothing uses them.
  const [row] = await db
    .insert(savedFlags)
    .values({
      userId: user.id,
      name,
      design: source.design,
      image: source.image,
      remixOf: source.remixOf,
      remixOfPostId: source.remixOfPostId,
    })
    .returning({ id: savedFlags.id });
  return { success: true as const, id: row.id };
}
