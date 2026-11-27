'use server';

import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { z } from 'zod';
import { db } from '@/db';
import { flagRequests, flags, savedFlags } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { extractPalette } from '@/lib/flag-palette';
import { CUSTOM_TAG, MAKER_TAGS, REMIX_TAG, type StoredStudioDesign } from '@/lib/studio-design';
import { studioDesignSchema } from '@/lib/studio-design-schema';
import { createFlagRequest } from './requests';
import { base64ImageToS3URI, UnsafeImageError, uploadFile } from '@/lib/storage/s3';
import { deleteImageIfUnused } from '@/lib/storage/unused-image';
import { loadSavedFlagForPost } from '@/lib/saved-flags';

const postSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  image: z.string().startsWith('data:image/png;base64,').max(12_000_000),
  design: studioDesignSchema,
  remixOf: z.string().uuid().nullable(),
  savedId: z.string().uuid().nullable(),
});

/**
 * Posts a flag made in the flag maker, keeping it in the poster's My Flags (`savedId`, or a new
 * one). It goes through the normal review queue, always tagged `remix` (or `custom` when it isn't
 * based on another flag) so it never passes as official. A flag that's waiting for review is
 * updated in place; one that's already posted gets an edit request with the new design.
 */
export async function postFlagDesign(input: {
  name: string;
  description: string;
  tags: string[];
  image: string;
  design: StoredStudioDesign;
  remixOf: string | null;
  savedId: string | null;
}) {
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: 'Something about this flag is invalid. Try again.' };
  const session = await getServerAuthSession();
  if (!session?.user) return { success: false as const, message: 'You must be logged in to post a flag.' };
  const userId = session.user.id;
  const { name, description, design, savedId } = parsed.data;

  const target = savedId ? await loadSavedFlagForPost(userId, savedId) : null;
  if (savedId && !target) return { success: false as const, message: 'That flag isn’t in your flags any more.' };

  let image: string;
  try {
    image = await base64ImageToS3URI(parsed.data.image);
  } catch (error) {
    return { success: false as const, message: error instanceof UnsafeImageError ? error.message : 'Couldn’t upload your flag. Try again.' };
  }

  // Posting saves it too, so the post's picture is the saved flag's.
  const now = new Date();
  let savedFlagId: string;
  if (target) {
    savedFlagId = target.saved.id;
    await db.update(savedFlags).set({ name, design, image, updatedAt: now }).where(eq(savedFlags.id, savedFlagId));
    await deleteImageIfUnused(target.saved.image, { prefix: 'saved/' }).catch(() => {});
  } else {
    const remix = parsed.data.remixOf
      ? (await db.select({ id: flags.id }).from(flags).where(eq(flags.id, parsed.data.remixOf)).limit(1))[0]
      : undefined;
    const [row] = await db
      .insert(savedFlags)
      .values({ userId, name, design, image, remixOf: remix?.id ?? null, createdAt: now, updatedAt: now })
      .returning({ id: savedFlags.id });
    savedFlagId = row.id;
  }
  const userTags = parsed.data.tags.filter((tag) => !MAKER_TAGS.includes(tag.toLowerCase()));

  // Still waiting for a moderator: change what's waiting rather than queueing another.
  const pending = target?.pendingRequest;
  if (pending) {
    const makerTag = pending.flag.tags.find((tag) => MAKER_TAGS.includes(tag)) ?? (pending.flag.remixOf ? REMIX_TAG : CUSTOM_TAG);
    await db
      .update(flagRequests)
      .set({
        flag: {
          ...pending.flag,
          flagName: name,
          flagImage: image,
          description: description || pending.flag.description,
          tags: [...new Set([makerTag, ...userTags])],
          design,
        },
        updatedAt: now,
      })
      .where(eq(flagRequests.id, pending.id));
    await deleteImageIfUnused(pending.flag.flagImage, { prefix: 'images/' }).catch(() => {});
    return { success: true as const, savedId: savedFlagId, published: false, update: Boolean(target?.flag), flagName: target?.flag?.name ?? null };
  }

  // Already on Browse: the new design goes through an edit, like any change to a flag.
  const live = target?.flag;
  if (live) {
    const makerTag = live.tags.find((tag) => MAKER_TAGS.includes(tag)) ?? (live.remixOf ? REMIX_TAG : CUSTOM_TAG);
    const result = await createFlagRequest(
      {
        flagName: name,
        flagImage: image,
        link: live.link,
        sources: live.sources,
        tags: [...new Set([makerTag, ...userTags])],
        description: description || live.description,
        relatedFlags: live.relatedFlagRows,
        remixOf: live.remixOf,
        design,
      },
      live.id,
      'Updated design from My Flags',
      { savedFlagId },
    );
    if (!result.success) return { success: false as const, message: result.message };
    const published = Boolean(result.autoApproved);
    return { success: true as const, savedId: savedFlagId, published, update: true, flagName: published ? name : live.name };
  }

  const remixOf = parsed.data.remixOf ?? null;
  const original = remixOf
    ? (await db.select({ id: flags.id, name: flags.name, image: flags.image }).from(flags).where(eq(flags.id, remixOf)).limit(1))[0]
    : undefined;
  const makerTag = original ? REMIX_TAG : CUSTOM_TAG;

  const result = await createFlagRequest(
    {
      flagName: name,
      flagImage: image,
      link: '',
      sources: [],
      tags: [...new Set([makerTag, ...userTags])],
      description: description || (original ? `A remix of ${original.name}, made with the Vexilo flag maker.` : 'Made with the Vexilo flag maker.'),
      relatedFlags: original ? [original] : [],
      remixOf: original?.id ?? null,
      design,
    },
    undefined,
    undefined,
    { savedFlagId },
  );
  if (!result.success) return { success: false as const, message: result.message };
  const published = Boolean(result.autoApproved);
  return { success: true as const, savedId: savedFlagId, published, update: false, flagName: published ? name : null };
}

const MAX_UPLOAD_BYTES = 2_000_000;
const MAX_UPLOAD_SIZE = 1024;

/**
 * Stores an image someone brought into the flag maker (already cut out in the browser) and
 * reads its colours with the same palette engine as every flag, so it recolours like an emblem.
 */
export async function uploadStudioImage(dataUrl: string) {
  const session = await getServerAuthSession();
  if (!session?.user) return { success: false as const, message: 'Sign in to use your own images.' };
  const match = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return { success: false as const, message: 'That file isn’t an image the flag maker can use.' };
  const input = Buffer.from(match[2], 'base64');
  if (input.byteLength > MAX_UPLOAD_BYTES) return { success: false as const, message: 'That image is too large.' };

  try {
    // Re-encoding through sharp also strips anything that isn't plain pixels.
    const png = await sharp(input)
      .resize({ width: MAX_UPLOAD_SIZE, height: MAX_UPLOAD_SIZE, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const { width = 1, height = 1 } = await sharp(png).metadata();
    const palette = await extractPalette(png);
    const key = `studio/${session.user.id}/${Date.now()}.png`;
    await uploadFile(png, process.env.S3_BUCKET_NAME!, key, 'image/png');
    return {
      success: true as const,
      url: `${CLOUD_FRONT_URL}/${key}`,
      aspect: width / height,
      colors: palette.map((color) => color.hex.toUpperCase()),
    };
  } catch {
    return { success: false as const, message: 'Couldn’t read that image.' };
  }
}
