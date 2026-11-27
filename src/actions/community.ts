'use server';

import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { bannedUsers, flags, follows, notifications, postLikes, savedFlags, users, type NotificationType } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { inEncyclopedia } from '@/lib/encyclopedia';
import { firstFreeSlug, postPath, slugBase } from '@/lib/post-slug';
import {
  listLikedPosts,
  listPosts,
  PINNED_MAX,
  type PostCard,
  type PostRange,
  type PostSort,
} from '@/lib/posts';
import { savePostPaletteLater } from '@/lib/flag-palette';
import { SAVED_PREFIX, uploadSavedFlagImage } from '@/lib/saved-flag-image';
import { deleteImageIfUnused } from '@/lib/storage/unused-image';
import type { StoredStudioDesign } from '@/lib/studio-design';
import { studioDesignSchema } from '@/lib/studio-design-schema';

/*
 * The community side of Vexilo: posting designs to your profile, likes, follows, your profile,
 * and the bell. Every action checks who's signed in itself; nothing trusts an id from the client
 * for who's acting.
 */

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });

/** The signed-in person, if they can take part: a real account that isn't banned. */
async function member(): Promise<{ ok: true; userId: string; username: string } | { ok: false; message: string }> {
  const session = await getServerAuthSession();
  if (!session?.user) return { ok: false, message: 'Sign in first.' };
  const [user] = await db
    .select({ id: users.id, name: users.name, isAnonymous: users.isAnonymous, banned: sql<boolean>`exists (select 1 from ${bannedUsers} where ${bannedUsers.userId} = ${users.id})` })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user) return { ok: false, message: 'Sign in first.' };
  if (user.banned) return { ok: false, message: 'Your account can’t do that.' };
  return { ok: true, userId: user.id, username: user.name };
}

const uuid = z.string().uuid();
const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} '&.-]*$/u);

/** Lowercase tags, unique, without the old maker tags (every post is someone's design). */
function cleanTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag && tag !== 'custom' && tag !== 'remix'))].slice(0, 8);
}

/** A slug for a new post that none of their posts has. */
async function freeSlug(userId: string, name: string) {
  const base = slugBase(name);
  const taken = await db
    .select({ slug: savedFlags.slug })
    .from(savedFlags)
    .where(and(eq(savedFlags.userId, userId), isNotNull(savedFlags.slug), sql`${savedFlags.slug} like ${`${base.slice(0, 50)}%`}`));
  return firstFreeSlug(base, new Set(taken.map((row) => row.slug!)));
}

async function notify(userId: string, actorId: string, type: NotificationType, postId: string | null) {
  if (userId === actorId) return;
  await db.insert(notifications).values({ userId, actorId, type, postId }).onConflictDoNothing();
}

// ───────────────────────── Posting ─────────────────────────

const publishSchema = z.object({
  savedId: uuid.nullable(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  tags: z.array(z.string()).max(12),
  image: z.string().startsWith('data:image/png;base64,').max(12_000_000),
  design: studioDesignSchema,
  remixOf: uuid.nullable(),
  remixOfPostId: uuid.nullable(),
});

export type PublishResult = { success: true; savedId: string; path: string; slug: string; update: boolean } | Fail;

/**
 * Posts a design from the flag maker to the signed-in person's profile, at /@username/slug. It's
 * the saved flag itself (`savedId`, or a new one) with `publishedAt` set, so My flags and the post
 * are always the same thing. Posting one that's already up updates it; its address stays.
 */
export async function publishPost(input: {
  savedId: string | null;
  name: string;
  description: string;
  tags: string[];
  image: string;
  design: StoredStudioDesign;
  remixOf: string | null;
  remixOfPostId: string | null;
}): Promise<PublishResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return fail('Something about this flag is invalid. Try again.');
  const who = await member();
  if (!who.ok) return fail(who.message === 'Sign in first.' ? 'Sign in to post your flag.' : who.message);
  if (!(await allowAuthAttempt('publish-post', who.userId, 60))) return fail('You’ve posted a lot just now. Try again in a few minutes.');
  const { savedId, name, design } = parsed.data;
  const description = parsed.data.description;
  const tags = cleanTags(parsed.data.tags.filter((tag) => tagSchema.safeParse(tag).success));

  const [existing] = savedId
    ? await db
        .select({ id: savedFlags.id, image: savedFlags.image, slug: savedFlags.slug, publishedAt: savedFlags.publishedAt, remixOfPostId: savedFlags.remixOfPostId })
        .from(savedFlags)
        .where(and(eq(savedFlags.id, savedId), eq(savedFlags.userId, who.userId)))
        .limit(1)
    : [];
  if (savedId && !existing) return fail('That flag isn’t in your flags any more.');

  let image: string;
  try {
    image = await uploadSavedFlagImage(who.userId, parsed.data.image);
  } catch {
    return fail('Couldn’t upload your flag. Try again.');
  }

  // What it's a remix of: a post that's up (not your own draft), or a real flag.
  const [parentPost] = parsed.data.remixOfPostId
    ? await db
        .select({ id: savedFlags.id, userId: savedFlags.userId })
        .from(savedFlags)
        .where(and(eq(savedFlags.id, parsed.data.remixOfPostId), isNotNull(savedFlags.publishedAt)))
        .limit(1)
        .then((rows) => rows.filter((row) => row.id !== savedId))
    : [];
  const [parentFlag] =
    !parentPost && parsed.data.remixOf
      ? await db.select({ id: flags.id }).from(flags).where(and(eq(flags.id, parsed.data.remixOf), inEncyclopedia)).limit(1)
      : [];

  const now = new Date();
  // A slug is kept once given, even if it's taken down and posted again.
  const slug = existing?.slug ?? (await freeSlug(who.userId, name));
  let id: string;
  try {
    if (existing) {
      id = existing.id;
      await db
        .update(savedFlags)
        .set({
          name,
          design,
          image,
          description,
          tags,
          slug,
          publishedAt: existing.publishedAt ?? now,
          // Lineage is set when it's first posted; the maker can't rewrite it later.
          ...(existing.publishedAt ? {} : { remixOfPostId: parentPost?.id ?? existing.remixOfPostId ?? null }),
          updatedAt: now,
        })
        .where(eq(savedFlags.id, existing.id));
    } else {
      const [row] = await db
        .insert(savedFlags)
        .values({
          userId: who.userId,
          name,
          design,
          image,
          description,
          tags,
          slug,
          publishedAt: now,
          remixOf: parentFlag?.id ?? null,
          remixOfPostId: parentPost?.id ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: savedFlags.id });
      id = row.id;
    }
  } catch (error) {
    // Two posts racing for the same slug: the unique index catches it.
    console.error('[community] publish failed', error instanceof Error ? error.message : error);
    await deleteImageIfUnused(image, { prefix: SAVED_PREFIX }).catch(() => {});
    return fail('Couldn’t post your flag. Try again.');
  }
  if (existing) await deleteImageIfUnused(existing.image, { prefix: SAVED_PREFIX }).catch(() => {});
  // Its page header takes the flag's colours; read them now rather than on its first visit.
  savePostPaletteLater(id, image);

  const firstTime = !existing?.publishedAt;
  if (firstTime && parentPost) await notify(parentPost.userId, who.userId, 'remix', id);
  revalidatePath(`/u/${who.username}`, 'layout');
  return { success: true, savedId: id, path: postPath(who.username, slug), slug, update: !firstTime };
}

/** Takes a post down: it goes back to being a draft in My flags. Likes and its address are kept. */
export async function unpublishPost(id: string) {
  if (!uuid.safeParse(id).success) return fail('That post doesn’t exist.');
  const who = await member();
  if (!who.ok) return fail(who.message);
  const [row] = await db
    .update(savedFlags)
    .set({ publishedAt: null, updatedAt: new Date() })
    .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, who.userId), isNotNull(savedFlags.publishedAt)))
    .returning({ id: savedFlags.id });
  if (!row) return fail('That post isn’t up any more.');
  // It can't be their profile flag or pinned while it's down.
  await db
    .update(users)
    .set({
      profilePostId: sql`case when ${users.profilePostId} = ${id} then null else ${users.profilePostId} end`,
      pinnedPostIds: sql`array_remove(${users.pinnedPostIds}, ${id}::uuid)`,
    })
    .where(eq(users.id, who.userId));
  revalidatePath(`/u/${who.username}`, 'layout');
  return { success: true as const };
}

const detailsSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  tags: z.array(z.string()).max(12),
});

/** Changes a post's title, description and tags without opening it in the flag maker. */
export async function updatePostDetails(input: { id: string; name: string; description: string; tags: string[] }) {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return fail('Something about that is invalid.');
  const who = await member();
  if (!who.ok) return fail(who.message);
  const tags = cleanTags(parsed.data.tags.filter((tag) => tagSchema.safeParse(tag).success));
  const [row] = await db
    .update(savedFlags)
    .set({ name: parsed.data.name, description: parsed.data.description, tags, updatedAt: new Date() })
    .where(and(eq(savedFlags.id, parsed.data.id), eq(savedFlags.userId, who.userId)))
    .returning({ slug: savedFlags.slug, publishedAt: savedFlags.publishedAt });
  if (!row) return fail('That flag isn’t in your flags any more.');
  return { success: true as const, path: row.slug && row.publishedAt ? postPath(who.username, row.slug) : null };
}

// ───────────────────────── Likes and follows ─────────────────────────

/**
 * Likes (or unlikes) a post. Each is one statement that changes the like and the count together,
 * so they can't drift, and repeating one does nothing.
 */
export async function setPostLike(postId: string, like: boolean) {
  if (!uuid.safeParse(postId).success) return fail('That post doesn’t exist.');
  const who = await member();
  if (!who.ok) return fail(who.message === 'Sign in first.' ? 'Sign in to like flags.' : who.message);
  if (!(await allowAuthAttempt('post-like', who.userId, 400))) return fail('Slow down a little.');

  const changed = like
    ? await db.execute<{ likes: number; user_id: string }>(sql`
        with ins as (
          insert into ${postLikes} (user_id, post_id)
          select ${who.userId}, ${savedFlags.id} from ${savedFlags}
           where ${savedFlags.id} = ${postId} and ${savedFlags.publishedAt} is not null
          on conflict do nothing
          returning post_id
        )
        update ${savedFlags} set likes = ${savedFlags.likes} + 1
         where ${savedFlags.id} in (select post_id from ins)
        returning ${savedFlags.likes} as likes, ${savedFlags.userId} as user_id
      `)
    : await db.execute<{ likes: number; user_id: string }>(sql`
        with del as (
          delete from ${postLikes} where user_id = ${who.userId} and post_id = ${postId}
          returning post_id
        )
        update ${savedFlags} set likes = greatest(${savedFlags.likes} - 1, 0)
         where ${savedFlags.id} in (select post_id from del)
        returning ${savedFlags.likes} as likes, ${savedFlags.userId} as user_id
      `);
  const [row] = rowsOf<{ likes: number; user_id: string }>(changed);
  if (row) {
    if (like) await notify(row.user_id, who.userId, 'like', postId);
    else
      await db
        .delete(notifications)
        .where(and(eq(notifications.actorId, who.userId), eq(notifications.type, 'like'), eq(notifications.postId, postId), isNull(notifications.readAt)));
    return { success: true as const, liked: like, likes: Number(row.likes) };
  }
  // Nothing changed: it was already that way (or the post is gone).
  const [post] = await db.select({ likes: savedFlags.likes }).from(savedFlags).where(and(eq(savedFlags.id, postId), isNotNull(savedFlags.publishedAt)));
  if (!post) return fail('That post isn’t up any more.');
  return { success: true as const, liked: like, likes: post.likes };
}

/** Follows (or unfollows) someone. */
export async function setFollow(userId: string, follow: boolean) {
  if (!uuid.safeParse(userId).success) return fail('That person doesn’t exist.');
  const who = await member();
  if (!who.ok) return fail(who.message === 'Sign in first.' ? 'Sign in to follow people.' : who.message);
  if (who.userId === userId) return fail('You can’t follow yourself.');
  if (!(await allowAuthAttempt('follow', who.userId, 200))) return fail('Slow down a little.');

  if (follow) {
    const [target] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.isAnonymous, false))).limit(1);
    if (!target) return fail('That person doesn’t exist.');
    const inserted = await db.insert(follows).values({ followerId: who.userId, followingId: userId }).onConflictDoNothing().returning();
    if (inserted.length) await notify(userId, who.userId, 'follow', null);
  } else {
    await db.delete(follows).where(and(eq(follows.followerId, who.userId), eq(follows.followingId, userId)));
    await db
      .delete(notifications)
      .where(and(eq(notifications.actorId, who.userId), eq(notifications.userId, userId), eq(notifications.type, 'follow'), isNull(notifications.readAt)));
  }
  const [{ followers }] = rowsOf<{ followers: number }>(
    await db.execute<{ followers: number }>(sql`select count(*)::int as followers from ${follows} where following_id = ${userId}`),
  );
  return { success: true as const, following: follow, followers: Number(followers) };
}

// ───────────────────────── Profile ─────────────────────────

const profileSchema = z.object({
  bio: z.string().trim().max(160),
  link: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === '' || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value), 'Links start with http:// or https://'),
  location: z.string().trim().max(60),
  /** One of their posts, or a real flag, or neither. */
  profileFlag: z.union([z.object({ kind: z.literal('post'), id: uuid }), z.object({ kind: z.literal('flag'), id: uuid }), z.null()]),
  pinnedPostIds: z.array(uuid).max(PINNED_MAX),
});

export type ProfileInput = z.input<typeof profileSchema>;

/** Updates the signed-in person's bio, link, location, profile flag and pinned posts. */
export async function updateProfile(input: ProfileInput) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Something about that is invalid.');
  const who = await member();
  if (!who.ok) return fail(who.message);
  const { bio, link, location, profileFlag } = parsed.data;
  const bioLine = bio.replace(/\s*\n\s*/g, ' ');

  // Pinned and profile posts have to be their own, and up.
  const wanted = [...new Set([...parsed.data.pinnedPostIds, ...(profileFlag?.kind === 'post' ? [profileFlag.id] : [])])];
  const own = wanted.length
    ? new Set(
        (
          await db
            .select({ id: savedFlags.id })
            .from(savedFlags)
            .where(and(inArray(savedFlags.id, wanted), eq(savedFlags.userId, who.userId), isNotNull(savedFlags.publishedAt)))
        ).map((row) => row.id),
      )
    : new Set<string>();
  const pinned = [...new Set(parsed.data.pinnedPostIds)].filter((id) => own.has(id));

  let favoriteFlagId: string | null | undefined;
  let profilePostId: string | null = null;
  if (profileFlag?.kind === 'post') {
    if (!own.has(profileFlag.id)) return fail('That post isn’t up any more.');
    profilePostId = profileFlag.id;
  } else if (profileFlag?.kind === 'flag') {
    const [flag] = await db.select({ id: flags.id }).from(flags).where(and(eq(flags.id, profileFlag.id), inEncyclopedia)).limit(1);
    if (!flag) return fail('That flag doesn’t exist.');
    favoriteFlagId = flag.id;
  } else {
    favoriteFlagId = null;
  }

  await db
    .update(users)
    .set({
      bio: bioLine,
      link,
      location,
      pinnedPostIds: pinned,
      profilePostId,
      // A post as the profile flag leaves their real favourite as it was, for when they switch back.
      ...(favoriteFlagId !== undefined ? { favoriteFlagId } : {}),
    })
    .where(eq(users.id, who.userId));
  revalidatePath(`/u/${who.username}`, 'layout');
  return { success: true as const };
}

/** Pins a post to the top of the signed-in person's profile, or unpins it. */
export async function setPinned(postId: string, pinned: boolean) {
  if (!uuid.safeParse(postId).success) return fail('That post doesn’t exist.');
  const who = await member();
  if (!who.ok) return fail(who.message);
  const [user] = await db.select({ pinned: users.pinnedPostIds }).from(users).where(eq(users.id, who.userId));
  const current = user?.pinned ?? [];
  if (pinned) {
    if (current.includes(postId)) return { success: true as const, pinned: current };
    if (current.length >= PINNED_MAX) return fail(`You can pin up to ${PINNED_MAX}. Unpin one first.`);
    const [post] = await db
      .select({ id: savedFlags.id })
      .from(savedFlags)
      .where(and(eq(savedFlags.id, postId), eq(savedFlags.userId, who.userId), isNotNull(savedFlags.publishedAt)));
    if (!post) return fail('That post isn’t up any more.');
  }
  const next = pinned ? [...current, postId] : current.filter((id) => id !== postId);
  await db.update(users).set({ pinnedPostIds: next }).where(eq(users.id, who.userId));
  revalidatePath(`/u/${who.username}`, 'layout');
  return { success: true as const, pinned: next };
}

// ───────────────────────── Notifications ─────────────────────────

export type NotificationGroup = {
  key: string;
  type: NotificationType;
  actors: { username: string; image: string | null }[];
  /** How many people in all, when there are more than `actors` shows. */
  total: number;
  post: { name: string; image: string; path: string } | null;
  at: Date;
  unread: boolean;
};

/**
 * The signed-in person's recent notifications, grouped: likes by post ("ana and 4 others liked
 * X"), follows together, remixes one by one.
 */
export async function getNotifications(): Promise<{ groups: NotificationGroup[]; unread: number } | null> {
  const session = await getServerAuthSession();
  if (!session?.user) return null;
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      postId: notifications.postId,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      actorName: users.name,
      actorImage: users.image,
      postName: savedFlags.name,
      postImage: savedFlags.image,
      postSlug: savedFlags.slug,
      postAuthor: sql<string | null>`(select name from ${users} u2 where u2.id = ${savedFlags.userId})`,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.actorId))
    .leftJoin(savedFlags, and(eq(savedFlags.id, notifications.postId), isNotNull(savedFlags.publishedAt)))
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(200);

  const groups = new Map<string, NotificationGroup>();
  let unread = 0;
  for (const row of rows) {
    if (!row.readAt) unread++;
    const key = row.type === 'remix' ? `remix:${row.id}` : row.type === 'follow' ? 'follow' : `like:${row.postId}`;
    const post =
      row.postName && row.postImage && row.postSlug && row.postAuthor
        ? { name: row.postName, image: row.postImage, path: postPath(row.postAuthor, row.postSlug) }
        : null;
    if (row.type !== 'follow' && !post) continue;
    const group = groups.get(key);
    if (group) {
      group.total++;
      if (group.actors.length < 3) group.actors.push({ username: row.actorName, image: row.actorImage });
      if (!row.readAt) group.unread = true;
      continue;
    }
    groups.set(key, {
      key,
      type: row.type,
      actors: [{ username: row.actorName, image: row.actorImage }],
      total: 1,
      post,
      at: row.createdAt,
      unread: !row.readAt,
    });
  }
  return { groups: [...groups.values()].slice(0, 40), unread };
}

/** How many unread notifications the signed-in person has, for the bell. */
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getServerAuthSession();
  if (!session?.user) return 0;
  const [row] = rowsOf<{ n: number }>(
    await db.execute<{ n: number }>(
      sql`select count(*)::int as n from ${notifications} where user_id = ${session.user.id} and read_at is null`,
    ),
  );
  return Number(row?.n ?? 0);
}

export async function markNotificationsRead() {
  const session = await getServerAuthSession();
  if (!session?.user) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));
}

/**
 * Counts a view of a post: once per browser per day (`unique`, which the page works out from
 * local storage), so refreshing doesn't inflate it. Not counted for the post's own author.
 */
export async function recordPostView(postId: string, unique: boolean) {
  if (!unique || !uuid.safeParse(postId).success) return;
  const session = await getServerAuthSession();
  const viewerId = session?.user?.id ?? null;
  await db
    .update(savedFlags)
    .set({ views: sql`${savedFlags.views} + 1` })
    .where(
      and(
        eq(savedFlags.id, postId),
        isNotNull(savedFlags.publishedAt),
        viewerId ? sql`${savedFlags.userId} <> ${viewerId}` : undefined,
      ),
    );
}

// ───────────────────────── Feeds ─────────────────────────

const feedSchema = z.object({
  sort: z.enum(['popular', 'new', 'following']).default('popular'),
  range: z.enum(['today', 'week', 'month', 'all']).default('week'),
  offset: z.number().int().min(0).max(5000).default(0),
  authorId: uuid.optional(),
  remixes: z.boolean().optional(),
  tag: z.string().max(40).optional(),
  search: z.string().max(80).optional(),
  remixOfFlagId: uuid.optional(),
  remixOfPostId: uuid.optional(),
  likedBy: uuid.optional(),
});

export type FeedRequest = {
  sort?: PostSort;
  range?: PostRange;
  offset?: number;
  authorId?: string;
  remixes?: boolean;
  tag?: string;
  search?: string;
  remixOfFlagId?: string;
  remixOfPostId?: string;
  likedBy?: string;
};

/** More posts for an infinite list, as the signed-in person sees them. */
export async function loadPosts(request: FeedRequest): Promise<{ posts: PostCard[]; hasMore: boolean }> {
  const parsed = feedSchema.safeParse(request);
  if (!parsed.success) return { posts: [], hasMore: false };
  const session = await getServerAuthSession();
  const viewerId = session?.user?.id ?? null;
  const { likedBy, ...query } = parsed.data;
  if (likedBy) return listLikedPosts(likedBy, viewerId, query.offset);
  return listPosts({ ...query, viewerId });
}

/** drizzle's neon-http and node-postgres drivers return execute() results differently. */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
