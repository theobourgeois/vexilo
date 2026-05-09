'use server';

import { db } from '@/db';
import {
  flagAiMetadata,
  flags,
  type FlagAiStructuredData,
} from '@/db/schema';
import { asc, desc, eq, sql } from 'drizzle-orm';

const MAX_PAGE_SIZE = 48;
const MIN_RESULT_SCORE = 18;
const MAX_REASON_COUNT = 4;
const MAX_METADATA_CHIPS = 6;
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'by',
  'flag',
  'flags',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

type MatchGroup =
  | 'color'
  | 'layout'
  | 'pattern'
  | 'symbol'
  | 'text'
  | 'region'
  | 'period'
  | 'style'
  | 'tag'
  | 'description'
  | 'name';

type RecognizedTerm = {
  label: string;
  group: Exclude<
    MatchGroup,
    'tag' | 'description' | 'region' | 'period' | 'style' | 'name'
  >;
  searchTokens: string[];
};

type QueryInsights = {
  colors: string[];
  layouts: string[];
  patterns: string[];
  symbols: string[];
  text: string[];
  freeText: string[];
};

type SmartSearchResult = {
  id: string;
  flagName: string;
  flagImage: string;
  link: string;
  index: number;
  description: string;
  favorites: number;
  tags: string[];
  score: number;
  headline: string;
  matchReasons: string[];
  metadataChips: string[];
  matchedGroups: MatchGroup[];
};

type SmartSearchResponse = {
  query: string;
  total: number;
  page: number;
  totalPages: number;
  results: SmartSearchResult[];
  insights: QueryInsights;
};

type SearchRow = {
  id: string;
  name: string;
  image: string;
  link: string;
  index: number;
  description: string;
  favorites: number;
  tags: string[];
  descriptionDraft: string | null;
  tagsDraft: string[] | null;
  metaTags: string[] | null;
  detailedDescription: string | null;
  visualDescription: string | null;
  historicalContext: string | null;
  searchTokens: string[] | null;
  structuredData: FlagAiStructuredData | null;
  metadataId: string | null;
  nameSimilarity: number;
};

const PHRASE_TERMS: Array<{
  phrase: string;
  term: RecognizedTerm;
}> = [
  {
    phrase: 'scandinavian cross',
    term: {
      label: 'Scandinavian cross',
      group: 'layout',
      searchTokens: ['layout_nordic_cross'],
    },
  },
  {
    phrase: 'nordic cross',
    term: {
      label: 'Nordic cross',
      group: 'layout',
      searchTokens: ['layout_nordic_cross'],
    },
  },
  {
    phrase: 'horizontal stripes',
    term: {
      label: 'Horizontal stripes',
      group: 'layout',
      searchTokens: ['layout_horizontal_stripes', 'pattern_multistripe'],
    },
  },
  {
    phrase: 'vertical stripes',
    term: {
      label: 'Vertical stripes',
      group: 'layout',
      searchTokens: ['layout_vertical_stripes', 'pattern_multistripe'],
    },
  },
  {
    phrase: 'coat of arms',
    term: {
      label: 'Coat of arms',
      group: 'symbol',
      searchTokens: ['symbol_coat_of_arms'],
    },
  },
  {
    phrase: 'center symbol',
    term: {
      label: 'Centered emblem',
      group: 'layout',
      searchTokens: ['layout_centered_emblem', 'pattern_solid_with_center_symbol'],
    },
  },
  {
    phrase: 'centered emblem',
    term: {
      label: 'Centered emblem',
      group: 'layout',
      searchTokens: ['layout_centered_emblem', 'pattern_solid_with_center_symbol'],
    },
  },
  {
    phrase: 'centered symbol',
    term: {
      label: 'Centered emblem',
      group: 'layout',
      searchTokens: ['layout_centered_emblem', 'pattern_solid_with_center_symbol'],
    },
  },
  {
    phrase: 'union jack style',
    term: {
      label: 'Complex',
      group: 'pattern',
      searchTokens: ['pattern_complex', 'layout_complex'],
    },
  },
];

const TOKEN_TERMS: Record<string, RecognizedTerm> = {
  red: { label: 'Red', group: 'color', searchTokens: ['color_red'] },
  crimson: { label: 'Red', group: 'color', searchTokens: ['color_red'] },
  scarlet: { label: 'Red', group: 'color', searchTokens: ['color_red'] },
  blue: { label: 'Blue', group: 'color', searchTokens: ['color_blue'] },
  azure: { label: 'Blue', group: 'color', searchTokens: ['color_blue'] },
  navy: { label: 'Blue', group: 'color', searchTokens: ['color_blue'] },
  green: { label: 'Green', group: 'color', searchTokens: ['color_green'] },
  yellow: { label: 'Yellow', group: 'color', searchTokens: ['color_yellow'] },
  white: { label: 'White', group: 'color', searchTokens: ['color_white'] },
  black: { label: 'Black', group: 'color', searchTokens: ['color_black'] },
  orange: { label: 'Orange', group: 'color', searchTokens: ['color_orange'] },
  purple: { label: 'Purple', group: 'color', searchTokens: ['color_purple'] },
  brown: { label: 'Brown', group: 'color', searchTokens: ['color_brown'] },
  gold: { label: 'Gold', group: 'color', searchTokens: ['color_gold'] },
  golden: { label: 'Gold', group: 'color', searchTokens: ['color_gold'] },
  silver: { label: 'Silver', group: 'color', searchTokens: ['color_silver'] },
  maroon: { label: 'Maroon', group: 'color', searchTokens: ['color_maroon'] },
  sky: { label: 'Light blue', group: 'color', searchTokens: ['color_light_blue'] },
  cyan: {
    label: 'Light blue',
    group: 'color',
    searchTokens: ['color_light_blue'],
  },
  tricolor: {
    label: 'Tricolor',
    group: 'pattern',
    searchTokens: ['pattern_tricolor'],
  },
  bicolor: {
    label: 'Bicolor',
    group: 'pattern',
    searchTokens: ['pattern_bicolor'],
  },
  stripes: {
    label: 'Striped',
    group: 'pattern',
    searchTokens: ['pattern_multistripe'],
  },
  striped: {
    label: 'Striped',
    group: 'pattern',
    searchTokens: ['pattern_multistripe'],
  },
  cross: {
    label: 'Cross',
    group: 'layout',
    searchTokens: ['layout_cross', 'pattern_cross_pattern', 'symbol_cross'],
  },
  saltire: {
    label: 'Saltire',
    group: 'layout',
    searchTokens: ['layout_saltire'],
  },
  diagonal: {
    label: 'Diagonal',
    group: 'layout',
    searchTokens: ['layout_diagonal', 'pattern_diagonal_pattern'],
  },
  triangle: {
    label: 'Triangle',
    group: 'layout',
    searchTokens: ['layout_triangle', 'symbol_triangle'],
  },
  canton: {
    label: 'Canton',
    group: 'layout',
    searchTokens: ['layout_canton', 'pattern_solid_with_canton'],
  },
  quartered: {
    label: 'Quartered',
    group: 'layout',
    searchTokens: ['layout_quartered', 'pattern_quartered'],
  },
  emblem: {
    label: 'Emblem',
    group: 'layout',
    searchTokens: ['layout_centered_emblem'],
  },
  star: {
    label: 'Star',
    group: 'symbol',
    searchTokens: ['symbol_star'],
  },
  crescent: {
    label: 'Crescent',
    group: 'symbol',
    searchTokens: ['symbol_moon'],
  },
  moon: {
    label: 'Moon',
    group: 'symbol',
    searchTokens: ['symbol_moon'],
  },
  sun: {
    label: 'Sun',
    group: 'symbol',
    searchTokens: ['symbol_sun'],
  },
  eagle: {
    label: 'Animal',
    group: 'symbol',
    searchTokens: ['symbol_animal'],
  },
  lion: {
    label: 'Animal',
    group: 'symbol',
    searchTokens: ['symbol_animal'],
  },
  animal: {
    label: 'Animal',
    group: 'symbol',
    searchTokens: ['symbol_animal'],
  },
  bird: {
    label: 'Animal',
    group: 'symbol',
    searchTokens: ['symbol_animal'],
  },
  tree: {
    label: 'Plant',
    group: 'symbol',
    searchTokens: ['symbol_plant'],
  },
  leaf: {
    label: 'Plant',
    group: 'symbol',
    searchTokens: ['symbol_plant'],
  },
  plant: {
    label: 'Plant',
    group: 'symbol',
    searchTokens: ['symbol_plant'],
  },
  sword: {
    label: 'Weapon',
    group: 'symbol',
    searchTokens: ['symbol_weapon'],
  },
  spear: {
    label: 'Weapon',
    group: 'symbol',
    searchTokens: ['symbol_weapon'],
  },
  weapon: {
    label: 'Weapon',
    group: 'symbol',
    searchTokens: ['symbol_weapon'],
  },
  seal: {
    label: 'Seal',
    group: 'symbol',
    searchTokens: ['symbol_seal'],
  },
  map: {
    label: 'Map',
    group: 'symbol',
    searchTokens: ['symbol_map'],
  },
  crown: {
    label: 'Crown',
    group: 'symbol',
    searchTokens: ['symbol_crown'],
  },
  ship: {
    label: 'Ship',
    group: 'symbol',
    searchTokens: ['symbol_ship'],
  },
  boat: {
    label: 'Ship',
    group: 'symbol',
    searchTokens: ['symbol_ship'],
  },
  motto: {
    label: 'Motto',
    group: 'text',
    searchTokens: ['has_text', 'text_type_motto'],
  },
  text: {
    label: 'Text',
    group: 'text',
    searchTokens: ['has_text', 'symbol_text'],
  },
  script: {
    label: 'Scripture',
    group: 'text',
    searchTokens: ['has_text', 'text_type_scripture'],
  },
  initials: {
    label: 'Initials',
    group: 'text',
    searchTokens: ['has_text', 'text_type_initials'],
  },
  date: {
    label: 'Date text',
    group: 'text',
    searchTokens: ['has_text', 'text_type_date'],
  },
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  if (normalized.endsWith('ies') && normalized.length > 4) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (
    normalized.endsWith('s') &&
    !normalized.endsWith('ss') &&
    normalized.length > 3
  ) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildPhrases(tokens: string[]): string[] {
  const phrases = new Set<string>(tokens);

  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      phrases.add(tokens.slice(index, index + size).join(' '));
    }
  }

  return Array.from(phrases);
}

function pushUnique(target: string[], value: string) {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function parseQuery(query: string) {
  const normalizedQuery = normalizeText(query);
  const rawTokens = normalizedQuery
    ? normalizedQuery
        .split(' ')
        .map(normalizeToken)
        .filter((token) => token && !STOP_WORDS.has(token))
    : [];
  const recognizedTerms: RecognizedTerm[] = [];
  const consumedTokens = new Set<string>();

  for (const { phrase, term } of PHRASE_TERMS) {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedQuery.includes(normalizedPhrase)) {
      continue;
    }

    recognizedTerms.push(term);
    for (const token of normalizedPhrase.split(' ')) {
      consumedTokens.add(normalizeToken(token));
    }
  }

  for (const token of rawTokens) {
    if (consumedTokens.has(token)) {
      continue;
    }

    const term = TOKEN_TERMS[token];
    if (!term) {
      continue;
    }

    recognizedTerms.push(term);
    consumedTokens.add(token);
  }

  const uniqueRecognizedTerms = recognizedTerms.filter(
    (term, index, array) =>
      array.findIndex(
        (candidate) =>
          candidate.label === term.label && candidate.group === term.group,
      ) === index,
  );

  const significantTokens = rawTokens.filter((token) => !consumedTokens.has(token));
  const freeTextTokens = significantTokens.filter((token) => !TOKEN_TERMS[token]);
  const phrases = buildPhrases(rawTokens);

  const searchTokens = new Set<string>();
  const insights: QueryInsights = {
    colors: [],
    layouts: [],
    patterns: [],
    symbols: [],
    text: [],
    freeText: freeTextTokens,
  };

  for (const term of uniqueRecognizedTerms) {
    for (const searchToken of term.searchTokens) {
      searchTokens.add(searchToken);
    }

    if (term.group === 'color') {
      pushUnique(insights.colors, term.label);
    } else if (term.group === 'layout') {
      pushUnique(insights.layouts, term.label);
    } else if (term.group === 'pattern') {
      pushUnique(insights.patterns, term.label);
    } else if (term.group === 'symbol') {
      pushUnique(insights.symbols, term.label);
    } else if (term.group === 'text') {
      pushUnique(insights.text, term.label);
    }
  }

  return {
    normalizedQuery,
    tokens: significantTokens,
    phrases,
    recognizedTerms: uniqueRecognizedTerms,
    recognizedSearchTokens: searchTokens,
    insights,
  };
}

function addReason(
  reasons: string[],
  groups: Set<MatchGroup>,
  group: MatchGroup,
  label: string,
) {
  if (reasons.length < MAX_REASON_COUNT && !reasons.includes(label)) {
    reasons.push(label);
  }
  groups.add(group);
}

function findMatchingValues(values: string[] | undefined, phrases: string[]) {
  if (!values?.length) {
    return [];
  }

  const matches: string[] = [];
  const normalizedValues = values.map((value) => ({
    raw: value,
    normalized: normalizeText(value),
    tokens: normalizeText(value).split(' ').filter(Boolean),
  }));

  for (const value of normalizedValues) {
    if (
      phrases.some(
        (phrase) => {
          if (phrase.length < 3) {
            return false;
          }

          const phraseTokens = phrase.split(' ').filter(Boolean);
          if (phraseTokens.length === 0) {
            return false;
          }

          if (value.normalized === phrase) {
            return true;
          }

          if (
            value.normalized.startsWith(`${phrase} `) ||
            value.normalized.endsWith(` ${phrase}`) ||
            value.normalized.includes(` ${phrase} `)
          ) {
            return true;
          }

          return phraseTokens.every((token) => value.tokens.includes(token));
        },
      )
    ) {
      pushUnique(matches, humanize(value.raw));
    }
  }

  return matches.slice(0, 3);
}

function findTagMatches(values: string[], tokens: string[]) {
  if (!values.length || !tokens.length) {
    return [];
  }

  const matches: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (
      tokens.some(
        (token) => token.length >= 3 && normalized.includes(normalizeText(token)),
      )
    ) {
      pushUnique(matches, humanize(value));
    }
  }

  return matches.slice(0, 3);
}

function buildMetadataChips(
  structuredData: FlagAiStructuredData | null,
  tagsDraft: string[],
) {
  const chips: string[] = [];

  for (const color of structuredData?.dominantColors || []) {
    pushUnique(chips, humanize(color));
  }

  if (structuredData?.layoutType) {
    pushUnique(chips, humanize(structuredData.layoutType));
  }

  if (structuredData?.patternType && structuredData.patternType !== 'solid') {
    pushUnique(chips, humanize(structuredData.patternType));
  }

  for (const symbol of structuredData?.primarySymbols || []) {
    pushUnique(chips, humanize(symbol));
  }

  for (const region of structuredData?.regionTags || []) {
    pushUnique(chips, humanize(region));
  }

  for (const style of structuredData?.styleTags || []) {
    pushUnique(chips, humanize(style));
  }

  for (const tag of tagsDraft) {
    pushUnique(chips, tag);
  }

  return chips.slice(0, MAX_METADATA_CHIPS);
}

function scoreRow(
  row: SearchRow,
  parsedQuery: ReturnType<typeof parseQuery>,
): SmartSearchResult | null {
  const normalizedName = normalizeText(row.name);
  const normalizedDescription = normalizeText(row.description);
  const metadataText = normalizeText(
    [
      row.descriptionDraft,
      row.detailedDescription,
      row.visualDescription,
      row.historicalContext,
      ...(row.tagsDraft || []),
      ...(row.metaTags || []),
    ]
      .filter(Boolean)
      .join(' '),
  );
  const searchTokenSet = new Set(row.searchTokens || []);
  const reasons: string[] = [];
  const matchedGroups = new Set<MatchGroup>();
  let score = 0;

  if (parsedQuery.normalizedQuery === normalizedName) {
    score += 260;
    addReason(reasons, matchedGroups, 'name', 'Exact flag name');
  } else if (
    parsedQuery.normalizedQuery.length >= 3 &&
    normalizedName.includes(parsedQuery.normalizedQuery)
  ) {
    score += 150;
    addReason(reasons, matchedGroups, 'name', 'Direct name match');
  }

  if (row.nameSimilarity > 0.12) {
    score += Math.round(row.nameSimilarity * 110);
    addReason(reasons, matchedGroups, 'name', 'Fuzzy name match');
  }

  const nameTokenMatches = parsedQuery.tokens.filter(
    (token) => token.length >= 3 && normalizedName.includes(token),
  );
  if (nameTokenMatches.length > 0) {
    score += nameTokenMatches.length * 18;
    addReason(
      reasons,
      matchedGroups,
      'name',
      `Name terms: ${nameTokenMatches.slice(0, 3).map(humanize).join(', ')}`,
    );
  }

  const matchedRecognizedTerms = parsedQuery.recognizedTerms.filter((term) =>
    term.searchTokens.some((token) => searchTokenSet.has(token)),
  );

  const groupedRecognizedTerms = new Map<RecognizedTerm['group'], string[]>();
  for (const term of matchedRecognizedTerms) {
    const current = groupedRecognizedTerms.get(term.group) || [];
    pushUnique(current, term.label);
    groupedRecognizedTerms.set(term.group, current);

    if (term.group === 'layout') {
      score += 34;
    } else if (term.group === 'pattern') {
      score += 30;
    } else if (term.group === 'symbol') {
      score += 28;
    } else if (term.group === 'color') {
      score += 24;
    } else if (term.group === 'text') {
      score += 18;
    }
  }

  for (const [group, labels] of groupedRecognizedTerms.entries()) {
    if (group === 'color') {
      addReason(
        reasons,
        matchedGroups,
        'color',
        `Colors: ${labels.slice(0, 3).join(', ')}`,
      );
    } else if (group === 'layout') {
      addReason(
        reasons,
        matchedGroups,
        'layout',
        `Layout: ${labels.slice(0, 3).join(', ')}`,
      );
    } else if (group === 'pattern') {
      addReason(
        reasons,
        matchedGroups,
        'pattern',
        `Pattern: ${labels.slice(0, 3).join(', ')}`,
      );
    } else if (group === 'symbol') {
      addReason(
        reasons,
        matchedGroups,
        'symbol',
        `Symbols: ${labels.slice(0, 3).join(', ')}`,
      );
    } else if (group === 'text') {
      addReason(
        reasons,
        matchedGroups,
        'text',
        `Text: ${labels.slice(0, 3).join(', ')}`,
      );
    }
  }

  if (
    parsedQuery.recognizedTerms.length > 0 &&
    matchedRecognizedTerms.length === parsedQuery.recognizedTerms.length
  ) {
    score += 32;
  } else if (matchedRecognizedTerms.length > 0) {
    score += 12;
  }

  const regionMatches = findMatchingValues(
    row.structuredData?.regionTags,
    parsedQuery.phrases,
  );
  if (regionMatches.length > 0) {
    score += regionMatches.length * 24;
    addReason(
      reasons,
      matchedGroups,
      'region',
      `Region: ${regionMatches.join(', ')}`,
    );
  }

  const periodMatches = findMatchingValues(
    row.structuredData?.periodTags,
    parsedQuery.phrases,
  );
  if (periodMatches.length > 0) {
    score += periodMatches.length * 20;
    addReason(
      reasons,
      matchedGroups,
      'period',
      `Period: ${periodMatches.join(', ')}`,
    );
  }

  const styleMatches = findMatchingValues(
    row.structuredData?.styleTags,
    parsedQuery.phrases,
  );
  if (styleMatches.length > 0) {
    score += styleMatches.length * 20;
    addReason(
      reasons,
      matchedGroups,
      'style',
      `Style: ${styleMatches.join(', ')}`,
    );
  }

  const directTagMatches = findTagMatches(
    [...row.tags, ...(row.tagsDraft || []), ...(row.metaTags || [])],
    parsedQuery.tokens,
  );
  if (directTagMatches.length > 0) {
    score += directTagMatches.length * 16;
    addReason(
      reasons,
      matchedGroups,
      'tag',
      `Tags: ${directTagMatches.join(', ')}`,
    );
  }

  const descriptionTermMatches = parsedQuery.insights.freeText.filter(
    (token) =>
      token.length >= 3 &&
      (normalizedDescription.includes(token) || metadataText.includes(token)),
  );
  if (descriptionTermMatches.length > 0) {
    score += descriptionTermMatches.length * 12;
    addReason(
      reasons,
      matchedGroups,
      'description',
      `Description: ${descriptionTermMatches
        .slice(0, 3)
        .map(humanize)
        .join(', ')}`,
    );
  }

  if (matchedGroups.size >= 3) {
    score += 18;
  } else if (matchedGroups.size >= 2) {
    score += 10;
  }

  const signalCount =
    parsedQuery.recognizedTerms.length + parsedQuery.insights.freeText.length;
  const hasDirectNamePhraseMatch =
    parsedQuery.normalizedQuery === normalizedName ||
    (parsedQuery.normalizedQuery.length >= 3 &&
      normalizedName.includes(parsedQuery.normalizedQuery));
  const hasStrongNameMatch =
    hasDirectNamePhraseMatch ||
    row.nameSimilarity > 0.32;
  const minimumScore = signalCount >= 3 ? MIN_RESULT_SCORE + 12 : MIN_RESULT_SCORE;

  if (score < minimumScore) {
    return null;
  }

  if (signalCount >= 2 && matchedGroups.size < 2 && !hasStrongNameMatch) {
    return null;
  }

  if (
    parsedQuery.recognizedTerms.length > 0 &&
    matchedRecognizedTerms.length === 0 &&
    !hasDirectNamePhraseMatch
  ) {
    return null;
  }

  const headline = row.descriptionDraft || row.description || 'No summary yet.';
  return {
    id: row.id,
    flagName: row.name,
    flagImage: row.image,
    link: row.link,
    index: row.index,
    description: row.description,
    favorites: row.favorites,
    tags: row.tags,
    score,
    headline,
    matchReasons: reasons,
    metadataChips: buildMetadataChips(row.structuredData, row.tagsDraft || []),
    matchedGroups: Array.from(matchedGroups),
  };
}

function buildMetadataOnlyResult(row: SearchRow): SmartSearchResult | null {
  if (!row.metadataId) {
    return null;
  }

  return {
    id: row.id,
    flagName: row.name,
    flagImage: row.image,
    link: row.link,
    index: row.index,
    description: row.description,
    favorites: row.favorites,
    tags: row.tags,
    score: 100 + row.favorites,
    headline: row.descriptionDraft || row.description || 'No summary yet.',
    matchReasons: ['Has experimental metadata'],
    metadataChips: buildMetadataChips(row.structuredData, row.tagsDraft || []),
    matchedGroups: ['tag'],
  };
}

export async function getExperimentalFlagSearchResults(
  query: string,
  page: number = 1,
  limit: number = 24,
): Promise<SmartSearchResponse> {
  const normalizedQuery = normalizeText(query);
  const safePage = Math.max(1, page);
  const pageSize = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
  const parsedQuery = parseQuery(query);

  if (!normalizedQuery) {
    return {
      query: '',
      total: 0,
      page: 1,
      totalPages: 0,
      results: [],
      insights: parsedQuery.insights,
    };
  }

  const rows = await db
    .select({
      id: flags.id,
      name: flags.name,
      image: flags.image,
      link: flags.link,
      index: flags.index,
      description: flags.description,
      favorites: flags.favorites,
      tags: flags.tags,
      descriptionDraft: flagAiMetadata.descriptionDraft,
      tagsDraft: flagAiMetadata.tagsDraft,
      metaTags: flagAiMetadata.metaTags,
      detailedDescription: flagAiMetadata.detailedDescription,
      visualDescription: flagAiMetadata.visualDescription,
      historicalContext: flagAiMetadata.historicalContext,
      searchTokens: flagAiMetadata.searchTokens,
      structuredData: flagAiMetadata.structuredData,
      metadataId: flagAiMetadata.id,
      nameSimilarity: sql<number>`similarity(${flags.name}, ${normalizedQuery})`,
    })
    .from(flags)
    .leftJoin(flagAiMetadata, eq(flagAiMetadata.flagId, flags.id))
    .orderBy(desc(flags.favorites), asc(flags.name));

  const rankedResults = rows
    .map((row) =>
      normalizedQuery === 'exp'
        ? buildMetadataOnlyResult(row)
        : scoreRow(row, parsedQuery),
    )
    .filter((row): row is SmartSearchResult => row !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.favorites !== left.favorites) {
        return right.favorites - left.favorites;
      }
      return left.flagName.localeCompare(right.flagName);
    });

  const offset = (safePage - 1) * pageSize;
  const results = rankedResults.slice(offset, offset + pageSize);

  return {
    query: normalizedQuery,
    total: rankedResults.length,
    page: safePage,
    totalPages: Math.ceil(rankedResults.length / pageSize),
    results,
    insights: parsedQuery.insights,
  };
}
