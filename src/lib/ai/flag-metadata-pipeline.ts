import { db } from '@/db';
import {
  flagAiMetadata,
  type FlagAiResearchSource,
  type FlagAiStructuredData,
  flags,
} from '@/db/schema';
import { openai } from '@ai-sdk/openai';
import { Output, generateText } from 'ai';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { tavily } from '@tavily/core';
import { z } from 'zod';

const DEFAULT_MODEL = process.env.FLAG_AI_MODEL || 'gpt-5';
const PIPELINE_VERSION = 'v1-single-pass';

type FlagRecord = {
  id: string;
  name: string;
  image: string;
  link: string;
  sources: string[];
  index: number;
  tags: string[];
  description: string;
};

type PipelineLogLevel = 'info' | 'warn' | 'error';

type PipelineLogFn = (
  level: PipelineLogLevel,
  message: string,
  data?: unknown,
) => void;

type GenerateFlagAiMetadataBaseOptions = {
  dryRun?: boolean;
  model?: string;
  onLog?: PipelineLogFn;
};

type GenerateFlagAiMetadataOptions =
  | (GenerateFlagAiMetadataBaseOptions & { flagId: string })
  | (GenerateFlagAiMetadataBaseOptions & { flagName: string })
  | (GenerateFlagAiMetadataBaseOptions & { flagIndex: number });

type FlagAiGenerationResult = {
  flag: FlagRecord;
  model: string;
  persisted: boolean;
  persistenceError?: string;
  requestUsage?: ReturnType<typeof buildUsageLog>;
  payload: {
    descriptionDraft: string;
    tagsDraft: string[];
    metaTags: string[];
    detailedDescription: string;
    visualDescription: string;
    historicalContext: string;
    searchTokens: string[];
    embeddingText: string;
    researchSources: FlagAiResearchSource[];
    structuredData: FlagAiStructuredData | null;
  };
  rawResponse: unknown;
};

type OpenAiUserContentPart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      image: URL | Uint8Array;
    };

type ModelPricing = {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion?: number;
  outputUsdPerMillion: number;
};

type UsageSnapshot = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  outputTokenDetails?: {
    textTokens?: number;
    reasoningTokens?: number;
  };
};

const COLOR_VALUES = [
  'red',
  'blue',
  'green',
  'yellow',
  'white',
  'black',
  'orange',
  'purple',
  'brown',
  'gold',
  'silver',
  'maroon',
  'light_blue',
] as const;

const LAYOUT_TYPE_VALUES = [
  'solid',
  'horizontal_stripes',
  'vertical_stripes',
  'cross',
  'nordic_cross',
  'saltire',
  'centered_emblem',
  'canton',
  'diagonal',
  'triangle',
  'quartered',
  'complex',
] as const;

const PATTERN_TYPE_VALUES = [
  'solid',
  'bicolor',
  'tricolor',
  'multistripe',
  'solid_with_center_symbol',
  'solid_with_canton',
  'cross_pattern',
  'diagonal_pattern',
  'quartered',
  'complex',
] as const;

const SYMBOL_TYPE_VALUES = [
  'star',
  'cross',
  'circle',
  'sun',
  'moon',
  'triangle',
  'diamond',
  'animal',
  'plant',
  'weapon',
  'coat_of_arms',
  'seal',
  'text',
  'map',
  'building',
  'human',
  'crown',
  'ship',
  'tool',
  'constellation',
  'other',
] as const;

const SYMBOL_COUNT_VALUES = ['none', 'one', 'few', 'many'] as const;

const TEXT_TYPE_VALUES = [
  'none',
  'motto',
  'name',
  'initials',
  'scripture',
  'date',
  'other',
] as const;

const EMBLEM_PLACEMENT_VALUES = [
  'none',
  'center',
  'canton',
  'hoist',
  'fly',
  'top',
  'bottom',
  'full_field',
] as const;

const flagMetadataObjectSchema = z.object({
  descriptionDraft: z.string(),
  tagsDraft: z.array(z.string()),
  metaTags: z.array(z.string()),
  detailedDescription: z.string(),
  visualDescription: z.string(),
  historicalContext: z.string(),
  structuredData: z.object({
    dominantColors: z.array(z.enum(COLOR_VALUES)),
    secondaryColors: z.array(z.enum(COLOR_VALUES)),
    layoutType: z.enum(LAYOUT_TYPE_VALUES).nullable(),
    patternType: z.enum(PATTERN_TYPE_VALUES).nullable(),
    primarySymbols: z.array(z.enum(SYMBOL_TYPE_VALUES)),
    secondarySymbols: z.array(z.enum(SYMBOL_TYPE_VALUES)),
    symbolCount: z.enum(SYMBOL_COUNT_VALUES).nullable(),
    hasText: z.boolean().nullable(),
    textType: z.enum(TEXT_TYPE_VALUES).nullable(),
    emblemPlacement: z.enum(EMBLEM_PLACEMENT_VALUES).nullable(),
    regionTags: z.array(z.string()),
    periodTags: z.array(z.string()),
    styleTags: z.array(z.string()),
    notes: z.array(z.string()),
  }),
});

function emitLog(
  logger: PipelineLogFn | undefined,
  level: PipelineLogLevel,
  message: string,
  data?: unknown,
) {
  logger?.(level, message, data);
}

function formatUsd(value: number): string {
  return value.toFixed(6);
}

function getModelPricing(model: string): ModelPricing | null {
  const normalizedModel = model.trim().toLowerCase();

  if (normalizedModel === 'gpt-5.4') {
    return {
      inputUsdPerMillion: 2.5,
      cachedInputUsdPerMillion: 0.25,
      outputUsdPerMillion: 15,
    };
  }

  if (normalizedModel === 'gpt-5') {
    return {
      inputUsdPerMillion: 1.25,
      cachedInputUsdPerMillion: 0.125,
      outputUsdPerMillion: 10,
    };
  }

  if (normalizedModel === 'gemini-2.5-flash') {
    return {
      inputUsdPerMillion: 0.3,
      cachedInputUsdPerMillion: 0.03,
      outputUsdPerMillion: 2.5,
    };
  }

  if (normalizedModel === 'gemini-2.5-pro') {
    return {
      inputUsdPerMillion: 1.25,
      cachedInputUsdPerMillion: 0.125,
      outputUsdPerMillion: 10,
    };
  }

  return null;
}

function buildUsageLog(usage: UsageSnapshot, model: string) {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
  const cachedInputTokens =
    usage.inputTokenDetails?.cacheReadTokens ?? Math.max(inputTokens - (usage.inputTokenDetails?.noCacheTokens ?? inputTokens), 0);
  const nonCachedInputTokens =
    usage.inputTokenDetails?.noCacheTokens ?? Math.max(inputTokens - cachedInputTokens, 0);
  const cacheWriteTokens = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  const textOutputTokens = usage.outputTokenDetails?.textTokens;
  const reasoningTokens = usage.outputTokenDetails?.reasoningTokens;
  const pricing = getModelPricing(model);

  let estimatedCostUsd: number | undefined;
  if (pricing) {
    estimatedCostUsd =
      (nonCachedInputTokens / 1_000_000) * pricing.inputUsdPerMillion +
      (cachedInputTokens / 1_000_000) *
        (pricing.cachedInputUsdPerMillion ?? pricing.inputUsdPerMillion) +
      (outputTokens / 1_000_000) * pricing.outputUsdPerMillion;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    nonCachedInputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    ...(typeof textOutputTokens === 'number' ? { textOutputTokens } : {}),
    ...(typeof reasoningTokens === 'number' ? { reasoningTokens } : {}),
    ...(typeof estimatedCostUsd === 'number'
      ? { estimatedCostUsd: formatUsd(estimatedCostUsd) }
      : {}),
  };
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    deduped.add(trimmed);
  }

  return Array.from(deduped);
}

function normalizeTokenArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const token = normalizeToken(item);
    if (!token) {
      continue;
    }

    deduped.add(token);
  }

  return Array.from(deduped);
}

function normalizeEnumArray<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): T[] {
  const allowed = new Set<string>(allowedValues);
  return normalizeTokenArray(value).filter((item): item is T =>
    allowed.has(item),
  );
}

function normalizeEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): T | null {
  if (typeof value !== 'string') {
    return null;
  }

  const token = normalizeToken(value);
  return allowedValues.includes(token as T) ? (token as T) : null;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

function normalizeStructuredData(value: unknown): FlagAiStructuredData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;

  return {
    dominantColors: normalizeEnumArray(data.dominantColors, COLOR_VALUES),
    secondaryColors: normalizeEnumArray(data.secondaryColors, COLOR_VALUES),
    layoutType: normalizeEnumValue(data.layoutType, LAYOUT_TYPE_VALUES),
    patternType: normalizeEnumValue(data.patternType, PATTERN_TYPE_VALUES),
    primarySymbols: normalizeEnumArray(data.primarySymbols, SYMBOL_TYPE_VALUES),
    secondarySymbols: normalizeEnumArray(
      data.secondarySymbols,
      SYMBOL_TYPE_VALUES,
    ),
    symbolCount: normalizeEnumValue(data.symbolCount, SYMBOL_COUNT_VALUES),
    hasText: normalizeBoolean(data.hasText),
    textType: normalizeEnumValue(data.textType, TEXT_TYPE_VALUES),
    emblemPlacement: normalizeEnumValue(
      data.emblemPlacement,
      EMBLEM_PLACEMENT_VALUES,
    ),
    regionTags: normalizeTokenArray(data.regionTags),
    periodTags: normalizeTokenArray(data.periodTags),
    styleTags: normalizeTokenArray(data.styleTags),
    notes: normalizeStringArray(data.notes),
  };
}

function buildSearchTokens(
  structuredData: FlagAiStructuredData | null,
): string[] {
  if (!structuredData) {
    return [];
  }

  const tokens = new Set<string>();

  for (const color of structuredData.dominantColors || []) {
    tokens.add(`color_${color}`);
    tokens.add(`dominant_${color}`);
  }

  for (const color of structuredData.secondaryColors || []) {
    tokens.add(`color_${color}`);
    tokens.add(`secondary_${color}`);
  }

  if (structuredData.layoutType) {
    tokens.add(`layout_${structuredData.layoutType}`);
  }

  if (structuredData.patternType) {
    tokens.add(`pattern_${structuredData.patternType}`);
  }

  for (const symbol of structuredData.primarySymbols || []) {
    tokens.add(`symbol_${symbol}`);
    tokens.add(`primary_symbol_${symbol}`);
  }

  for (const symbol of structuredData.secondarySymbols || []) {
    tokens.add(`symbol_${symbol}`);
    tokens.add(`secondary_symbol_${symbol}`);
  }

  if (structuredData.symbolCount) {
    tokens.add(`symbol_count_${structuredData.symbolCount}`);
  }

  if (structuredData.hasText === true) {
    tokens.add('has_text');
  }

  if (structuredData.hasText === false) {
    tokens.add('no_text');
  }

  if (structuredData.textType && structuredData.textType !== 'none') {
    tokens.add(`text_type_${structuredData.textType}`);
  }

  if (
    structuredData.emblemPlacement &&
    structuredData.emblemPlacement !== 'none'
  ) {
    tokens.add(`emblem_${structuredData.emblemPlacement}`);
  }

  for (const region of structuredData.regionTags || []) {
    tokens.add(`region_${region}`);
  }

  for (const period of structuredData.periodTags || []) {
    tokens.add(`period_${period}`);
  }

  for (const style of structuredData.styleTags || []) {
    tokens.add(`style_${style}`);
  }

  return Array.from(tokens);
}

function buildEmbeddingText(
  structuredData: FlagAiStructuredData | null,
  searchTokens: string[],
): string {
  const lines: string[] = [];

  for (const color of structuredData?.dominantColors || []) {
    lines.push(`dominant color ${color.replace(/_/g, ' ')}`);
  }

  for (const color of structuredData?.secondaryColors || []) {
    lines.push(`secondary color ${color.replace(/_/g, ' ')}`);
  }

  if (structuredData?.layoutType) {
    lines.push(`layout ${structuredData.layoutType.replace(/_/g, ' ')}`);
  }

  if (structuredData?.patternType) {
    lines.push(`pattern ${structuredData.patternType.replace(/_/g, ' ')}`);
  }

  for (const symbol of structuredData?.primarySymbols || []) {
    lines.push(`primary symbol ${symbol.replace(/_/g, ' ')}`);
  }

  for (const symbol of structuredData?.secondarySymbols || []) {
    lines.push(`secondary symbol ${symbol.replace(/_/g, ' ')}`);
  }

  if (structuredData?.symbolCount) {
    lines.push(`symbol count ${structuredData.symbolCount}`);
  }

  if (structuredData?.hasText === true) {
    lines.push('has text');
  }

  if (structuredData?.hasText === false) {
    lines.push('no text');
  }

  if (structuredData?.textType && structuredData.textType !== 'none') {
    lines.push(`text type ${structuredData.textType.replace(/_/g, ' ')}`);
  }

  if (
    structuredData?.emblemPlacement &&
    structuredData.emblemPlacement !== 'none'
  ) {
    lines.push(
      `emblem placement ${structuredData.emblemPlacement.replace(/_/g, ' ')}`,
    );
  }

  for (const region of structuredData?.regionTags || []) {
    lines.push(`region ${region.replace(/_/g, ' ')}`);
  }

  for (const period of structuredData?.periodTags || []) {
    lines.push(`period ${period.replace(/_/g, ' ')}`);
  }

  for (const style of structuredData?.styleTags || []) {
    lines.push(`style ${style.replace(/_/g, ' ')}`);
  }

  if (lines.length === 0) {
    return searchTokens.join('\n');
  }

  return Array.from(new Set(lines)).join('\n');
}

function dedupeResearchSources(
  sources: FlagAiResearchSource[],
): FlagAiResearchSource[] {
  const seen = new Set<string>();
  const deduped: FlagAiResearchSource[] = [];

  for (const source of sources) {
    const key = JSON.stringify([
      source.type,
      source.url ?? '',
      source.title ?? '',
      source.provider ?? '',
      source.model ?? '',
    ]);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(source);
  }

  return deduped;
}

async function resolveFlag(
  options: GenerateFlagAiMetadataOptions,
): Promise<FlagRecord> {
  const baseSelect = {
    id: flags.id,
    name: flags.name,
    image: flags.image,
    link: flags.link,
    sources: flags.sources,
    index: flags.index,
    tags: flags.tags,
    description: flags.description,
  };

  let result: FlagRecord[] = [];

  if ('flagId' in options) {
    result = await db
      .select(baseSelect)
      .from(flags)
      .where(eq(flags.id, options.flagId))
      .limit(1);
  } else if ('flagName' in options) {
    result = await db
      .select(baseSelect)
      .from(flags)
      .where(eq(flags.name, options.flagName))
      .limit(1);
  } else {
    result = await db
      .select(baseSelect)
      .from(flags)
      .where(eq(flags.index, options.flagIndex))
      .limit(1);
  }

  if (!result[0]) {
    throw new Error('Flag not found.');
  }

  return result[0];
}

async function buildOpenAiUserContent(
  prompt: string,
  imageUrl: string,
  logger?: PipelineLogFn,
): Promise<OpenAiUserContentPart[]> {
  const isSvg = imageUrl.toLowerCase().includes('.svg');

  if (!isSvg) {
    return [
      { type: 'text', text: prompt },
      { type: 'image', image: new URL(imageUrl) },
    ];
  }

  emitLog(logger, 'info', 'Using SVG-safe vision input path', { imageUrl });
  const svgResponse = await fetch(imageUrl);
  if (!svgResponse.ok) {
    throw new Error(
      `Failed to fetch SVG source: ${svgResponse.status} ${svgResponse.statusText}`,
    );
  }

  const svgText = await svgResponse.text();
  const content: OpenAiUserContentPart[] = [{ type: 'text', text: prompt }];
  try {
    emitLog(logger, 'info', 'Rasterizing SVG locally for vision input', {
      imageUrl,
    });
    const pngBytes = await sharp(Buffer.from(svgText))
      .resize({ width: 1024, height: 1024, fit: 'inside' })
      .png()
      .toBuffer();
    content.push({ type: 'image', image: new Uint8Array(pngBytes) });
  } catch (error) {
    emitLog(
      logger,
      'warn',
      'Local SVG rasterization failed, falling back to SVG text only',
      {
        imageUrl,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

  content.push({
    type: 'text',
    text: `SVG source for the flag image (truncated):\n${svgText.slice(0, 30000)}`,
  });

  return content;
}

function buildStructuredPrompt(flag: FlagRecord, researchMemo: string): string {
  return [
    'You are generating high-precision AI metadata for a vexillology website.',
    'Use the provided image as the primary visual source of truth.',
    'Use the grounded research memo below only for supported historical or contextual facts.',
    'Do not invent facts. If uncertain, prefer an empty string or empty array.',
    'Keep user-facing tags broad and useful; keep meta tags dense and visually descriptive for embeddings.',
    'The structuredData object is the primary search representation. Be consistent and prefer the controlled vocabulary exactly.',
    'Use snake_case for regionTags, periodTags, and styleTags.',
    'Write user-facing prose as direct factual copy, not as commentary about your sources or process.',
    'Do not mention the research memo, provided materials, source bundle, or use phrases like "according to", "the memo states", or "the research says".',
    '',
    `Flag name: ${flag.name}`,
    `Flag index: ${flag.index}`,
    `Existing description: ${flag.description || '(empty)'}`,
    `Existing tags: ${flag.tags.join(', ') || '(none)'}`,
    `Existing source URLs: ${flag.sources.join(', ') || '(none)'}`,
    `Reference link: ${flag.link}`,
    '',
    'Grounded research memo:',
    researchMemo || '(none)',
    '',
    'Important distinctions:',
    '- descriptionDraft: short, polished, public-facing draft',
    '- tagsDraft: concise site-style tags like national, tricolor, nordic-cross, historical, etc.',
    '- metaTags: dense descriptors like white cross, blue canton, red field, diagonal bands, coat of arms',
    '- visualDescription: only what is visibly present',
    '- historicalContext: grounded historical context only, written as a direct encyclopedia-style summary with no source callouts',
    '- structuredData: use only the allowed canonical values where specified',
    '',
    `Allowed dominantColors/secondaryColors: ${COLOR_VALUES.join(', ')}`,
    `Allowed layoutType: ${LAYOUT_TYPE_VALUES.join(', ')}`,
    `Allowed patternType: ${PATTERN_TYPE_VALUES.join(', ')}`,
    `Allowed primarySymbols/secondarySymbols: ${SYMBOL_TYPE_VALUES.join(', ')}`,
    `Allowed symbolCount: ${SYMBOL_COUNT_VALUES.join(', ')}`,
    `Allowed textType: ${TEXT_TYPE_VALUES.join(', ')}`,
    `Allowed emblemPlacement: ${EMBLEM_PLACEMENT_VALUES.join(', ')}`,
    '',
    'Return only JSON matching the requested schema.',
  ].join('\n');
}

function buildResearchQuery(flag: FlagRecord): string {
  const keywords = [
    'flag',
    flag.name,
    'design',
    'symbolism',
    'history',
    'vexillology',
    ...flag.tags.slice(0, 5),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  const dedupedKeywords = Array.from(new Set(keywords));
  const query = dedupedKeywords.join(' ').slice(0, 300).trim();

  return query || `flag ${flag.name}`;
}

function buildResearchMemoFromTavily(response: {
  answer?: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    rawContent?: string;
  }>;
}): string {
  const sections: string[] = [];

  if (response.answer?.trim()) {
    sections.push(`Summary:\n${response.answer.trim()}`);
  }

  for (const [index, result] of response.results.entries()) {
    const body = (result.rawContent || result.content || '')
      .trim()
      .slice(0, 1800);
    sections.push(
      [
        `Source ${index + 1}: ${result.title}`,
        `URL: ${result.url}`,
        body ? `Content:\n${body}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return sections.join('\n\n').trim();
}

async function researchFlagWithTavily(
  flag: FlagRecord,
  logger?: PipelineLogFn,
): Promise<{
  researchMemo: string;
  researchSources: FlagAiResearchSource[];
  rawResponse: unknown;
}> {
  const baseSources: FlagAiResearchSource[] = [
    {
      type: 'manual',
      url: flag.link,
      notes: 'Primary flag link from the existing flag record.',
    },
    ...flag.sources.map(
      (url): FlagAiResearchSource => ({
        type: 'manual',
        url,
        notes: 'Existing source attached to the flag record.',
      }),
    ),
  ];

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    emitLog(
      logger,
      'warn',
      'TAVILY_API_KEY is missing, skipping external web research',
    );
    return {
      researchMemo: '',
      researchSources: dedupeResearchSources(baseSources),
      rawResponse: null,
    };
  }

  const client = tavily({ apiKey });
  const query = buildResearchQuery(flag);

  emitLog(logger, 'info', 'Searching Tavily for flag research', {
    query,
    maxResults: 5,
    searchDepth: 'advanced',
  });

  const response = await client.search(query, {
    searchDepth: 'advanced',
    topic: 'general',
    maxResults: 5,
    includeAnswer: 'advanced',
    includeRawContent: 'text',
    chunksPerSource: 3,
  });

  const webSources = response.results.map(
    (result): FlagAiResearchSource => ({
      type: 'web',
      title: result.title,
      url: result.url,
      provider: 'tavily',
      notes: `Tavily search score: ${result.score}`,
    }),
  );

  const researchSources = dedupeResearchSources([
    {
      type: 'llm',
      provider: 'tavily',
      notes: 'External research retrieved through Tavily search.',
    },
    ...baseSources,
    ...webSources,
  ]);

  const researchMemo = buildResearchMemoFromTavily(response);

  emitLog(logger, 'info', 'Received Tavily research results', {
    answerPreview: response.answer?.slice(0, 400) || '',
    resultCount: response.results.length,
  });

  return {
    researchMemo,
    researchSources,
    rawResponse: response,
  };
}

async function generateViaOpenAi(
  flag: FlagRecord,
  model: string,
  logger?: PipelineLogFn,
): Promise<FlagAiGenerationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY.');
  }

  const tavilyResearch = await researchFlagWithTavily(flag, logger);
  const structuredPrompt = buildStructuredPrompt(
    flag,
    tavilyResearch.researchMemo,
  );
  const userContent = await buildOpenAiUserContent(
    structuredPrompt,
    flag.image,
    logger,
  );

  emitLog(logger, 'info', 'Sending structured output request to OpenAI', {
    model,
    provider: 'openai',
    researchSourcesCount: tavilyResearch.researchSources.length,
    promptPreview: structuredPrompt.slice(0, 500),
  });

  const { output, usage } = await generateText({
    model: openai('gpt-5.4'),
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
    output: Output.object({
      schema: flagMetadataObjectSchema,
    }),
  });

  const structuredData = normalizeStructuredData(output.structuredData);
  const searchTokens = buildSearchTokens(structuredData);
  const embeddingText = buildEmbeddingText(structuredData, searchTokens);
  const requestUsage = buildUsageLog(usage, 'gpt-5.4');

  const result = {
    flag,
    model,
    persisted: false,
    requestUsage,
    payload: {
      descriptionDraft: normalizeText(output.descriptionDraft),
      tagsDraft: normalizeStringArray(output.tagsDraft),
      metaTags: normalizeStringArray(output.metaTags),
      detailedDescription: normalizeText(output.detailedDescription),
      visualDescription: normalizeText(output.visualDescription),
      historicalContext: normalizeText(output.historicalContext),
      searchTokens,
      embeddingText,
      researchSources: dedupeResearchSources([
        {
          type: 'llm',
          provider: 'openai',
          model,
          notes: 'Structured metadata generated with the AI SDK.',
        },
        ...tavilyResearch.researchSources,
      ]),
      structuredData,
    },
    rawResponse: {
      research: tavilyResearch.rawResponse,
      structured: output,
    },
  };

  emitLog(logger, 'info', 'Normalized generated payload', result.payload);

  return result;
}

async function upsertStatus(
  flagId: string,
  status: string,
  model: string,
  payload?: FlagAiGenerationResult['payload'],
) {
  await db
    .insert(flagAiMetadata)
    .values({
      flagId,
      generationStatus: status,
      pipelineVersion: PIPELINE_VERSION,
      descriptionDraft: payload?.descriptionDraft ?? '',
      tagsDraft: payload?.tagsDraft ?? [],
      metaTags: payload?.metaTags ?? [],
      detailedDescription: payload?.detailedDescription ?? '',
      visualDescription: payload?.visualDescription ?? '',
      historicalContext: payload?.historicalContext ?? '',
      searchTokens: payload?.searchTokens ?? [],
      embeddingText: payload?.embeddingText ?? '',
      researchSources: payload?.researchSources ?? [
        {
          type: 'llm',
          provider: 'openai',
          model,
          notes: 'Pipeline run started.',
        },
      ],
      structuredData: payload?.structuredData ?? null,
      generatedAt: payload ? new Date() : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: flagAiMetadata.flagId,
      set: {
        generationStatus: status,
        pipelineVersion: PIPELINE_VERSION,
        descriptionDraft: payload?.descriptionDraft ?? '',
        tagsDraft: payload?.tagsDraft ?? [],
        metaTags: payload?.metaTags ?? [],
        detailedDescription: payload?.detailedDescription ?? '',
        visualDescription: payload?.visualDescription ?? '',
        historicalContext: payload?.historicalContext ?? '',
        searchTokens: payload?.searchTokens ?? [],
        embeddingText: payload?.embeddingText ?? '',
        researchSources: payload?.researchSources ?? [
          {
            type: 'llm',
            provider: 'openai',
            model,
            notes: 'Pipeline run started.',
          },
        ],
        structuredData: payload?.structuredData ?? null,
        generatedAt: payload ? new Date() : null,
        updatedAt: new Date(),
      },
    });
}

export async function generateAndStoreFlagAiMetadata(
  options: GenerateFlagAiMetadataOptions,
): Promise<FlagAiGenerationResult> {
  const model = options.model || DEFAULT_MODEL;
  const logger = options.onLog;
  emitLog(logger, 'info', 'Resolving flag selector', {
    selector:
      'flagId' in options
        ? { flagId: options.flagId }
        : 'flagName' in options
          ? { flagName: options.flagName }
          : { flagIndex: options.flagIndex },
    model,
    dryRun: options.dryRun ?? false,
  });
  const flag = await resolveFlag(options);
  emitLog(logger, 'info', 'Resolved flag', {
    id: flag.id,
    name: flag.name,
    index: flag.index,
    image: flag.image,
    existingTags: flag.tags,
  });

  try {
    const result = await generateViaOpenAi(flag, model, logger);

    if (options.dryRun) {
      emitLog(logger, 'info', 'Dry run enabled, skipping database write');
      emitLog(logger, 'info', 'Request usage summary', {
        model: result.model,
        provider: 'openai',
        dryRun: true,
        persisted: false,
        usage: result.requestUsage,
      });
      return result;
    }

    emitLog(logger, 'info', 'Persisting generated metadata to database', {
      flagId: flag.id,
      status: 'completed',
    });

    try {
      await upsertStatus(flag.id, 'completed', model, result.payload);
      result.persisted = true;
      emitLog(logger, 'info', 'Database write completed', {
        flagId: flag.id,
        persisted: true,
      });
    } catch (persistError) {
      const message =
        persistError instanceof Error
          ? persistError.message
          : String(persistError);
      result.persistenceError = message;
      emitLog(logger, 'error', 'Database write failed', {
        flagId: flag.id,
        error: message,
      });
    }

    emitLog(logger, 'info', 'Request usage summary', {
      model: result.model,
      provider: 'openai',
      dryRun: false,
      persisted: result.persisted,
      usage: result.requestUsage,
    });

    return result;
  } catch (error) {
    emitLog(logger, 'error', 'Generation failed', {
      flagId: flag.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
