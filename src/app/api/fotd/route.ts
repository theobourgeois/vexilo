import { db } from "@/db";
import { flagOfTheDay, flags } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  if (body.key !== process.env.FOTD_KEY) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const flagCount = (await db.select({ count: count() }).from(flags))?.[0]
      .count;
    const randomIndex = Math.floor(Math.random() * flagCount);
    const fotd = await db
      .select()
      .from(flags)
      .where(eq(flags.index, randomIndex))
      .limit(1);

    await db.insert(flagOfTheDay).values({
      flagId: fotd[0].id,
    });

    return NextResponse.json(
      { message: "Flag of the day generated" },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Error generating flag of the day" },
      { status: 500 }
    );
  }
}
