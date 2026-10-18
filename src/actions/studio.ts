'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { flags } from '@/db/schema';
import { CUSTOM_TAG, MAKER_TAGS, REMIX_TAG, type StudioDesign } from '@/lib/studio-design';
import { studioDesignSchema } from '@/lib/studio-design-schema';
import { createFlagRequest } from './requests';

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
  design: StudioDesign;
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
