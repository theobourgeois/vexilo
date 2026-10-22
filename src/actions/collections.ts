'use server';

import { unstable_cache } from 'next/cache';
import { and, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';
import { db } from '@/db';
import { favorites, flagAiMetadata, flagColors, flagEmblems, flags } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { getCollection, type CollectionCriteria } from '@/lib/collections';
import { getTrait } from '@/lib/flag-search-terms';
import { MAKER_TAGS } from '@/lib/studio-design';

const COLLECTION_LIMIT = 120;
const CACHE_SECONDS = 60 * 60 * 24;

// Proposals, game and mod flags, and flag-maker designs sort after real flags.
const FICTION_TAGS = ['fictional', 'hoi4', 'tno', 'tfr', 'saa', 'joke', 'proposal', 'redesign', 'mashup', 'dystopian', 'game', 'touhou', 'micronation', ...MAKER_TAGS];
const FICTION_NAME = '\\m(tfr|tno|saa|hoi4|fictional|fanon|proposal|proposed|redesign)\\M';

const textArray = (values: string[]) => sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;

const hasAnyTag = (tags: string[]) =>
  sql`EXISTS (SELECT 1 FROM unnest(${flags.tags}) AS tag WHERE lower(tag) = ANY(${textArray(tags.map((tag) => tag.toLowerCase()))}))`;

const isFiction = sql`(${hasAnyTag(FICTION_TAGS)} OR ${flags.name} ~* ${FICTION_NAME})`;

function collectionWhere({ colors, onlyColors, symbols }: CollectionCriteria) {
  const conditions: SQL[] = [];
  if (colors?.length) {
    const families = textArray(colors);
    conditions.push(sql`EXISTS (SELECT 1 FROM ${flagColors} WHERE ${flagColors.flagId} = ${flags.id}
      AND ${flagColors.families} @> ${families}${onlyColors ? sql` AND ${flagColors.families} <@ ${families}` : sql``})`);
  }
  if (symbols) {
    const shows: SQL[] = [];
    if (symbols.emblemTags?.length) {
      shows.push(sql`${flags.id} IN (SELECT unnest(${flagEmblems.appearsOn}) FROM ${flagEmblems}
        WHERE ${flagEmblems.isActive} AND ${flagEmblems.tags} && ${textArray(symbols.emblemTags)})`);
    }
    const tokens = (symbols.traits ?? []).flatMap((key) => getTrait(key)?.tokens ?? []);
    if (tokens.length) {
      shows.push(sql`${flags.id} IN (SELECT ${flagAiMetadata.flagId} FROM ${flagAiMetadata}
        WHERE ${flagAiMetadata.searchTokens} && ${textArray(tokens)})`);
    }
    if (symbols.tags?.length) shows.push(hasAnyTag(symbols.tags));
    conditions.push(shows.length ? sql`(${sql.join(shows, sql` OR `)})` : sql`false`);
  }
  return conditions.length ? and(...conditions)! : sql`true`;
}

/** The most popular flags in a collection and how many there are, cached for a day. */
const getCachedCollectionFlags = unstable_cache(
  async (slug: string) => {
    const collection = getCollection(slug);
    if (!collection) return null;
    const where = collectionWhere(collection.criteria);
    const order = [desc(flags.favorites), desc(flags.views), flags.index];
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: flags.id,
          name: flags.name,
          image: flags.image,
          link: flags.link,
          index: flags.index,
          tags: flags.tags,
          description: flags.description,
          sources: flags.sources,
          favorites: flags.favorites,
        })
        .from(flags)
        .where(where)
        .orderBy(...(collection.criteria.mixFiction ? order : [isFiction, ...order]))
        .limit(COLLECTION_LIMIT),
      db.select({ total: sql<number>`count(*)::int` }).from(flags).where(where),
    ]);
    return { flags: rows, total };
  },
  ['flag-collection-v1'],
  { revalidate: CACHE_SECONDS },
);

export async function getCollectionFlags(slug: string) {
  return getCachedCollectionFlags(slug);
}

/** Which of these flags the signed-in user has favorited; the flag lists themselves are shared. */
export async function getFavoritedFlagIds(flagIds: string[]) {
  const session = await getServerAuthSession();
  if (!session?.user || flagIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ flagId: favorites.flagId })
    .from(favorites)
    .where(and(eq(favorites.userId, session.user.id), inArray(favorites.flagId, flagIds)));
  return new Set(rows.map((row) => row.flagId));
}
