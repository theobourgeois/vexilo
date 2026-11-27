'use server';

import sharp from 'sharp';
import { getServerAuthSession } from '@/lib/auth';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { extractPalette } from '@/lib/flag-palette';
import { uploadFile } from '@/lib/storage/s3';

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
