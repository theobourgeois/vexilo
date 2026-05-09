'use server';

import { db } from '@/db';
import { flagAiMetadata } from '@/db/schema';
import { eq } from 'drizzle-orm';

const METADATA_MIRROR_GENERATION_STATUS = 'seeded';
const METADATA_MIRROR_PIPELINE_VERSION = 'mirror-v1';

export type FlagMetadataMirrorInput = {
  flagId: string;
  name: string;
  link: string;
  sources: string[];
  tags: string[];
  description: string;
};

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildMirrorSearchTokens(input: FlagMetadataMirrorInput) {
  return Array.from(
    new Set(
      [
        input.name,
        input.description,
        input.link,
        ...input.sources,
        ...input.tags,
      ].flatMap(tokenize),
    ),
  );
}

function buildFlagMetadataMirrorPayload(input: FlagMetadataMirrorInput) {
  const tagsDraft = uniqueValues(input.tags);

  return {
    descriptionDraft: input.description.trim(),
    tagsDraft,
    metaTags: tagsDraft,
    searchTokens: buildMirrorSearchTokens(input),
  };
}

export async function upsertFlagMetadataMirror(input: FlagMetadataMirrorInput) {
  const payload = buildFlagMetadataMirrorPayload(input);
  const updatedAt = new Date();

  await db
    .insert(flagAiMetadata)
    .values({
      flagId: input.flagId,
      generationStatus: METADATA_MIRROR_GENERATION_STATUS,
      pipelineVersion: METADATA_MIRROR_PIPELINE_VERSION,
      descriptionDraft: payload.descriptionDraft,
      tagsDraft: payload.tagsDraft,
      metaTags: payload.metaTags,
      searchTokens: payload.searchTokens,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: flagAiMetadata.flagId,
      set: {
        descriptionDraft: payload.descriptionDraft,
        tagsDraft: payload.tagsDraft,
        metaTags: payload.metaTags,
        searchTokens: payload.searchTokens,
        updatedAt,
      },
    });

  return payload;
}

export async function getFlagAiMetadata(flagId: string) {
  const rows = await db
    .select({
      id: flagAiMetadata.id,
      flagId: flagAiMetadata.flagId,
      generationStatus: flagAiMetadata.generationStatus,
      pipelineVersion: flagAiMetadata.pipelineVersion,
      descriptionDraft: flagAiMetadata.descriptionDraft,
      tagsDraft: flagAiMetadata.tagsDraft,
      metaTags: flagAiMetadata.metaTags,
      detailedDescription: flagAiMetadata.detailedDescription,
      visualDescription: flagAiMetadata.visualDescription,
      historicalContext: flagAiMetadata.historicalContext,
      searchTokens: flagAiMetadata.searchTokens,
      embeddingText: flagAiMetadata.embeddingText,
      researchSources: flagAiMetadata.researchSources,
      structuredData: flagAiMetadata.structuredData,
      generatedAt: flagAiMetadata.generatedAt,
      updatedAt: flagAiMetadata.updatedAt,
    })
    .from(flagAiMetadata)
    .where(eq(flagAiMetadata.flagId, flagId))
    .limit(1);

  return rows[0] ?? null;
}
