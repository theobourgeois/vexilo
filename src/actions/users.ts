"use server";

import { db } from "@/db";
import { redis } from "@/db/redis";
import { flags, users } from "@/db/schema";
import { deleteFileFromUrl, uploadFile } from "@/actions/s3";
import { getServerAuthSession } from "@/lib/auth";
import { CLOUD_FRONT_URL } from "@/lib/constant";
import { eq } from "drizzle-orm";
import sharp from "sharp";

// Matches Next's default server action body limit; the client shrinks images first.
const PROFILE_PICTURE_MAX_BYTES = 1024 * 1024;
const PROFILE_PICTURE_SIZE = 256;
const PROFILE_PICTURE_PREFIX = "avatars/";

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

export async function changeProfilePicture(formData: FormData) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return {
      success: false,
      message: "You must be logged in to change your profile picture.",
    };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return { success: false, message: "Please choose an image file." };
  }
  if (file.size > PROFILE_PICTURE_MAX_BYTES) {
    return { success: false, message: "That image is too large." };
  }

  // Re-encode every upload: a square, EXIF-stripped WebP no matter what was sent.
  let image: Buffer;
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(PROFILE_PICTURE_SIZE, PROFILE_PICTURE_SIZE, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return { success: false, message: "That image couldn't be read." };
  }

  const key = `${PROFILE_PICTURE_PREFIX}${session.user.id}-${Date.now()}.webp`;
  await uploadFile(image, process.env.S3_BUCKET_NAME!, key, "image/webp");
  const url = `${CLOUD_FRONT_URL}/${key}`;

  await replaceProfilePicture(session.user.id, url);

  return {
    success: true,
    message: "Profile picture updated.",
    image: url,
  };
}

export async function removeProfilePicture() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return {
      success: false,
      message: "You must be logged in to remove your profile picture.",
    };
  }

  await replaceProfilePicture(session.user.id, null);

  return {
    success: true,
    message: "Profile picture removed.",
  };
}

/** Points the user at a new picture and deletes the old one if we uploaded it. */
async function replaceProfilePicture(userId: string, image: string | null) {
  const previous = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((res) => res[0]?.image);

  await db.update(users).set({ image }).where(eq(users.id, userId));
  await redis.del("leaderboard");

  if (previous?.startsWith(`${CLOUD_FRONT_URL}/${PROFILE_PICTURE_PREFIX}`)) {
    await deleteFileFromUrl(previous).catch((error) => {
      console.error("Failed to delete old profile picture", error);
    });
  }
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
