'use server';

import { db } from '@/db';
import { flagColors, flags } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { findImageReplacements, isImageGone, replaceFlagImage } from '@/lib/storage/flag-image-repair';
import { asc, eq, sql } from 'drizzle-orm';

async function isAdmin() {
  const session = await getServerAuthSession();
  return Boolean(session?.user?.isAdmin);
}

export type BrokenImageFlag = {
  id: string;
  name: string;
  index: number;
  image: string;
  /** `dead`: the link is gone. `unreadable`: it loads, but the image couldn't be decoded. */
  state: 'dead' | 'unreadable';
};

/** Flags whose image couldn't be read, split into dead links and images that load but won't decode. */
export async function getBrokenImageFlags(): Promise<BrokenImageFlag[] | null> {
  if (!(await isAdmin())) return null;

  const rows = await db
    .select({ id: flags.id, name: flags.name, index: flags.index, image: flags.image })
    .from(flags)
    .innerJoin(flagColors, eq(flagColors.flagId, flags.id))
    .where(sql`jsonb_array_length(${flagColors.colors}) = 0`)
    .orderBy(asc(flags.name));

  const result: BrokenImageFlag[] = [];
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        result.push({ ...row, state: (await isImageGone(row.image)) ? 'dead' : 'unreadable' });
      }
    }),
  );
  return result.sort((a, b) => (a.state === b.state ? a.name.localeCompare(b.name) : a.state === 'dead' ? -1 : 1));
}

/** Replacement suggestions for one flag, looked up live on Wikimedia Commons and Wikipedia. */
export async function getImageReplacements(flagId: string) {
  if (!(await isAdmin())) return null;
  const [flag] = await db.select({ name: flags.name, image: flags.image }).from(flags).where(eq(flags.id, flagId)).limit(1);
  if (!flag) return null;
  return findImageReplacements(flag);
}

/** Swaps in a new image (copied to CloudFront) and re-reads the flag's colours. */
export async function applyImageReplacement(flagId: string, imageUrl: string) {
  if (!(await isAdmin())) return { error: 'Unauthorized' };
  if (!/^https?:\/\//i.test(imageUrl.trim())) return { error: 'Use a full image URL starting with https://' };
  try {
    const result = await replaceFlagImage(flagId, imageUrl.trim());
    if (!result) return { error: 'Flag not found.' };
    if (result.colors.length === 0) return { image: result.image, warning: 'Saved, but this image still could not be read.' };
    return { image: result.image };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not use that image.' };
  }
}
