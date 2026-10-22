'use server';

import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { z } from 'zod';
import { db } from '@/db';
import { flags } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { extractPalette } from '@/lib/flag-palette';
import { CUSTOM_TAG, MAKER_TAGS, REMIX_TAG, type StoredStudioDesign } from '@/lib/studio-design';
import { studioDesignSchema } from '@/lib/studio-design-schema';
import { createFlagRequest } from './requests';
import { uploadFile } from './s3';

const postSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  image: z.string().startsWith('data:image/png;base64,').max(12_000_000),
  design: studioDesignSchema,
  remixOf: z.string().uuid().nullable(),
});

/**
 * Posts a flag made in the flag maker. It goes through the normal review queue, always tagged
 * `remix` (or `custom` when it isn't based on another flag) so it never passes as official.
 */
export async function postFlagDesign(input: {
  name: string;
  description: string;
  tags: string[];
  image: string;
  design: StoredStudioDesign;
  remixOf: string | null;
}) {
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: 'Something about this flag is invalid. Try again.' };
  const { name, description, image, design, remixOf } = parsed.data;

  const original = remixOf
    ? (await db.select({ id: flags.id, name: flags.name, image: flags.image }).from(flags).where(eq(flags.id, remixOf)).limit(1))[0]
    : undefined;
  const makerTag = original ? REMIX_TAG : CUSTOM_TAG;
  const tags = [...new Set([makerTag, ...parsed.data.tags.filter((tag) => !MAKER_TAGS.includes(tag.toLowerCase()))])];

  const result = await createFlagRequest({
    flagName: name,
    flagImage: image,
    link: '',
    sources: [],
    tags,
    description: description || (original ? `A remix of ${original.name}, made with the Vexilo flag maker.` : 'Made with the Vexilo flag maker.'),
    relatedFlags: original ? [original] : [],
    remixOf: original?.id ?? null,
    design,
  });
  return result.success
    ? { success: true as const, published: Boolean(result.autoApproved) }
    : { success: false as const, message: result.message };
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
