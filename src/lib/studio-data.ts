import { and, eq, inArray, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { flagEmblems, flagParts, flags } from '@/db/schema';
import { getFlagColors } from '@/lib/flag-palette';
import type { RemixSource, StudioEmblem } from '@/components/studio/model';

/** The flag maker's emblem library. Changes only when the library is re-imported. */
export const getStudioEmblems = unstable_cache(
  async (): Promise<StudioEmblem[]> => {
    const rows = await db
      .select({
        id: flagEmblems.id,
        image: flagEmblems.image,
        width: flagEmblems.width,
        height: flagEmblems.height,
        colors: flagEmblems.colors,
        copies: flagEmblems.copies,
        collection: flagEmblems.collection,
        appearsOn: flagEmblems.appearsOn,
        name: flags.name,
      })
      .from(flagEmblems)
      .innerJoin(flags, eq(flags.id, flagEmblems.flagId));
    const ids = [...new Set(rows.flatMap((row) => row.appearsOn))];
    const names = new Map(
      ids.length
        ? (await db.select({ id: flags.id, name: flags.name }).from(flags).where(inArray(flags.id, ids))).map((f) => [f.id, f.name])
        : [],
    );
    return rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        names: [...new Set([row.name, ...row.appearsOn.map((id) => names.get(id) ?? '').filter(Boolean)])],
        collection: row.collection === 'country-extra' ? 'country' : row.collection,
        src: row.image,
        aspect: row.width / row.height,
        colors: row.colors,
        copies: row.copies,
      }))
      .sort((a, b) => b.copies - a.copies || a.name.localeCompare(b.name));
  },
  ['studio-emblems-v1'],
  { revalidate: 60 * 60 },
);

/**
 * What the flag maker needs to remix a flag: its image and colours, and a design to start from —
 * its own if it was made here, else its parts cut from its SVG (scripts/parts) if they're current.
 */
export async function getRemixSource(flagId: string): Promise<RemixSource | null> {
  if (!z.string().uuid().safeParse(flagId).success) return null;
  const [flag] = await db
    .select({ id: flags.id, name: flags.name, image: flags.image, design: flags.design })
    .from(flags)
    .where(eq(flags.id, flagId))
    .limit(1);
  if (!flag) return null;

  const [palette, placed, [parts]] = await Promise.all([
    getFlagColors(flag),
    db
      .select({
        id: flagEmblems.id,
        image: flagEmblems.image,
        width: flagEmblems.width,
        height: flagEmblems.height,
        colors: flagEmblems.colors,
        copies: flagEmblems.copies,
        collection: flagEmblems.collection,
        placements: flagEmblems.placements,
      })
      .from(flagEmblems)
      .where(sql`${flagEmblems.placements} @> ${JSON.stringify([{ flagId }])}::jsonb`),
    db
      .select({ design: flagParts.design })
      .from(flagParts)
      .where(and(eq(flagParts.flagId, flagId), eq(flagParts.image, flag.image), eq(flagParts.status, 'ok')))
      .limit(1),
  ]);

  return {
    id: flag.id,
    name: flag.name,
    image: flag.image,
    palette: palette.map((color) => color.hex),
    design: flag.design ?? parts?.design ?? null,
    placements: placed.flatMap((emblem) => {
      const placement = emblem.placements.find((p) => p.flagId === flagId);
      if (!placement) return [];
      return [
        {
          emblem: {
            id: emblem.id,
            name: flag.name,
            names: [flag.name],
            collection: emblem.collection,
            src: emblem.image,
            aspect: emblem.width / emblem.height,
            colors: emblem.colors,
            copies: emblem.copies,
          },
          box: placement.box,
          copies: placement.copies,
        },
      ];
    }),
  };
}

/** The flag a remix was made from, for the note on its page. */
export async function getFlagNameById(flagId: string) {
  const [flag] = await db.select({ id: flags.id, name: flags.name }).from(flags).where(eq(flags.id, flagId)).limit(1);
  return flag ?? null;
}
