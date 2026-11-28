import { generateFlagOfTheDay } from "@/actions/flags";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  if (body.key !== process.env.FOTD_KEY) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Picks a real flag: never one that moved to the community, never a design.
    await generateFlagOfTheDay();

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
