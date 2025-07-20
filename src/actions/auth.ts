"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getServerAuthSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function getUser() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  const user = await db.select().from(users).where(eq(users.id, session.user.id));
  return user[0];
}