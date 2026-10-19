'use server';

import { asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { flags } from '@/db/schema';
import { getFlagColors } from '@/lib/flag-palette';

export async function searchPaletteFlags(input: string) {
  const query = input.trim().slice(0, 100);
  if (query.length < 2) return [];
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  return db
    .select({ id: flags.id, name: flags.name, image: flags.image })
    .from(flags)
    .where(ilike(flags.name, pattern))
    .orderBy(
      sql`case when lower(${flags.name}) in (${query.toLowerCase()}, ${`the ${query.toLowerCase()}`}) then 0 else 1 end`,
      desc(flags.favorites),
      asc(flags.name),
    )
    .limit(6);
}

export async function getReferenceFlagPalette(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [flag] = await db
    .select({ id: flags.id, name: flags.name, image: flags.image })
    .from(flags)
    .where(eq(flags.id, id))
    .limit(1);
  if (!flag) return null;
  return { ...flag, colors: await getFlagColors(flag) };
}
