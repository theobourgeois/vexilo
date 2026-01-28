"use server";

import { db } from "@/db";
import { flags, users } from "@/db/schema";
import { getServerAuthSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function changeName(name: string) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return {
      success: false,
      message: "You must be logged in to change your name.",
    };
  }

  await db.update(users).set({ name }).where(eq(users.id, session.user.id));

  return {
    success: true,
    message: "Name changed successfully.",
  };
}

export async function changeIsAnonymous(isAnonymous: boolean) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return {
      success: false,
      message: "You must be logged in to change your is anonymous.",
    };
  }

  await db.update(users).set({ isAnonymous }).where(eq(users.id, session.user.id));

  return {
    success: true,
    message: "Is anonymous changed successfully.",
  };
}

export async function changeFavoriteFlag(flagId: string | null) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return {
      success: false,
      message: "You must be logged in to change your favorite flag.",
    };
  }

  // If flagId is provided, verify the flag exists
  if (flagId) {
    const flag = await db
      .select({ id: flags.id })
      .from(flags)
      .where(eq(flags.id, flagId))
      .limit(1)
      .then((res) => res[0]);

    if (!flag) {
      return {
        success: false,
        message: "Flag not found.",
      };
    }
  }

  await db
    .update(users)
    .set({ favoriteFlagId: flagId })
    .where(eq(users.id, session.user.id));

  return {
    success: true,
    message: flagId ? "Favorite flag updated successfully." : "Favorite flag removed.",
  };
}

export async function getUserData() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return {
      success: false,
      message: "You must be logged in to get user data.",
    };
  }

  const user = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
      isAdmin: users.isAdmin,
      isAnonymous: users.isAnonymous,
      userNumber: users.userNumber,
      favoriteFlagId: users.favoriteFlagId,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((res) => res[0]);

  // If user has a favorite flag, fetch its details
  let favoriteFlag = null;
  if (user?.favoriteFlagId) {
    const flag = await db
      .select({
        id: flags.id,
        name: flags.name,
        image: flags.image,
      })
      .from(flags)
      .where(eq(flags.id, user.favoriteFlagId))
      .limit(1)
      .then((res) => res[0]);
    
    favoriteFlag = flag || null;
  }

  return {
    success: true,
    user: {
      ...user,
      favoriteFlag,
    },
  };
}

export async function getUserByUserNumber(userNumber: string) {
  const user = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      isAnonymous: users.isAnonymous,
      createdAt: users.createdAt,
      favoriteFlagId: users.favoriteFlagId,
    })
    .from(users)
    .where(eq(users.userNumber, userNumber))
    .limit(1)
    .then((res) => res[0]);

  if (user.isAnonymous) {
    user.name = "Anonymous User";
    user.image = "/logo.svg";
  }

  // If user has a favorite flag, fetch its details
  let favoriteFlag = null;
  if (user?.favoriteFlagId) {
    const flag = await db
      .select({
        id: flags.id,
        name: flags.name,
        image: flags.image,
      })
      .from(flags)
      .where(eq(flags.id, user.favoriteFlagId))
      .limit(1)
      .then((res) => res[0]);
    
    favoriteFlag = flag || null;
  }

  return {
    success: true,
    user: {
      ...user,
      favoriteFlag,
    },
  };
}
