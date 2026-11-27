"use server";

import { db } from "@/db";
import { cacheDel } from "@/db/redis";
import { flags, users } from "@/db/schema";
import { deleteFileFromUrl, uploadFile } from "@/lib/storage/s3";
import { getServerAuthSession } from "@/lib/auth";
import { CLOUD_FRONT_URL } from "@/lib/constant";
import { and, eq } from "drizzle-orm";
import { inEncyclopedia } from "@/lib/encyclopedia";
import { getProfileFlag } from "@/lib/profile-flag";
import { LEADERBOARD_CACHE_KEY } from "@/lib/cache-keys";
import { usernameSchema } from "@/lib/username";
import { isUsernameConflict, isUsernameTaken } from "@/lib/username-db";
import sharp from "sharp";

// Matches Next's default server action body limit; the client shrinks images first.
const PROFILE_PICTURE_MAX_BYTES = 1024 * 1024;
const PROFILE_PICTURE_SIZE = 256;
const PROFILE_PICTURE_PREFIX = "avatars/";

export async function changeUsername(username: string) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return {
      success: false,
      message: "You must be logged in to change your username.",
    };
  }

  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  if (await isUsernameTaken(parsed.data, session.user.id)) {
    return { success: false, message: "That username is taken. Try another." };
  }

  try {
    await db.update(users).set({ name: parsed.data }).where(eq(users.id, session.user.id));
  } catch (error) {
    if (isUsernameConflict(error)) {
      return { success: false, message: "That username is taken. Try another." };
    }
    throw error;
  }

  return {
    success: true,
    message: "Username changed.",
    username: parsed.data,
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
      .where(and(eq(flags.id, flagId), inEncyclopedia))
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
    .set({ favoriteFlagId: flagId, profilePostId: null })
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
  await cacheDel(LEADERBOARD_CACHE_KEY);

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
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      isAdmin: users.isAdmin,
      isAnonymous: users.isAnonymous,
      userNumber: users.userNumber,
      favoriteFlagId: users.favoriteFlagId,
      profilePostId: users.profilePostId,
      bio: users.bio,
      link: users.link,
      location: users.location,
      pinnedPostIds: users.pinnedPostIds,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((res) => res[0]);

  const favoriteFlag = user ? await getProfileFlag(user) : null;

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
      profilePostId: users.profilePostId,
    })
    .from(users)
    .where(eq(users.userNumber, userNumber))
    .limit(1)
    .then((res) => res[0]);

  if (user.isAnonymous) {
    user.name = "Anonymous User";
    user.image = "/logo.svg";
  }

  const favoriteFlag = user ? await getProfileFlag(user) : null;

  return {
    success: true,
    user: {
      ...user,
      favoriteFlag,
    },
  };
}
