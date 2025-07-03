"use server";

import { db } from "@/db";
import { flagOfTheDay, flags } from "@/db/schema";
import { getServerAuthSession } from "@/lib/auth";
import { Flag } from "@/lib/types";
import { asc, count, desc, eq, sql } from "drizzle-orm";

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
  // Get 4 random flags directly from the database
  const randomFlags = await db
    .select()
    .from(flags)
    .orderBy(sql`RANDOM()`)
    .limit(4);
  return randomFlags;
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
    .select()
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

export async function getFlags(
  page: number,
  limit: number,
  query?: string,
  orderBy: keyof typeof flags.$inferSelect = "updatedAt",
  orderDirection: "asc" | "desc" = "desc"
) {
  const whereClause = buildWhereClause(query);

  const orderByClause = () => {
    if (orderDirection === "asc") {
      return asc(flags[orderBy]);
    }
    return desc(flags[orderBy]);
  };

  return await db
    .select()
    .from(flags)
    .where(whereClause)
    .orderBy(
      query
        ? sql`similarity(${flags.name}, ${query}) DESC`
        : orderByClause()
      // query
      //   ? sql`similarity(${flags.name}, ${query}) DESC`
      //   : sql`1=1`
    )
    .limit(limit)
    .offset((page - 1) * limit);
}

export async function getFlagsCount(query?: string) {
  const whereClause = buildWhereClause(query);

  const cnt = await db
    .select({ count: count() })
    .from(flags)
    .where(whereClause);

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
