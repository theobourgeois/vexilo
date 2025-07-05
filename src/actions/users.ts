"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
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
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((res) => res[0])

  return {
    success: true,
    user,
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
    })
    .from(users)
    .where(eq(users.userNumber, userNumber))
    .limit(1)
    .then((res) => res[0])

  if (user.isAnonymous) {
    user.name = "Anonymous User";
    user.image = "/logo.svg";
  }

  return {
    success: true,
    user,
  };
}
