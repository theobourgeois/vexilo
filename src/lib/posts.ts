import { and, count, desc, eq, gte, ilike, inArray, isNotNull, or, sql, sum, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { contestEntries, contests, flagRequests, flags, follows, postLikes, savedFlags, users } from '@/db/schema';
import { inEncyclopedia } from '@/lib/encyclopedia';
import { postPath } from '@/lib/post-slug';
import { getProfileFlag, type ProfileFlag } from '@/lib/profile-flag';

/*
 * Reading posts: flags people designed, published on their profile at /@username/slug. A post is
 * a saved flag with `publishedAt` set. These trust the `viewerId` they're given; server actions
 * and pages pass the signed-in user's.
 */

export type PostAuthor = { id: string; username: string; image: string | null };

/** What it's a remix of: a real flag, or someone's post. */
export type PostLineage = { kind: 'flag' | 'post'; name: string; href: string; image: string; author: string | null };

export type PostCard = {
  id: string;
  slug: string;
  name: string;
  image: string;
  path: string;
  likes: number;
  views: number;
  publishedAt: Date;
  author: PostAuthor;
  remixOf: PostLineage | null;
  liked: boolean;
};

export type PostSort = 'popular' | 'new' | 'following';
export type PostRange = 'today' | 'week' | 'month' | 'all';

/** Below this many likes a post isn't indexed by search engines (or listed in the sitemap). */
export const INDEXABLE_LIKES = 5;
export const FEED_PAGE_SIZE = 24;
export const PINNED_MAX = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_MS: Record<Exclude<PostRange, 'all'>, number> = { today: DAY_MS, week: 7 * DAY_MS, month: 30 * DAY_MS };

const remixFlag = alias(flags, 'remix_flag');
const parentPost = alias(savedFlags, 'parent_post');
const parentAuthor = alias(users, 'parent_author');

export const isPublished = isNotNull(savedFlags.publishedAt);

function likedBy(viewerId: string | null): SQL<boolean> {
  if (!viewerId) return sql<boolean>`false`;
  return sql<boolean>`exists (select 1 from ${postLikes} where ${postLikes.postId} = ${savedFlags.id} and ${postLikes.userId} = ${viewerId})`;
}

function cardColumns(viewerId: string | null) {
  return {
    id: savedFlags.id,
    slug: savedFlags.slug,
    name: savedFlags.name,
    image: savedFlags.image,
    likes: savedFlags.likes,
    views: savedFlags.views,
    publishedAt: savedFlags.publishedAt,
    authorId: users.id,
    authorName: users.name,
    authorImage: users.image,
    remixFlagName: remixFlag.name,
    remixFlagImage: remixFlag.image,
    parentSlug: parentPost.slug,
    parentName: parentPost.name,
    parentImage: parentPost.image,
    parentAuthor: parentAuthor.name,
    liked: likedBy(viewerId),
  };
}

type CardRow = {
  id: string;
  slug: string | null;
  name: string;
  image: string;
  likes: number;
  views: number;
  publishedAt: Date | null;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  remixFlagName: string | null;
  remixFlagImage: string | null;
  parentSlug: string | null;
  parentName: string | null;
  parentImage: string | null;
  parentAuthor: string | null;
  liked: boolean;
};

function lineageOf(row: Pick<CardRow, 'remixFlagName' | 'remixFlagImage' | 'parentSlug' | 'parentName' | 'parentImage' | 'parentAuthor'>): PostLineage | null {
  if (row.parentSlug && row.parentName && row.parentAuthor && row.parentImage) {
    return { kind: 'post', name: row.parentName, href: postPath(row.parentAuthor, row.parentSlug), image: row.parentImage, author: row.parentAuthor };
  }
  if (row.remixFlagName && row.remixFlagImage) {
    return { kind: 'flag', name: row.remixFlagName, href: `/flag/${encodeURIComponent(row.remixFlagName)}`, image: row.remixFlagImage, author: null };
  }
  return null;
}

function toCard(row: CardRow): PostCard {
  return {
    id: row.id,
    slug: row.slug!,
    name: row.name,
    image: row.image,
    path: postPath(row.authorName, row.slug!),
    likes: row.likes,
    views: row.views,
    publishedAt: row.publishedAt!,
    author: { id: row.authorId, username: row.authorName, image: row.authorImage },
    remixOf: lineageOf(row),
    liked: Boolean(row.liked),
  };
}

function cardQuery(viewerId: string | null) {
  return db
    .select(cardColumns(viewerId))
    .from(savedFlags)
    .innerJoin(users, eq(users.id, savedFlags.userId))
    // Only real flags still in the encyclopedia count as a remix source.
    .leftJoin(remixFlag, and(eq(remixFlag.id, savedFlags.remixOf), sql`${remixFlag.movedToPostId} IS NULL`))
    .leftJoin(parentPost, and(eq(parentPost.id, savedFlags.remixOfPostId), isNotNull(parentPost.publishedAt)))
    .leftJoin(parentAuthor, eq(parentAuthor.id, parentPost.userId));
}

export type PostQuery = {
  sort?: PostSort;
  range?: PostRange;
  viewerId: string | null;
  offset?: number;
  limit?: number;
  authorId?: string;
  /** Only remixes (of anything), or only designs from scratch. */
  remixes?: boolean;
  tag?: string;
  search?: string;
  remixOfFlagId?: string;
  remixOfPostId?: string;
  excludeIds?: string[];
};

/** A page of posts. Returns one extra to tell whether there's more. */
export async function listPosts(query: PostQuery): Promise<{ posts: PostCard[]; hasMore: boolean }> {
  const { sort = 'new', range = 'all', viewerId, offset = 0, limit = FEED_PAGE_SIZE } = query;
  const conditions: (SQL | undefined)[] = [isPublished, isNotNull(savedFlags.slug)];
  if (query.authorId) conditions.push(eq(savedFlags.userId, query.authorId));
  if (query.remixes === true) conditions.push(sql`(${savedFlags.remixOf} IS NOT NULL OR ${savedFlags.remixOfPostId} IS NOT NULL)`);
  if (query.remixes === false) conditions.push(sql`(${savedFlags.remixOf} IS NULL AND ${savedFlags.remixOfPostId} IS NULL)`);
  if (query.tag) conditions.push(sql`${query.tag} = ANY(${savedFlags.tags})`);
  if (query.search?.trim()) {
    const term = `%${query.search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(savedFlags.name, term), ilike(users.name, term), sql`${query.search.trim().toLowerCase()} = ANY(${savedFlags.tags})`));
  }
  if (query.remixOfFlagId) conditions.push(eq(savedFlags.remixOf, query.remixOfFlagId));
  if (query.remixOfPostId) conditions.push(eq(savedFlags.remixOfPostId, query.remixOfPostId));
  if (query.excludeIds?.length) conditions.push(sql`${savedFlags.id} NOT IN (${sql.join(query.excludeIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
  if (range !== 'all' && sort === 'popular') conditions.push(gte(savedFlags.publishedAt, new Date(Date.now() - RANGE_MS[range])));
  if (sort === 'following') {
    if (!viewerId) return { posts: [], hasMore: false };
    conditions.push(sql`${savedFlags.userId} IN (select ${follows.followingId} from ${follows} where ${follows.followerId} = ${viewerId})`);
  }

  const order = sort === 'popular' ? [desc(savedFlags.likes), desc(savedFlags.publishedAt)] : [desc(savedFlags.publishedAt)];
  const rows = await cardQuery(viewerId)
    .where(and(...conditions))
    .orderBy(...order, desc(savedFlags.id))
    .limit(limit + 1)
    .offset(offset);
  return { posts: rows.slice(0, limit).map(toCard), hasMore: rows.length > limit };
}

/** Posts someone liked, most recently liked first. */
export async function listLikedPosts(userId: string, viewerId: string | null, offset = 0, limit = FEED_PAGE_SIZE) {
  const rows = await cardQuery(viewerId)
    .innerJoin(postLikes, and(eq(postLikes.postId, savedFlags.id), eq(postLikes.userId, userId)))
    .where(and(isPublished, isNotNull(savedFlags.slug)))
    .orderBy(desc(postLikes.createdAt))
    .limit(limit + 1)
    .offset(offset);
  return { posts: rows.slice(0, limit).map(toCard), hasMore: rows.length > limit };
}

/** Particular posts, in the order given (pinned posts). */
export async function getPostCards(ids: string[], viewerId: string | null): Promise<PostCard[]> {
  if (ids.length === 0) return [];
  const rows = await cardQuery(viewerId).where(and(inArray(savedFlags.id, ids), isPublished, isNotNull(savedFlags.slug)));
  const byId = new Map(rows.map((row) => [row.id, toCard(row)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export type PostDetail = PostCard & {
  description: string;
  tags: string[];
  ratio: [number, number] | null;
  hasDesign: boolean;
  remixCount: number;
  updatedAt: Date;
  authorBio: string;
  authorFollowers: number;
  following: boolean;
  isMine: boolean;
  /** The flag it was in the encyclopedia as, before posts (moved flags). */
  legacyFlagId: string | null;
  remixOfFlagId: string | null;
  remixOfPostId: string | null;
};

/** A published post by its address. Usernames match case-insensitively; slugs are lowercase. */
export async function getPost(username: string, slug: string, viewerId: string | null): Promise<PostDetail | null> {
  const [row] = await cardQuery(viewerId)
    .where(and(sql`lower(${users.name}) = lower(${username})`, eq(savedFlags.slug, slug.toLowerCase()), isPublished))
    .limit(1);
  if (!row) return null;

  const [[extra], [{ remixes }], [{ followers }], following] = await Promise.all([
    db
      .select({
        description: savedFlags.description,
        tags: savedFlags.tags,
        ratio: sql<[number, number] | null>`${savedFlags.design}->'ratio'`,
        hasDesign: sql<boolean>`${savedFlags.design} IS NOT NULL`,
        updatedAt: savedFlags.updatedAt,
        flagId: savedFlags.flagId,
        remixOf: savedFlags.remixOf,
        remixOfPostId: savedFlags.remixOfPostId,
        bio: users.bio,
      })
      .from(savedFlags)
      .innerJoin(users, eq(users.id, savedFlags.userId))
      .where(eq(savedFlags.id, row.id)),
    db.select({ remixes: count() }).from(savedFlags).where(and(eq(savedFlags.remixOfPostId, row.id), isPublished)),
    db.select({ followers: count() }).from(follows).where(eq(follows.followingId, row.authorId)),
    viewerId && viewerId !== row.authorId
      ? db
          .select({ id: follows.followerId })
          .from(follows)
          .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, row.authorId)))
          .limit(1)
          .then((rows) => rows.length > 0)
      : Promise.resolve(false),
  ]);

  return {
    ...toCard(row),
    description: extra.description,
    tags: extra.tags,
    ratio: Array.isArray(extra.ratio) && extra.ratio.length === 2 ? extra.ratio : null,
    hasDesign: extra.hasDesign,
    remixCount: remixes,
    updatedAt: extra.updatedAt,
    authorBio: extra.bio,
    authorFollowers: followers,
    following,
    isMine: viewerId === row.authorId,
    legacyFlagId: extra.flagId,
    remixOfFlagId: extra.remixOf,
    remixOfPostId: extra.remixOfPostId,
  };
}

/** The address of a post by id, if it's published. */
export async function getPostPathById(id: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: savedFlags.slug, username: users.name })
    .from(savedFlags)
    .innerJoin(users, eq(users.id, savedFlags.userId))
    .where(and(eq(savedFlags.id, id), isPublished))
    .limit(1);
  return row?.slug ? postPath(row.username, row.slug) : null;
}

export type Profile = {
  id: string;
  username: string;
  image: string | null;
  bio: string;
  link: string;
  location: string;
  joinedAt: Date;
  isTrusted: boolean;
  isAdmin: boolean;
  profileFlag: ProfileFlag | null;
  pinnedPostIds: string[];
  favoriteFlagId: string | null;
  profilePostId: string | null;
  stats: { posts: number; remixes: number; followers: number; following: number; likes: number; encyclopedia: number };
  contestWins: { title: string; slug: string }[];
  followingThem: boolean;
  followsYou: boolean;
  isMe: boolean;
};

/** Someone's public profile by username. Null for nobody, or someone who chose to stay anonymous. */
export async function getProfile(username: string, viewerId: string | null): Promise<Profile | null> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      bio: users.bio,
      link: users.link,
      location: users.location,
      createdAt: users.createdAt,
      isTrusted: users.isTrusted,
      isAdmin: users.isAdmin,
      isAnonymous: users.isAnonymous,
      favoriteFlagId: users.favoriteFlagId,
      profilePostId: users.profilePostId,
      pinnedPostIds: users.pinnedPostIds,
    })
    .from(users)
    .where(sql`lower(${users.name}) = lower(${username})`)
    .limit(1);
  if (!user || user.isAnonymous) return null;

  const [[posts], [{ followers }], [{ following }], [{ encyclopedia }], wins, relation, profileFlag] = await Promise.all([
    db
      .select({
        posts: count(),
        remixes: sql<number>`count(*) filter (where ${savedFlags.remixOf} is not null or ${savedFlags.remixOfPostId} is not null)`.mapWith(Number),
        likes: sum(savedFlags.likes).mapWith(Number),
      })
      .from(savedFlags)
      .where(and(eq(savedFlags.userId, user.id), isPublished)),
    db.select({ followers: count() }).from(follows).where(eq(follows.followingId, user.id)),
    db.select({ following: count() }).from(follows).where(eq(follows.followerId, user.id)),
    // Real flags they added to the encyclopedia.
    db
      .select({ encyclopedia: sql<number>`count(distinct ${flags.id})`.mapWith(Number) })
      .from(flags)
      .innerJoin(sql`vexilo_flag_request r`, sql`r.flag_id = ${flags.id}::text and r.approved and not r.is_edit and r.user_id = ${user.id}`)
      .where(inEncyclopedia),
    db
      .select({ title: contests.title, slug: contests.slug })
      .from(contests)
      .innerJoin(contestEntries, eq(contestEntries.id, contests.winnerEntryId))
      .where(eq(contestEntries.userId, user.id)),
    viewerId && viewerId !== user.id
      ? db
          .select({ followerId: follows.followerId })
          .from(follows)
          .where(
            or(
              and(eq(follows.followerId, viewerId), eq(follows.followingId, user.id)),
              and(eq(follows.followerId, user.id), eq(follows.followingId, viewerId)),
            ),
          )
      : Promise.resolve([] as { followerId: string }[]),
    getProfileFlag(user),
  ]);

  return {
    id: user.id,
    username: user.name,
    image: user.image,
    bio: user.bio,
    link: user.link,
    location: user.location,
    joinedAt: user.createdAt,
    isTrusted: user.isTrusted,
    isAdmin: user.isAdmin,
    profileFlag,
    pinnedPostIds: user.pinnedPostIds,
    favoriteFlagId: user.favoriteFlagId,
    profilePostId: user.profilePostId,
    stats: {
      posts: posts?.posts ?? 0,
      remixes: posts?.remixes ?? 0,
      followers,
      following,
      likes: posts?.likes ?? 0,
      encyclopedia,
    },
    contestWins: wins,
    followingThem: relation.some((r) => r.followerId === viewerId),
    followsYou: relation.some((r) => r.followerId === user.id),
    isMe: viewerId === user.id,
  };
}

export type CreatorCard = {
  id: string;
  username: string;
  image: string | null;
  bio: string;
  followers: number;
  likes: number;
  posts: number;
  /** A few of their most liked posts. */
  showcase: { name: string; image: string; path: string }[];
  following: boolean;
};

/** People whose posts got the most likes (in the range), with a few of their best. */
export async function getTopCreators(opts: { viewerId: string | null; range?: PostRange; limit?: number; excludeFollowed?: boolean }): Promise<CreatorCard[]> {
  const { viewerId, range = 'all', limit = 5 } = opts;
  const since = range === 'all' ? undefined : gte(savedFlags.publishedAt, new Date(Date.now() - RANGE_MS[range]));
  const notFollowed =
    opts.excludeFollowed && viewerId
      ? sql`${users.id} <> ${viewerId} and ${users.id} not in (select ${follows.followingId} from ${follows} where ${follows.followerId} = ${viewerId})`
      : undefined;
  const likes = sum(savedFlags.likes).mapWith(Number);
  const top = await db
    .select({ id: users.id, username: users.name, image: users.image, bio: users.bio, likes, posts: count() })
    .from(savedFlags)
    .innerJoin(users, eq(users.id, savedFlags.userId))
    .where(and(isPublished, eq(users.isAnonymous, false), since, notFollowed))
    .groupBy(users.id)
    .orderBy(desc(likes), desc(count()))
    .limit(limit);
  if (top.length === 0) return [];
  const ids = top.map((user) => user.id);

  const [followerRows, showcaseRows, followingRows] = await Promise.all([
    db.select({ id: follows.followingId, followers: count() }).from(follows).where(inArray(follows.followingId, ids)).groupBy(follows.followingId),
    db.execute<{ user_id: string; name: string; image: string; slug: string }>(sql`
      select user_id, name, image, slug from (
        select ${savedFlags.userId} as user_id, ${savedFlags.name} as name, ${savedFlags.image} as image, ${savedFlags.slug} as slug,
               row_number() over (partition by ${savedFlags.userId} order by ${savedFlags.likes} desc, ${savedFlags.publishedAt} desc) as n
          from ${savedFlags}
         where ${savedFlags.publishedAt} is not null and ${savedFlags.slug} is not null
           and ${savedFlags.userId} in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
      ) ranked where n <= 3
    `),
    viewerId
      ? db.select({ id: follows.followingId }).from(follows).where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, ids)))
      : Promise.resolve([] as { id: string }[]),
  ]);
  const followersById = new Map(followerRows.map((row) => [row.id, row.followers]));
  const followingIds = new Set(followingRows.map((row) => row.id));
  const showcase = 'rows' in showcaseRows ? showcaseRows.rows : (showcaseRows as unknown as { user_id: string; name: string; image: string; slug: string }[]);

  return top.map((user) => ({
    id: user.id,
    username: user.username,
    image: user.image,
    bio: user.bio,
    followers: followersById.get(user.id) ?? 0,
    likes: user.likes ?? 0,
    posts: user.posts,
    showcase: showcase
      .filter((post) => post.user_id === user.id)
      .map((post) => ({ name: post.name, image: post.image, path: postPath(user.username, post.slug) })),
    following: followingIds.has(user.id),
  }));
}

/** Real flags people remix most, with how many remixes each has. */
export async function getMostRemixedFlags(limit = 5) {
  const remixes = count();
  return db
    .select({ id: flags.id, name: flags.name, image: flags.image, remixes })
    .from(savedFlags)
    .innerJoin(flags, eq(flags.id, savedFlags.remixOf))
    .where(and(isPublished, inEncyclopedia))
    .groupBy(flags.id)
    .orderBy(desc(remixes))
    .limit(limit);
}

/** People who follow someone, or whom they follow. */
export async function listFollows(userId: string, direction: 'followers' | 'following', viewerId: string | null, limit = 60) {
  const other = direction === 'followers' ? follows.followerId : follows.followingId;
  const self = direction === 'followers' ? follows.followingId : follows.followerId;
  const rows = await db
    .select({
      id: users.id,
      username: users.name,
      image: users.image,
      bio: users.bio,
      following: viewerId
        ? sql<boolean>`exists (select 1 from ${follows} f2 where f2.follower_id = ${viewerId} and f2.following_id = ${users.id})`
        : sql<boolean>`false`,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, other))
    .where(and(eq(self, userId), eq(users.isAnonymous, false)))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, following: Boolean(row.following) }));
}

/** How many posts there are and how many people made them, for the community page's header. */
export async function getCommunityTotals() {
  const [row] = await db
    .select({ posts: count(), creators: sql<number>`count(distinct ${savedFlags.userId})`.mapWith(Number) })
    .from(savedFlags)
    .where(and(isPublished, isNotNull(savedFlags.slug)));
  return { posts: row?.posts ?? 0, creators: row?.creators ?? 0 };
}

/** Tags used most on posts, for the community page's filters. */
export async function getPopularPostTags(limit = 8) {
  const rows = rowsOfResult<{ tag: string; n: number }>(
    await db.execute(sql`
      select tag, count(*)::int as n
        from ${savedFlags}, unnest(${savedFlags.tags}) as tag
       where ${savedFlags.publishedAt} is not null
       group by tag order by n desc, tag limit ${limit}
    `),
  );
  return rows.map((row) => row.tag);
}

function rowsOfResult<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/**
 * What a post was remixed from, from the start: the real flag it began as (if any), then each post
 * in between, oldest first. Stops at 6 steps, and at a post that's been taken down.
 */
export async function getLineage(postId: string): Promise<PostLineage[]> {
  const rows = rowsOfResult<{ depth: number; name: string; image: string; slug: string | null; username: string; remix_of: string | null; published: boolean }>(
    await db.execute(sql`
      with recursive chain as (
        select p.remix_of_post_id as id, p.remix_of as flag_id, 1 as depth
          from ${savedFlags} p where p.id = ${postId}
        union all
        select p.remix_of_post_id, p.remix_of, chain.depth + 1
          from chain join ${savedFlags} p on p.id = chain.id
         where chain.depth < 6 and p.published_at is not null
      )
      select chain.depth, p.name, p.image, p.slug, u.name as username, p.remix_of, (p.published_at is not null) as published
        from chain join ${savedFlags} p on p.id = chain.id join ${users} u on u.id = p.user_id
       order by chain.depth
    `),
  );
  const posts: PostLineage[] = [];
  let originFlagId: string | null = null;
  for (const row of rows) {
    if (!row.published || !row.slug) break;
    posts.push({ kind: 'post', name: row.name, href: postPath(row.username, row.slug), image: row.image, author: row.username });
    originFlagId = row.remix_of;
  }
  if (rows.length === 0 || posts.length === rows.length) {
    // The chain ended at a design from scratch, or at a real flag.
    const [self] = rows.length ? [] : await db.select({ remixOf: savedFlags.remixOf }).from(savedFlags).where(eq(savedFlags.id, postId));
    const flagId = rows.length ? originFlagId : (self?.remixOf ?? null);
    if (flagId) {
      const [flag] = await db.select({ name: flags.name, image: flags.image }).from(flags).where(and(eq(flags.id, flagId), inEncyclopedia));
      if (flag) posts.push({ kind: 'flag', name: flag.name, href: `/flag/${encodeURIComponent(flag.name)}`, image: flag.image, author: null });
    }
  }
  return posts.reverse();
}

export const ENCYCLOPEDIA_PAGE_SIZE = 48;

/** Real flags someone added to the encyclopedia, newest first. */
export async function listEncyclopediaFlags(userId: string, page = 1) {
  const where = and(eq(flagRequests.userId, userId), eq(flagRequests.approved, true), eq(flagRequests.isEdit, false), inEncyclopedia);
  const [rows, [{ total }]] = await Promise.all([
    db
      .selectDistinctOn([flags.id, flagRequests.createdAt], { id: flags.id, name: flags.name, image: flags.image, createdAt: flagRequests.createdAt })
      .from(flags)
      .innerJoin(flagRequests, eq(flags.id, sql`${flagRequests.flagId}::uuid`))
      .where(where)
      .orderBy(desc(flagRequests.createdAt), flags.id)
      .limit(ENCYCLOPEDIA_PAGE_SIZE)
      .offset((Math.max(page, 1) - 1) * ENCYCLOPEDIA_PAGE_SIZE),
    db
      .select({ total: sql<number>`count(distinct ${flags.id})`.mapWith(Number) })
      .from(flags)
      .innerJoin(flagRequests, eq(flags.id, sql`${flagRequests.flagId}::uuid`))
      .where(where),
  ]);
  return {
    flags: rows.map((row) => ({ id: row.id, name: row.name, image: row.image, href: `/flag/${encodeURIComponent(row.name)}` })),
    total,
  };
}
