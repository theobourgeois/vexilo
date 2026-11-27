import sharp from 'sharp';
import { storedFileUrl } from '@/lib/storage/local-storage';
import { uploadFile } from '@/lib/storage/s3';

/** Saved flags' (and so posts') pictures. Big enough for a post page, small enough for a grid. */
export const SAVED_IMAGE_WIDTH = 1200;
export const SAVED_PREFIX = 'saved/';

/**
 * Stores a picture of one of someone's flags, drawn by the flag maker. Re-encoding through sharp
 * strips anything that isn't pixels. Not a server action: it trusts `userId`.
 */
export async function uploadSavedFlagImage(userId: string, dataUrl: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('Not a PNG');
  const png = await sharp(Buffer.from(match[1], 'base64'))
    .resize({ width: SAVED_IMAGE_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer();
  const key = `${SAVED_PREFIX}${userId}/${crypto.randomUUID()}.png`;
  await uploadFile(png, process.env.S3_BUCKET_NAME!, key, 'image/png');
  return storedFileUrl(key);
}
