"use server";

import { db } from "@/db";
import {
  favorites,
  flagOfTheDay,
  flagRequests,
  flags,
  users,
} from "@/db/schema";
import { getServerAuthSession } from "@/lib/auth";
import { Flag } from "@/lib/types";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";

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
  orderDirection: "asc" | "desc"
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
  orderDirection: "asc" | "desc" = "desc"
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
    .where(whereClause)
    .orderBy(
      query
        ? sql`similarity(${flags.name}, ${query}) DESC`
        : orderByClause(orderBy, orderDirection)
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
  orderDirection: "asc" | "desc" = "desc"
) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((res) => res[0]);

  if (!user) {
    return {
      success: false,
      message: "User not found.",
    };
  }

  const boundedLimit = Math.min(limit, 100);

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
      isFavorite: await isFavorite()
    })
    .from(flags)
    .where(and(ilike(flags.name, `%${query}%`), await isFavorite(userId)))
    .orderBy(
      query
        ? sql`similarity(${flags.name}, ${query}) DESC`
        : orderByClause(orderBy, orderDirection)
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
  orderDirection: "asc" | "desc" = "desc"
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
    orderDirection
  );
}

export async function getFlagsCount(query?: string) {
  const whereClause = buildWhereClause(query);

  const cnt = await db
    .select({ count: count() })
    .from(flags)
    .where(whereClause);

  return cnt[0].count;
}

export async function getFavoriteFlagsCount(query?: string) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return 0;
  }

  const cnt = await db
    .select({ count: count() })
    .from(flags)
    .where(and(ilike(flags.name, `%${query}%`), await isFavorite()));

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
      };
    });

    await db.insert(flags).values(validatedFlags);

    return true;
  } catch (error) {
    console.error("Error creating admin flags:", error);
    throw new Error(
      `Failed to import flags: ${error instanceof Error ? error.message : "Unknown error"
      }`
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
      and(
        eq(favorites.userId, session.user.id),
        eq(favorites.flagId, flagId)
      )
    );

  if (existingFavorite.length > 0) {
    await db
      .delete(favorites)
      .where(eq(favorites.id, existingFavorite[0].id));

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
    .innerJoin(
      flagRequests,
      eq(flags.id, sql`${flagRequests.flagId}::uuid`)
    )
    .where(
      and(
        eq(flagRequests.userId, user.id),
        eq(flagRequests.approved, true),
        eq(flagRequests.isEdit, false)
      )
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
    .from(flags)
    .where(eq(flags.id, userFlags[0].id));

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
        eq(flagRequests.isEdit, false)
      )
    );

  const totalEditCount = await db
    .select({ count: count() })
    .from(flagRequests)
    .where(
      and(
        eq(flagRequests.userId, user.id),
        eq(flagRequests.approved, true),
        eq(flagRequests.isEdit, true)
      )
    );

  return {
    totalFlagCount: totalFlagCount[0].count,
    totalEditCount: totalEditCount[0].count,
  };
}

export async function getProfileUserFavorites(
  userNumber: string,
  page: number
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
    "desc"
  )

  const totalFlagsCount = await db
    .select({ count: count() })
    .from(flags)
    .where(await isFavorite(user.id))

  return {
    flags: userFlags,
    count: totalFlagsCount[0].count,
  };
}
