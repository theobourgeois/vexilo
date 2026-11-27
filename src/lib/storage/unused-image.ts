import { and, ne, eq } from 'drizzle-orm';
import { db } from '@/db';
import { flags, savedFlags } from '@/db/schema';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { deleteFileFromUrl } from './s3';

/**
 * Deletes a stored image unless a flag or a saved flag still uses it. Requests can point at any
 * CloudFront URL (including another flag's image), so never delete blindly. `prefix` limits it to
 * images under that folder, like `images/` for uploads.
 */
export async function deleteImageIfUnused(
  imageUrl: string,
  options: { prefix?: string; ignoreFlagId?: string; ignoreSavedId?: string } = {},
) {
  if (!imageUrl.startsWith(`${CLOUD_FRONT_URL}/`)) return;
  if (options.prefix && !imageUrl.startsWith(`${CLOUD_FRONT_URL}/${options.prefix}`)) return;

  const [[flag], [saved]] = await Promise.all([
    db
      .select({ id: flags.id })
      .from(flags)
      .where(and(eq(flags.image, imageUrl), options.ignoreFlagId ? ne(flags.id, options.ignoreFlagId) : undefined))
      .limit(1),
    db
      .select({ id: savedFlags.id })
      .from(savedFlags)
      .where(and(eq(savedFlags.image, imageUrl), options.ignoreSavedId ? ne(savedFlags.id, options.ignoreSavedId) : undefined))
      .limit(1),
  ]);
  if (flag || saved) return;

  await deleteFileFromUrl(imageUrl);
}
