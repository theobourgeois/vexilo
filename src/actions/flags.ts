'use server';

import { db } from '@/db';
import { redis } from '@/db/redis';
import {
  favorites,
  flagAiMetadata,
  flagOfTheDay,
  flagRequests,
  flags,
  flagTags,
  reports,
  type FlagAiStructuredData,
  users,
} from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { Flag } from '@/lib/types';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  sql,
} from 'drizzle-orm';

const EXPERIMENTAL_RECOMMENDATION_LIMIT = 8;
const EXPERIMENTAL_RECOMMENDATION_CACHE_TTL_SECONDS = 60 * 60 * 24;
const EXPERIMENTAL_RECOMMENDATION_CACHE_VERSION = 'v1';
const RECOMMENDATION_STOP_WORDS = new Set([
  'and',
  'are',
  'flag',
  'flags',
  'for',
  'from',
  'has',
  'have',
  'into',
  'its',
  'often',
  'that',
  'the',
  'their',
  'this',
  'was',
  'were',
  'with',
]);

type RecommendationMetadataRow = {
  flagId: string;
  descriptionDraft: string;
  tagsDraft: string[];
  metaTags: string[];
  detailedDescription: string;
  visualDescription: string;
  historicalContext: string;
  searchTokens: string[];
  structuredData: FlagAiStructuredData | null;
};

type RecommendationCandidateRow = RecommendationMetadataRow & {
  id: string;
  name: string;
  image: string;
  link: string;
  sources: string[];
  index: number;
  tags: string[];
  description: string;
  favorites: number;
};

function normalizeRecommendationToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTokenSet(values: Array<string | null | undefined>): Set<string> {
  const tokens = new Set<string>();

  for (const value of values) {
    const normalized = normalizeRecommendationToken(value || '');
    if (!normalized) {
      continue;
    }

    for (const token of normalized.split(' ')) {
      if (token.length < 3 || RECOMMENDATION_STOP_WORDS.has(token)) {
        continue;
      }

      tokens.add(token);
    }
  }

  return tokens;
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeRecommendationToken(value || ''))
        .filter(Boolean),
    ),
  );
}

function getOverlapCount(left: string[] | undefined, right: string[] | undefined) {
  if (!left?.length || !right?.length) {
    return 0;
  }

  const rightSet = new Set(right);
  let matches = 0;

  for (const value of new Set(left)) {
    if (rightSet.has(value)) {
      matches += 1;
    }
  }

  return matches;
}

function getMetadataKeywordTokens(metadata: RecommendationMetadataRow): string[] {
  return Array.from(
    buildTokenSet([
      metadata.descriptionDraft,
      metadata.detailedDescription,
      metadata.visualDescription,
      metadata.historicalContext,
      ...metadata.tagsDraft,
      ...metadata.metaTags,
    ]),
  );
}

function hasRecommendationMetadata(metadata: RecommendationMetadataRow | null) {
  if (!metadata) {
    return false;
  }

  return !!(
    metadata.structuredData ||
    metadata.searchTokens.length > 0 ||
    metadata.tagsDraft.length > 0 ||
    metadata.metaTags.length > 0 ||
    metadata.descriptionDraft ||
    metadata.detailedDescription ||
    metadata.visualDescription ||
    metadata.historicalContext
  );
}

function scoreMetadataRecommendation(
  source: RecommendationMetadataRow,
  candidate: RecommendationCandidateRow,
) {
  let score = 0;
  let matchedSignals = 0;
  const sourceStructured = source.structuredData;
  const candidateStructured = candidate.structuredData;

  const sourceDominantColors = uniqueValues(sourceStructured?.dominantColors || []);
  const candidateDominantColors = uniqueValues(
    candidateStructured?.dominantColors || [],
  );
  const dominantColorMatches = getOverlapCount(
    sourceDominantColors,
    candidateDominantColors,
  );
  if (dominantColorMatches > 0) {
    score += dominantColorMatches * 22;
    matchedSignals += 1;
  }

  const sourceSecondaryColors = uniqueValues(
    sourceStructured?.secondaryColors || [],
  );
  const candidateSecondaryColors = uniqueValues(
    candidateStructured?.secondaryColors || [],
  );
  const secondaryColorMatches = getOverlapCount(
    sourceSecondaryColors,
    candidateSecondaryColors,
  );
  if (secondaryColorMatches > 0) {
    score += secondaryColorMatches * 10;
    matchedSignals += 1;
  }

  if (
    sourceStructured?.layoutType &&
    candidateStructured?.layoutType &&
    sourceStructured.layoutType === candidateStructured.layoutType
  ) {
    score += 28;
    matchedSignals += 1;
  }

  if (
    sourceStructured?.patternType &&
    candidateStructured?.patternType &&
    sourceStructured.patternType === candidateStructured.patternType
  ) {
    score += 22;
    matchedSignals += 1;
  }

  const primarySymbolMatches = getOverlapCount(
    uniqueValues(sourceStructured?.primarySymbols || []),
    uniqueValues(candidateStructured?.primarySymbols || []),
  );
  if (primarySymbolMatches > 0) {
    score += primarySymbolMatches * 18;
    matchedSignals += 1;
  }

  const secondarySymbolMatches = getOverlapCount(
    uniqueValues(sourceStructured?.secondarySymbols || []),
    uniqueValues(candidateStructured?.secondarySymbols || []),
  );
  if (secondarySymbolMatches > 0) {
    score += secondarySymbolMatches * 8;
    matchedSignals += 1;
  }

  if (
    sourceStructured?.symbolCount &&
    candidateStructured?.symbolCount &&
    sourceStructured.symbolCount !== 'none' &&
    sourceStructured.symbolCount === candidateStructured.symbolCount
  ) {
    score += 8;
    matchedSignals += 1;
  }

  if (
    typeof sourceStructured?.hasText === 'boolean' &&
    typeof candidateStructured?.hasText === 'boolean' &&
    sourceStructured.hasText === candidateStructured.hasText
  ) {
    score += 6;
    matchedSignals += 1;
  }

  if (
    sourceStructured?.textType &&
    candidateStructured?.textType &&
    sourceStructured.textType !== 'none' &&
    sourceStructured.textType === candidateStructured.textType
  ) {
    score += 10;
    matchedSignals += 1;
  }

  if (
    sourceStructured?.emblemPlacement &&
    candidateStructured?.emblemPlacement &&
    sourceStructured.emblemPlacement !== 'none' &&
    sourceStructured.emblemPlacement === candidateStructured.emblemPlacement
  ) {
    score += 12;
    matchedSignals += 1;
  }

  const regionMatches = getOverlapCount(
    uniqueValues(sourceStructured?.regionTags || []),
    uniqueValues(candidateStructured?.regionTags || []),
  );
  if (regionMatches > 0) {
    score += regionMatches * 14;
    matchedSignals += 1;
  }

  const periodMatches = getOverlapCount(
    uniqueValues(sourceStructured?.periodTags || []),
    uniqueValues(candidateStructured?.periodTags || []),
  );
  if (periodMatches > 0) {
    score += periodMatches * 10;
    matchedSignals += 1;
  }

  const styleMatches = getOverlapCount(
    uniqueValues(sourceStructured?.styleTags || []),
    uniqueValues(candidateStructured?.styleTags || []),
  );
  if (styleMatches > 0) {
    score += styleMatches * 12;
    matchedSignals += 1;
  }

  const searchTokenMatches = getOverlapCount(
    uniqueValues(source.searchTokens),
    uniqueValues(candidate.searchTokens),
  );
  if (searchTokenMatches > 0) {
    score += Math.min(searchTokenMatches * 3, 24);
    matchedSignals += 1;
  }

  const keywordMatches = getOverlapCount(
    getMetadataKeywordTokens(source),
    getMetadataKeywordTokens(candidate),
  );
  if (keywordMatches > 0) {
    score += Math.min(keywordMatches * 2, 18);
    matchedSignals += 1;
  }

  const tagMatches = getOverlapCount(
    uniqueValues([...source.tagsDraft, ...source.metaTags]),
    uniqueValues([...candidate.tagsDraft, ...candidate.metaTags]),
  );
  if (tagMatches > 0) {
    score += Math.min(tagMatches * 4, 20);
    matchedSignals += 1;
  }

  if (matchedSignals >= 5) {
    score += 20;
  } else if (matchedSignals >= 3) {
    score += 10;
  }

  score += Math.min(candidate.favorites / 20, 8);

  return score;
}

async function getFlagsByIds(flagIds: string[], userId?: string) {
  if (flagIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: flags.id,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      sources: flags.sources,
      index: flags.index,
      tags: flags.tags,
      description: flags.description,
      favorites: flags.favorites,
      relatedFlags: flags.relatedFlags,
      isFavorite: userId
        ? sql<boolean>`EXISTS (
				SELECT 1 FROM vexilo_favorite 
				WHERE vexilo_favorite.flag_id = vexilo_flag.id 
				AND vexilo_favorite.user_id = ${userId}
			)`
        : sql<boolean>`false`,
    })
    .from(flags)
    .where(inArray(flags.id, flagIds));

  const order = new Map(flagIds.map((id, index) => [id, index]));

  return rows.sort((left, right) => {
    return (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0);
  });
}

// Helper function to update tag counts when tags are added or removed
async function updateTagCounts(oldTags: string[], newTags: string[]) {
  const oldTagSet = new Set(oldTags);
  const newTagSet = new Set(newTags);

  // Find tags that were added (in newTags but not in oldTags)
  const addedTags = newTags.filter((tag) => !oldTagSet.has(tag));

  // Find tags that were removed (in oldTags but not in newTags)
  const removedTags = oldTags.filter((tag) => !newTagSet.has(tag));

  // Increment count for added tags
  for (const tag of addedTags) {
    if (tag.trim()) {
      const existingTag = await db
        .select()
        .from(flagTags)
        .where(eq(flagTags.tag, tag.trim()))
        .limit(1);

      if (existingTag.length > 0) {
        // Tag exists, increment count
        await db
          .update(flagTags)
          .set({ count: sql`count + 1` })
          .where(eq(flagTags.tag, tag.trim()));
      } else {
        // Tag doesn't exist, create it with count 1
        await db.insert(flagTags).values({
          tag: tag.trim(),
          count: 1,
        });
      }
    }
  }

  // Decrement count for removed tags
  for (const tag of removedTags) {
    if (tag.trim()) {
      const existingTag = await db
        .select()
        .from(flagTags)
        .where(eq(flagTags.tag, tag.trim()))
        .limit(1);

      if (existingTag.length > 0) {
        if (existingTag[0].count > 1) {
          // Decrement count if more than 1
          await db
            .update(flagTags)
            .set({ count: sql`count - 1` })
            .where(eq(flagTags.tag, tag.trim()));
        } else {
          // Remove tag if count would become 0
          await db.delete(flagTags).where(eq(flagTags.tag, tag.trim()));
        }
      }
    }
  }
}

// Helper function to add tags when a new flag is created
async function addTagsToCount(tags: string[]) {
  for (const tag of tags) {
    if (tag.trim()) {
      const existingTag = await db
        .select()
        .from(flagTags)
        .where(eq(flagTags.tag, tag.trim()))
        .limit(1);

      if (existingTag.length > 0) {
        // Tag exists, increment count
        await db
          .update(flagTags)
          .set({ count: sql`count + 1` })
          .where(eq(flagTags.tag, tag.trim()));
      } else {
        // Tag doesn't exist, create it with count 1
        await db.insert(flagTags).values({
          tag: tag.trim(),
          count: 1,
        });
      }
    }
  }
}

// Helper function to remove tags when a flag is deleted
async function removeTagsFromCount(tags: string[]) {
  for (const tag of tags) {
    if (tag.trim()) {
      const existingTag = await db
        .select()
        .from(flagTags)
        .where(eq(flagTags.tag, tag.trim()))
        .limit(1);

      if (existingTag.length > 0) {
        if (existingTag[0].count > 1) {
          // Decrement count if more than 1
          await db
            .update(flagTags)
            .set({ count: sql`count - 1` })
            .where(eq(flagTags.tag, tag.trim()));
        } else {
          // Remove tag if count would become 0
          await db.delete(flagTags).where(eq(flagTags.tag, tag.trim()));
        }
      }
    }
  }
}

export async function getTopFlagTags(limit: number) {
  const cachedTags = await redis.get('tags');
  if (cachedTags) {
    return cachedTags as typeof topTags;
  }

  const clampedLimit = Math.min(limit, 100);
  const topTags = await db
    .select({ tag: flagTags.tag, count: flagTags.count })
    .from(flagTags)
    .orderBy(desc(flagTags.count))
    .limit(clampedLimit);

  await redis.set('tags', topTags);

  return topTags;
}

export async function getAllFlagTags(
  search?: string,
  page: number = 1,
  limit: number = 50,
) {
  const offset = (page - 1) * limit;

  const tags = await db
    .select({ tag: flagTags.tag, count: flagTags.count })
    .from(flagTags)
    .where(search ? ilike(flagTags.tag, `%${search}%`) : sql`1=1`)
    .orderBy(desc(flagTags.count))
    .limit(limit)
    .offset(offset);

  const totalCount = await db
    .select({ count: count() })
    .from(flagTags)
    .where(search ? ilike(flagTags.tag, `%${search}%`) : sql`1=1`);

  return {
    tags,
    totalCount: totalCount[0]?.count || 0,
    totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
    currentPage: page,
  };
}

export async function getFlagFromName(flagName: string) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  const flag = await db
    .select({
      id: flags.id,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      index: flags.index,
      sources: flags.sources,
      tags: flags.tags,
      description: flags.description,
      favorites: flags.favorites,
      relatedFlags: flags.relatedFlags,
      isFavorite: userId
        ? sql<boolean>`EXISTS (
				SELECT 1 FROM vexilo_favorite 
				WHERE vexilo_favorite.flag_id = vexilo_flag.id 
				AND vexilo_favorite.user_id = ${userId}
			)`
        : sql<boolean>`false`,
    })
    .from(flags)
    .where(eq(flags.name, flagName))
    .limit(1);

  if (!flag?.[0]) {
    return null;
  }

  return flag[0];
}

function cleanTextValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function cleanStringArray(values: string[] | null | undefined) {
  return Array.from(
    new Set(values?.map((value) => value.trim()).filter(Boolean) ?? []),
  );
}

function buildResolvedFlagMetadata(
  row: Awaited<ReturnType<typeof getFlagDetailFromNameQuery>>[number],
) {
  if (!row?.metadataId) {
    return null;
  }

  return {
    id: row.metadataId,
    flagId: row.metadataFlagId,
    generationStatus: row.metadataGenerationStatus,
    pipelineVersion: row.metadataPipelineVersion,
    descriptionDraft: row.metadataDescriptionDraft,
    tagsDraft: row.metadataTagsDraft,
    metaTags: row.metadataMetaTags,
    detailedDescription: row.metadataDetailedDescription,
    visualDescription: row.metadataVisualDescription,
    historicalContext: row.metadataHistoricalContext,
    searchTokens: row.metadataSearchTokens,
    embeddingText: row.metadataEmbeddingText,
    researchSources: row.metadataResearchSources,
    structuredData: row.metadataStructuredData,
    generatedAt: row.metadataGeneratedAt,
    updatedAt: row.metadataUpdatedAt,
  };
}

async function getFlagDetailFromNameQuery(flagName: string, userId?: string) {
  return db
    .select({
      id: flags.id,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      index: flags.index,
      sources: flags.sources,
      tags: flags.tags,
      description: flags.description,
      favorites: flags.favorites,
      relatedFlags: flags.relatedFlags,
      isFavorite: userId
        ? sql<boolean>`EXISTS (
				SELECT 1 FROM vexilo_favorite
				WHERE vexilo_favorite.flag_id = vexilo_flag.id
				AND vexilo_favorite.user_id = ${userId}
			)`
        : sql<boolean>`false`,
      metadataId: flagAiMetadata.id,
      metadataFlagId: flagAiMetadata.flagId,
      metadataGenerationStatus: flagAiMetadata.generationStatus,
      metadataPipelineVersion: flagAiMetadata.pipelineVersion,
      metadataDescriptionDraft: flagAiMetadata.descriptionDraft,
      metadataTagsDraft: flagAiMetadata.tagsDraft,
      metadataMetaTags: flagAiMetadata.metaTags,
      metadataDetailedDescription: flagAiMetadata.detailedDescription,
      metadataVisualDescription: flagAiMetadata.visualDescription,
      metadataHistoricalContext: flagAiMetadata.historicalContext,
      metadataSearchTokens: flagAiMetadata.searchTokens,
      metadataEmbeddingText: flagAiMetadata.embeddingText,
      metadataResearchSources: flagAiMetadata.researchSources,
      metadataStructuredData: flagAiMetadata.structuredData,
      metadataGeneratedAt: flagAiMetadata.generatedAt,
      metadataUpdatedAt: flagAiMetadata.updatedAt,
    })
    .from(flags)
    .leftJoin(flagAiMetadata, eq(flagAiMetadata.flagId, flags.id))
    .where(eq(flags.name, flagName))
    .limit(1);
}

export async function getFlagDetailFromName(flagName: string) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  const rows = await getFlagDetailFromNameQuery(flagName, userId);
  const row = rows[0];

  if (!row) {
    return null;
  }

  const metadata = buildResolvedFlagMetadata(row);
  const displayDescription =
    cleanTextValue(metadata?.descriptionDraft) || row.description;
  const displayTags = (() => {
    const metadataTags = cleanStringArray(metadata?.tagsDraft);
    return metadataTags.length > 0 ? metadataTags : row.tags;
  })();

  return {
    id: row.id,
    name: row.name,
    image: row.image,
    link: row.link,
    index: row.index,
    sources: row.sources,
    tags: row.tags,
    description: row.description,
    favorites: row.favorites,
    relatedFlags: row.relatedFlags,
    isFavorite: row.isFavorite,
    metadata,
    displayDescription,
    displayTags,
  };
}

export async function getRelatedFlags(flagId: string) {
  const cachedRelatedFlags = await redis.get(`recommendations-${flagId}`);
  if (cachedRelatedFlags) {
    return cachedRelatedFlags as typeof relatedFlags;
  }

  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  // Get the flag data to extract related flags
  const flagData = await db
    .select({
      id: flags.id,
      relatedFlags: flags.relatedFlags,
    })
    .from(flags)
    .where(eq(flags.id, flagId))
    .limit(1);

  if (!flagData?.[0]) {
    return [];
  }

  // Find flags that have this flag in their related flags
  const relatedToThisFlag = (
    await db
      .select({ id: flags.id })
      .from(flags)
      .where(sql`related_flags @> ${JSON.stringify([flagId])}::jsonb`)
  ).map((flag) => flag.id);

  // Extract IDs from relatedFlags - handle both string IDs and objects with id property
  const relatedFlagIds = Array.from(
    new Set(flagData[0].relatedFlags.concat(relatedToThisFlag).filter(Boolean)),
  );

  if (relatedFlagIds.length === 0) {
    return [];
  }

  // Fetch the full related flag data
  const relatedFlags = await db
    .select({
      id: flags.id,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      sources: flags.sources,
      index: flags.index,
      tags: flags.tags,
      description: flags.description,
      createdAt: flags.createdAt,
      updatedAt: flags.updatedAt,
      favorites: flags.favorites,
      relatedFlags: flags.relatedFlags,
      isFavorite: userId
        ? sql<boolean>`EXISTS (
				SELECT 1 FROM vexilo_favorite 
				WHERE vexilo_favorite.flag_id = vexilo_flag.id 
				AND vexilo_favorite.user_id = ${userId}
			)`
        : sql<boolean>`false`,
    })
    .from(flags)
    .where(inArray(flags.id, relatedFlagIds));

  await redis.set(`recommendations-${flagId}`, relatedFlags);

  return relatedFlags;
}

export async function getExperimentalRecommendedFlags(flagId: string) {
  const metadata = await db
    .select({
      flagId: flagAiMetadata.flagId,
      descriptionDraft: flagAiMetadata.descriptionDraft,
      tagsDraft: flagAiMetadata.tagsDraft,
      metaTags: flagAiMetadata.metaTags,
      detailedDescription: flagAiMetadata.detailedDescription,
      visualDescription: flagAiMetadata.visualDescription,
      historicalContext: flagAiMetadata.historicalContext,
      searchTokens: flagAiMetadata.searchTokens,
      structuredData: flagAiMetadata.structuredData,
    })
    .from(flagAiMetadata)
    .where(eq(flagAiMetadata.flagId, flagId))
    .limit(1);

  const sourceMetadata = metadata[0] ?? null;
  if (!hasRecommendationMetadata(sourceMetadata)) {
    return getRelatedFlags(flagId);
  }

  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  const cacheKey = `experimental-recommendations-${EXPERIMENTAL_RECOMMENDATION_CACHE_VERSION}-${flagId}`;
  const cachedRecommendationIds = await redis.get<string[]>(cacheKey);

  if (Array.isArray(cachedRecommendationIds) && cachedRecommendationIds.length > 0) {
    return getFlagsByIds(cachedRecommendationIds, userId);
  }

  const candidates = await db
    .select({
      id: flags.id,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      sources: flags.sources,
      index: flags.index,
      tags: flags.tags,
      description: flags.description,
      favorites: flags.favorites,
      flagId: flagAiMetadata.flagId,
      descriptionDraft: flagAiMetadata.descriptionDraft,
      tagsDraft: flagAiMetadata.tagsDraft,
      metaTags: flagAiMetadata.metaTags,
      detailedDescription: flagAiMetadata.detailedDescription,
      visualDescription: flagAiMetadata.visualDescription,
      historicalContext: flagAiMetadata.historicalContext,
      searchTokens: flagAiMetadata.searchTokens,
      structuredData: flagAiMetadata.structuredData,
    })
    .from(flagAiMetadata)
    .innerJoin(flags, eq(flags.id, flagAiMetadata.flagId))
    .where(ne(flagAiMetadata.flagId, flagId));

  const rankedIds = candidates
    .map((candidate) => ({
      id: candidate.id,
      score: scoreMetadataRecommendation(sourceMetadata, candidate),
      favorites: candidate.favorites,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.favorites !== left.favorites) {
        return right.favorites - left.favorites;
      }

      return left.id.localeCompare(right.id);
    })
    .slice(0, EXPERIMENTAL_RECOMMENDATION_LIMIT)
    .map((candidate) => candidate.id);

  if (rankedIds.length === 0) {
    return getRelatedFlags(flagId);
  }

  await redis.set(cacheKey, rankedIds, {
    ex: EXPERIMENTAL_RECOMMENDATION_CACHE_TTL_SECONDS,
  });

  return getFlagsByIds(rankedIds, userId);
}

export async function getRandomFlagsForQuiz() {
  // Get 4 random flags directly from the database with favorites info
  const randomFlags = await db
    .select({
      id: flags.id,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      index: flags.index,
      tags: flags.tags,
      description: flags.description,
      sources: flags.sources,
      createdAt: flags.createdAt,
      updatedAt: flags.updatedAt,
      favorites: flags.favorites,
      isFavorite: await isFavorite(),
    })
    .from(flags)
    .orderBy(sql`RANDOM()`)
    .limit(4);
  return randomFlags;
}

async function isFavorite(userId?: string) {
  let user = userId;
  if (!user) {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return sql<boolean>`false`;
    }
    user = user ?? session.user.id;
  }
  return sql<boolean>`EXISTS (SELECT 1 FROM vexilo_favorite WHERE vexilo_favorite.flag_id = vexilo_flag.id AND vexilo_favorite.user_id = ${user})`;
}

export async function getFlagOfTheDay() {
  const cachedFotd = await redis.get('fotd');
  if (cachedFotd) {
    return cachedFotd as (typeof flag)[0];
  }

  const fotd = await db
    .select()
    .from(flagOfTheDay)
    .orderBy(desc(flagOfTheDay.createdAt))
    .limit(1);

  let fotdId = fotd?.[0]?.flagId;

  if (!fotdId) {
    await generateFlagOfTheDay();
    fotdId = (
      await db
        .select({ flagId: flagOfTheDay.flagId })
        .from(flagOfTheDay)
        .orderBy(desc(flagOfTheDay.createdAt))
        .limit(1)
    )?.[0]?.flagId;
  }

  const flag = await db
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
      isFavorite: await isFavorite(),
    })
    .from(flags)
    .where(eq(flags.id, fotdId))
    .limit(1);

  await redis.set('fotd', flag?.[0], {
    ex: 60 * 60 * 24, // 24 hours
  });

  return flag?.[0];
}

function buildWhereClause(query?: string) {
  if (!query) {
    return sql`1=1`;
  }
  // Use ILIKE OR trigram similarity above a threshold
  return sql`
    lower(${flags.name}) LIKE lower(${`%${query}%`})
    OR similarity(${flags.name}, ${query}) > 0.2
  `;
}

function orderByClause(
  orderBy: keyof typeof flags.$inferSelect,
  orderDirection: 'asc' | 'desc',
) {
  if (orderDirection === 'asc') {
    return asc(flags[orderBy]);
  }
  return desc(flags[orderBy]);
}

export async function getFlags(
  page: number,
  limit: number,
  query?: string,
  orderBy: keyof typeof flags.$inferSelect = 'updatedAt',
  orderDirection: 'asc' | 'desc' = 'desc',
  tag?: string,
) {
  const whereClause = buildWhereClause(query);

  const boundedLimit = Math.min(limit, 100);

  // const isHomePage =
  //   page === 1 &&
  //   !query &&
  //   !tag &&
  //   orderBy === 'favorites' &&
  //   orderDirection === 'desc';
  // if (isHomePage) {
  //   const cachedResults = await redis.get(`flags:home`);
  //   if (cachedResults) {
  //     return cachedResults as typeof results;
  //   }
  // }

  const results = await db
    .select({
      id: flags.id,
      favorites: flags.favorites,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      index: flags.index,
      tags: flags.tags,
      description: flags.description,
      sources: flags.sources,
      isFavorite: await isFavorite(),
    })
    .from(flags)
    .where(
      and(whereClause, tag ? sql`${flags.tags} @> ARRAY[${tag}]` : sql`1=1`),
    )
    .orderBy(
      query
        ? sql`similarity(${flags.name}, ${query}) DESC`
        : orderByClause(orderBy, orderDirection),
    )
    .limit(boundedLimit)
    .offset((page - 1) * boundedLimit);

  // if (isHomePage) {
  //   await redis.set(`flags:home`, results);
  // }

  return results;
}

export async function getUserFavorites(
  userId: string,
  page: number,
  limit: number,
  query?: string,
  orderBy: keyof typeof flags.$inferSelect = 'updatedAt',
  orderDirection: 'asc' | 'desc' = 'desc',
  tag?: string,
) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((res) => res[0]);

  if (!user) {
    return [];
  }

  const boundedLimit = Math.min(limit, 100);

  function orderByClause(orderBy: keyof typeof flags.$inferSelect) {
    if (orderBy === 'updatedAt') {
      return desc(favorites.createdAt);
    }
    return orderDirection === 'asc'
      ? asc(flags[orderBy])
      : desc(flags[orderBy]);
  }

  const flgs = await db
    .select({
      id: flags.id,
      favorites: flags.favorites,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      index: flags.index,
      tags: flags.tags,
      description: flags.description,
      sources: flags.sources,
      isFavorite: await isFavorite(),
    })
    .from(flags)
    .leftJoin(
      favorites,
      and(eq(favorites.flagId, flags.id), eq(favorites.userId, userId)),
    )
    .where(
      and(
        ilike(flags.name, `%${query}%`),
        await isFavorite(userId),
        tag ? sql`${flags.tags} @> ARRAY[${tag}]` : sql`1=1`,
      ),
    )
    .orderBy(
      query
        ? sql`similarity(${flags.name}, ${query}) DESC`
        : orderByClause(orderBy),
    )
    .limit(boundedLimit)
    .offset((page - 1) * boundedLimit);

  return flgs;
}

export async function getFavouriteFlags(
  page: number,
  limit: number,
  query?: string,
  orderBy: keyof typeof flags.$inferSelect = 'updatedAt',
  orderDirection: 'asc' | 'desc' = 'desc',
  tag?: string,
) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return [];
  }

  return await getUserFavorites(
    session.user.id,
    page,
    limit,
    query,
    orderBy,
    orderDirection,
    tag,
  );
}

export async function getFlagsCount(query?: string, tag?: string) {
  const whereClause = buildWhereClause(query);

  const cnt = await db
    .select({ count: count() })
    .from(flags)
    .where(
      and(whereClause, tag ? sql`${flags.tags} @> ARRAY[${tag}]` : sql`1=1`),
    );

  return cnt[0].count;
}

export async function getFavoriteFlagsCount(query?: string, tag?: string) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return 0;
  }

  const cnt = await db
    .select({ count: count() })
    .from(flags)
    .where(
      and(
        ilike(flags.name, `%${query}%`),
        await isFavorite(),
        tag ? sql`${flags.tags} @> ARRAY[${tag}]` : sql`1=1`,
      ),
    );

  return cnt[0].count;
}

export async function createAdminFlags(flagList: Flag[]) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return false;
  }

  try {
    // Validate and truncate flags to fit database constraints
    const validatedFlags = flagList.map((flag, index) => {
      // Check for any flags that might be too long
      if (
        flag.flagName.length > 255 ||
        flag.flagImage.length > 255 ||
        flag.link.length > 255
      ) {
        console.log(`Flag at index ${index} has long values:`, {
          nameLength: flag.flagName.length,
          imageLength: flag.flagImage.length,
          linkLength: flag.link.length,
          name: flag.flagName.substring(0, 50) + '...',
          image: flag.flagImage.substring(0, 50) + '...',
          link: flag.link.substring(0, 50) + '...',
        });
      }

      return {
        name: flag.flagName,
        image: flag.flagImage,
        link: flag.link,
        index: flag.index,
        tags: flag.tags || [],
      };
    });

    await db.insert(flags).values(validatedFlags);

    // Update tag counts for all created flags
    for (const flag of validatedFlags) {
      await addTagsToCount(flag.tags);
    }

    return true;
  } catch (error) {
    console.error('Error creating admin flags:', error);
    throw new Error(
      `Failed to import flags: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

export async function generateFlagOfTheDay() {
  const flagCount = await getFlagsCount('');
  const randomIndex = Math.floor(Math.random() * flagCount);
  const fotd = await db
    .select()
    .from(flags)
    .where(eq(flags.index, randomIndex))
    .limit(1);

  await db.insert(flagOfTheDay).values({
    flagId: fotd[0].id,
  });
}

const FOTD_HISTORY_PER_PAGE = 12;

export async function getPastFlagsOfTheDay(page: number = 1) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  const offset = (page - 1) * FOTD_HISTORY_PER_PAGE;

  // Get past flags of the day with their associated flag data
  const pastFotd = await db
    .select({
      id: flagOfTheDay.id,
      flagId: flagOfTheDay.flagId,
      date: flagOfTheDay.createdAt,
      flag: {
        id: flags.id,
        name: flags.name,
        image: flags.image,
        link: flags.link,
        index: flags.index,
        tags: flags.tags,
        description: flags.description,
        sources: flags.sources,
        favorites: flags.favorites,
      },
      isFavorite: userId
        ? sql<boolean>`EXISTS (
            SELECT 1 FROM vexilo_favorite 
            WHERE vexilo_favorite.flag_id = ${flags.id} 
            AND vexilo_favorite.user_id = ${userId}
          )`
        : sql<boolean>`false`,
    })
    .from(flagOfTheDay)
    .innerJoin(flags, eq(flagOfTheDay.flagId, flags.id))
    .orderBy(desc(flagOfTheDay.createdAt))
    .limit(FOTD_HISTORY_PER_PAGE)
    .offset(offset);

  const totalCount = await db.select({ count: count() }).from(flagOfTheDay);

  return {
    flags: pastFotd,
    totalCount: totalCount[0]?.count || 0,
    totalPages: Math.ceil((totalCount[0]?.count || 0) / FOTD_HISTORY_PER_PAGE),
    currentPage: page,
  };
}

export async function toggleFavoriteFlag(
  flagId: string,
  deleteCache: boolean = false,
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return false;
    }

    const existingFavorite = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, session.user.id),
          eq(favorites.flagId, flagId),
        ),
      );

    if (existingFavorite.length > 0) {
      await db
        .delete(favorites)
        .where(eq(favorites.id, existingFavorite[0].id));

      await db
        .update(flags)
        .set({
          favorites: sql`favorites - 1`,
        })
        .where(eq(flags.id, flagId));

      if (deleteCache) {
        await redis.del('flags:home');
      }

      return true;
    }

    await db.insert(favorites).values({
      userId: session.user.id,
      flagId: flagId,
    });

    await db
      .update(flags)
      .set({
        favorites: sql`favorites + 1`,
      })
      .where(eq(flags.id, flagId));

    if (deleteCache) {
      await redis.del('flags:home');
    }

    return true;
  } catch (error) {
    console.error('Error toggling favorite flag:', error);
    return false;
  }
}

const REQUESTS_PER_PAGE = 12;

export async function getUserFlags(userNumber: string, page: number) {
  const session = await getServerAuthSession();

  const user = await db
    .select()
    .from(users)
    .where(eq(users.userNumber, userNumber))
    .limit(1)
    .then((res) => res[0]);

  if (!user) {
    return {
      success: false,
      message: 'User not found.',
    };
  }

  const userFlags = await db
    .select({
      id: flags.id,
      flagName: flags.name,
      flagImage: flags.image,
      link: flags.link,
      description: flags.description,
      sources: flags.sources,
      tags: flags.tags,
      index: flags.index,
      favorites: flags.favorites,
      isFavorite: session
        ? sql<boolean>`EXISTS (SELECT 1 FROM vexilo_favorite WHERE vexilo_favorite.flag_id = vexilo_flag.id AND vexilo_favorite.user_id = ${session.user.id})`
        : sql<boolean>`false`,
    })
    .from(flags)
    .innerJoin(flagRequests, eq(flags.id, sql`${flagRequests.flagId}::uuid`))
    .where(
      and(
        eq(flagRequests.userId, user.id),
        eq(flagRequests.approved, true),
        eq(flagRequests.isEdit, false),
      ),
    )
    .orderBy(desc(flagRequests.createdAt))
    .limit(REQUESTS_PER_PAGE)
    .offset((page - 1) * REQUESTS_PER_PAGE);

  if (user.isAnonymous) {
    user.name = 'Anonymous User';
    user.image = '/logo.svg';
  }

  const totalFlagsCount = await db
    .select({ count: count() })
    .from(flagRequests)
    .where(
      and(
        eq(flagRequests.userId, user.id),
        eq(flagRequests.approved, true),
        eq(flagRequests.isEdit, false),
      ),
    );

  return {
    flags: userFlags,
    count: totalFlagsCount[0].count,
  };
}

export async function getUserContributionCounts(userNumber: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.userNumber, userNumber))
    .limit(1)
    .then((res) => res[0]);

  const totalFlagCount = await db
    .select({ count: count() })
    .from(flagRequests)
    .where(
      and(
        eq(flagRequests.userId, user.id),
        eq(flagRequests.approved, true),
        eq(flagRequests.isEdit, false),
      ),
    );

  const totalEditCount = await db
    .select({ count: count() })
    .from(flagRequests)
    .where(
      and(
        eq(flagRequests.userId, user.id),
        eq(flagRequests.approved, true),
        eq(flagRequests.isEdit, true),
      ),
    );

  return {
    totalFlagCount: totalFlagCount[0].count,
    totalEditCount: totalEditCount[0].count,
  };
}

export async function getProfileUserFavorites(
  userNumber: string,
  page: number,
) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.userNumber, userNumber))
    .limit(1)
    .then((res) => res[0]);

  if (!user) {
    return {
      success: false,
      message: 'User not found.',
    };
  }

  const userFlags = await getUserFavorites(
    user.id,
    page,
    REQUESTS_PER_PAGE,
    '',
    'updatedAt',
  );

  const totalFlagsCount = await db
    .select({ count: count() })
    .from(flags)
    .where(await isFavorite(user.id));

  return {
    flags: userFlags,
    count: totalFlagsCount[0].count,
  };
}

export async function getUserEditedFlags(userNumber: string, page: number) {
  const session = await getServerAuthSession();

  const user = await db
    .select()
    .from(users)
    .where(eq(users.userNumber, userNumber))
    .limit(1)
    .then((res) => res[0]);

  if (!user) {
    return {
      success: false,
      message: 'User not found.',
    };
  }

  const userEditedFlags = await db
    .select({
      id: flags.id,
      flagName: flags.name,
      flagImage: flags.image,
      link: flags.link,
      description: flags.description,
      sources: flags.sources,
      tags: flags.tags,
      index: flags.index,
      favorites: flags.favorites,
      isFavorite: session
        ? sql<boolean>`EXISTS (SELECT 1 FROM vexilo_favorite WHERE vexilo_favorite.flag_id = vexilo_flag.id AND vexilo_favorite.user_id = ${session.user.id})`
        : sql<boolean>`false`,
    })
    .from(flags)
    .innerJoin(flagRequests, eq(flags.id, sql`${flagRequests.flagId}::uuid`))
    .where(
      and(
        eq(flagRequests.userId, user.id),
        eq(flagRequests.approved, true),
        eq(flagRequests.isEdit, true),
      ),
    )
    .orderBy(desc(flagRequests.createdAt))
    .limit(REQUESTS_PER_PAGE)
    .offset((page - 1) * REQUESTS_PER_PAGE);

  const totalEditedFlagsCount = await db
    .select({ count: count() })
    .from(flagRequests)
    .where(
      and(
        eq(flagRequests.userId, user.id),
        eq(flagRequests.approved, true),
        eq(flagRequests.isEdit, true),
      ),
    );

  return {
    flags: userEditedFlags,
    count: totalEditedFlagsCount[0].count,
  };
}

export async function getFlagEditHistory(flagId: string) {
  const history = await db
    .select({
      id: flagRequests.id,
      userId: flagRequests.userId,
      oldFlag: flagRequests.oldFlag,
      newFlag: flagRequests.flag,
      createdAt: flagRequests.createdAt,
      userName: users.name,
      userImage: users.image,
      userNumber: users.userNumber,
      isAnonymous: users.isAnonymous,
    })
    .from(flagRequests)
    .innerJoin(users, eq(flagRequests.userId, users.id))
    .where(
      and(
        eq(flagRequests.flagId, flagId),
        eq(flagRequests.isEdit, true),
        eq(flagRequests.approved, true),
      ),
    )
    .orderBy(desc(flagRequests.createdAt))
    .limit(20);

  return history.map((item) => ({
    ...item,
    userName: item.isAnonymous ? 'Anonymous User' : item.userName,
    userImage: item.isAnonymous ? '/logo.svg' : item.userImage,
  }));
}

export async function deleteFlag(flagId: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return false;
  }

  const flagToDelete = await db
    .select()
    .from(flags)
    .where(eq(flags.id, flagId))
    .limit(1);

  if (!flagToDelete?.[0]) {
    return false;
  }

  const oldTags = flagToDelete[0].tags;

  await db.delete(flags).where(eq(flags.id, flagId));
  await removeTagsFromCount(oldTags);

  return true;
}

export async function updateFlag(
  flagId: string,
  data: {
    name?: string;
    image?: string;
    link?: string;
    description?: string;
    tags?: string[];
  },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    throw new Error('Unauthorized');
  }

  const flagToUpdate = await db
    .select()
    .from(flags)
    .where(eq(flags.id, flagId))
    .limit(1);

  if (!flagToUpdate?.[0]) {
    return false;
  }

  const oldTags = flagToUpdate[0].tags;
  const newTags = data.tags || [];

  await db
    .update(flags)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(flags.id, flagId));

  await updateTagCounts(oldTags, newTags);

  return true;
}

const ADMIN_FLAGS_PAGE_SIZE = 50;

export type AdminFlagsSort = 'recent' | 'oldest' | 'name';

export async function getAdminFlags(params: {
  query?: string;
  tag?: string;
  missingDescription?: boolean;
  sort?: AdminFlagsSort;
  page?: number;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const query = params.query?.trim();
  const tag = params.tag?.trim().toLowerCase();
  const where = and(
    query ? ilike(flags.name, `%${query}%`) : undefined,
    tag ? sql`${tag} = any(${flags.tags})` : undefined,
    params.missingDescription ? eq(flags.description, '') : undefined,
  );
  const orderBy =
    params.sort === 'oldest'
      ? asc(flags.createdAt)
      : params.sort === 'name'
        ? asc(flags.name)
        : desc(flags.createdAt);
  const page = Math.max(params.page ?? 1, 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: flags.id,
        name: flags.name,
        image: flags.image,
        link: flags.link,
        tags: flags.tags,
        sources: flags.sources,
        description: flags.description,
        favorites: flags.favorites,
        createdAt: flags.createdAt,
      })
      .from(flags)
      .where(where)
      .orderBy(orderBy, asc(flags.id))
      .limit(ADMIN_FLAGS_PAGE_SIZE)
      .offset((page - 1) * ADMIN_FLAGS_PAGE_SIZE),
    db.select({ total: count() }).from(flags).where(where),
  ]);

  return { flags: rows, total, pageSize: ADMIN_FLAGS_PAGE_SIZE };
}

export async function bulkEditFlagTags(
  flagIds: string[],
  changes: { add?: string[]; remove?: string[] },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const add = (changes.add ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const remove = new Set((changes.remove ?? []).map((tag) => tag.trim().toLowerCase()));
  if (flagIds.length === 0 || (add.length === 0 && remove.size === 0)) {
    return 0;
  }

  const rows = await db
    .select({ id: flags.id, tags: flags.tags })
    .from(flags)
    .where(inArray(flags.id, flagIds));

  let updated = 0;
  for (const row of rows) {
    const nextTags = Array.from(
      new Set([...row.tags.filter((tag) => !remove.has(tag)), ...add]),
    );
    if (
      nextTags.length === row.tags.length &&
      nextTags.every((tag) => row.tags.includes(tag))
    ) {
      continue;
    }
    await db
      .update(flags)
      .set({ tags: nextTags, updatedAt: new Date() })
      .where(eq(flags.id, row.id));
    await updateTagCounts(row.tags, nextTags);
    updated += 1;
  }

  await redis.del('tags');
  return updated;
}

/** Marks every selected flag as related to all the others. */
export async function relateFlags(flagIds: string[]) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const ids = Array.from(new Set(flagIds));
  if (ids.length < 2) {
    return 0;
  }

  const rows = await db
    .select({ id: flags.id, relatedFlags: flags.relatedFlags })
    .from(flags)
    .where(inArray(flags.id, ids));

  for (const row of rows) {
    const nextRelated = Array.from(
      new Set([...row.relatedFlags, ...ids.filter((id) => id !== row.id)]),
    );
    await db
      .update(flags)
      .set({ relatedFlags: nextRelated, updatedAt: new Date() })
      .where(eq(flags.id, row.id));
    await redis.del(`recommendations-${row.id}`);
  }

  return rows.length;
}

export async function deleteFlags(flagIds: string[]) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const rows = await db
    .select({ id: flags.id, name: flags.name, tags: flags.tags })
    .from(flags)
    .where(inArray(flags.id, flagIds));

  const deleted: string[] = [];
  const failed: Array<{ id: string; name: string; message: string }> = [];
  for (const row of rows) {
    try {
      await db.delete(flags).where(eq(flags.id, row.id));
      await removeTagsFromCount(row.tags);
      deleted.push(row.id);
    } catch (error) {
      console.error(`Deleting flag ${row.id} failed`, error);
      failed.push({
        id: row.id,
        name: row.name,
        message: 'Still referenced elsewhere (e.g. a past flag of the day).',
      });
    }
  }

  await redis.del('tags');
  return { deleted, failed };
}

export async function getAdminCounts() {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const [[pending], [openReports], [allFlags]] = await Promise.all([
    db
      .select({ count: count() })
      .from(flagRequests)
      .where(and(eq(flagRequests.approved, false), eq(flagRequests.deleted, false))),
    db.select({ count: count() }).from(reports).where(eq(reports.resolved, false)),
    db.select({ count: count() }).from(flags),
  ]);

  return {
    pending: pending.count,
    reports: openReports.count,
    flags: allFlags.count,
  };
}

export async function updateAdminFlag(
  flagId: string,
  data: {
    name: string;
    image: string;
    description: string;
    tags: string[];
    sources: string[];
  },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return null;
  }

  const [existing] = await db
    .select({ tags: flags.tags })
    .from(flags)
    .where(eq(flags.id, flagId))
    .limit(1);
  if (!existing) {
    return false;
  }

  const tags = Array.from(
    new Set(data.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
  );
  await db
    .update(flags)
    .set({
      name: data.name.trim(),
      image: data.image.trim(),
      description: data.description.trim(),
      sources: data.sources,
      tags,
      updatedAt: new Date(),
    })
    .where(eq(flags.id, flagId));
  await updateTagCounts(existing.tags, tags);
  await redis.del('tags');

  return true;
}
