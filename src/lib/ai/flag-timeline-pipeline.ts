import { openai } from '@ai-sdk/openai';
import { type InferToolOutput, Output, generateText } from 'ai';
import { z } from 'zod';

import { db } from '@/db';
import { type FlagTimelineEvent, flagTimelines } from '@/db/schema';
import { buildUsageLog } from '@/lib/ai/flag-metadata-pipeline';
import { expireCache, FLAGS_TAG } from '@/lib/cache-tags';

// Builds a dated history for one flag from two places:
//   1. Its older versions already in the catalogue ("Libya (1972–1977)"), which link to their own pages.
//      Their names are typed by users, so the model checks each one is really an earlier version of this flag.
//   2. Web research done for the timeline alone. The flag's History text isn't used, since it isn't reliable enough.
// Every researched event has to cite a page that its web searches actually returned, or it's dropped.

const DEFAULT_MODEL = process.env.FLAG_TIMELINE_MODEL || 'gpt-6-luna';
export const PIPELINE_VERSION = 'timeline-v1';
const MAX_WEB_SEARCH_CALLS = 4;
const MIN_EVENTS = 2;

type WebSearchOutput = InferToolOutput<ReturnType<typeof openai.tools.webSearch>>;

export type TimelineFlag = { id: string; name: string };

/** An older version of the flag that has its own catalogue page. */
export type CatalogueVersion = { flagId: string; name: string; start: number; end: number | null };

export const TIMELINE_EVENT_KINDS = [
  'designed',
  'adopted',
  'modified',
  'readopted',
  'standardized',
  'replaced',
  'abolished',
  'other',
] as const;

export type DroppedEvent = { year: number; title: string; reason: string; sources: string[] };

export type TimelineResult = {
  flag: TimelineFlag;
  model: string;
  status: 'ok' | 'insufficient';
  events: FlagTimelineEvent[];
  dropped: DroppedEvent[];
  searchSources: string[];
  notes: string;
  usage: ReturnType<typeof buildUsageLog>;
};

const researchSchema = z.object({
  events: z.array(
    z.object({
      year: z.number().int(),
      endYear: z.number().int().nullable(),
      kind: z.enum(TIMELINE_EVENT_KINDS),
      title: z.string(),
      detail: z.string(),
      sourceUrls: z.array(z.string()),
    }),
  ),
  versions: z.array(
    z.object({
      name: z.string(),
      verdict: z.enum(['version', 'different_flag', 'unsure']),
      description: z.string(),
    }),
  ),
  notes: z.string(),
});

function buildPrompt(flag: TimelineFlag, versions: CatalogueVersion[]) {
  const leads = versions.length
    ? [
        'Our catalogue also holds these dated flags filed under the same name. The names were typed by users:',
        ...versions.map((v) => `- ${v.name}`),
      ].join('\n')
    : 'Our catalogue has no older versions of it.';

  return [
    'You are researching the design history of one flag for a timeline in a flag encyclopedia.',
    '',
    `Flag: "${flag.name}" (its current flag)`,
    leads,
    '',
    "Search the web for the history of this flag's design. Prefer Wikipedia's article on the flag, Flags of the World (crwflags.com/fotw), and official government or legislative pages.",
    '',
    "events: the dated events in the flag's own history, oldest first.",
    '- when it or an earlier version was designed, first adopted, changed, re-adopted, officially standardized, or replaced or abolished',
    '- only events about the flag itself; leave out general political history unless it directly changed the flag',
    '- only years that a page you found states explicitly; never estimate or infer a year',
    '- sourceUrls: the exact URL of every page that states the event, copied from your search results',
    '- endYear: only for a version that was used over a period and has since been replaced, otherwise null',
    '- title: at most 8 words, e.g. "Current 2:3 version adopted"',
    '- detail: one plain sentence, at most 30 words',
    '- at most 10 events: keep adoptions and design changes, and drop rules about where or by whom the flag may be flown',
    '- leave out anything you are unsure of; fewer correct events beat more doubtful ones',
    '',
    'versions: one entry for each catalogue flag listed above, using its name exactly as written.',
    '- verdict "version": it really is an earlier official or national version of this same flag, used in those years',
    '- verdict "different_flag": a proposal, variant, ensign, standard, a rival or different entity\'s flag, or anything else that is not a former version',
    '- verdict "unsure": you could not confirm it either way',
    '- description: for a "version", one plain sentence (at most 20 words) on what was different about it; otherwise an empty string',
    '',
    'If you cannot find reliable dated history, return an empty events list and say why in notes.',
  ].join('\n');
}

/** Comparable form of a URL: no protocol, "www.", mobile Wikipedia, fragment, tracking params or trailing slash. */
export function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) if (key.startsWith('utm_')) parsed.searchParams.delete(key);
    const host = parsed.host.replace(/^www\./, '').replace(/^(\w+)\.m\.wikipedia\.org$/, '$1.wikipedia.org');
    const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, '');
    return `${host}${path}${parsed.search}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Merges confirmed catalogue versions into the researched events. A version links to the event that introduced it
 * (same start year, or one year off, since user-typed dates often are); the rest become events of their own.
 */
function mergeVersions(events: FlagTimelineEvent[], versions: (CatalogueVersion & { description: string })[]) {
  const merged = events.map((event) => ({ ...event }));
  const introduces = (event: FlagTimelineEvent) => event.kind !== 'abolished' && !event.versionFlagId;
  for (const version of versions) {
    const match =
      merged.find((event) => introduces(event) && event.year === version.start) ??
      merged.find((event) => introduces(event) && Math.abs(event.year - version.start) === 1);
    if (match) {
      match.versionFlagId = version.flagId;
      match.endYear ??= version.end;
      match.origin = 'both';
      continue;
    }
    merged.push({
      year: version.start,
      endYear: version.end,
      kind: 'version',
      title: version.end ? `Version used ${version.start}–${version.end}` : `Version from ${version.start}`,
      detail: version.description,
      sources: [],
      versionFlagId: version.flagId,
      origin: 'catalogue',
    });
  }
  return merged.sort((a, b) => a.year - b.year || (a.origin === 'catalogue' ? 1 : -1));
}

export async function researchFlagTimeline(
  flag: TimelineFlag,
  versions: CatalogueVersion[],
  options: { model?: string } = {},
): Promise<TimelineResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY.');
  const model = options.model || DEFAULT_MODEL;

  const { output, usage, toolCalls, toolResults, sources } = await generateText({
    model: openai(model),
    prompt: buildPrompt(flag, versions),
    tools: { web_search: openai.tools.webSearch({ searchContextSize: 'medium' }) },
    providerOptions: { openai: { maxToolCalls: MAX_WEB_SEARCH_CALLS } },
    output: Output.object({ schema: researchSchema }),
  });

  // Every page the searches returned or opened, plus any citations on the answer.
  const seen = new Map<string, string>();
  const remember = (url: string | null | undefined) => {
    const key = url && normalizeUrl(url);
    if (key && !seen.has(key)) seen.set(key, url!);
  };
  for (const result of toolResults) {
    if (result.toolName !== 'web_search') continue;
    const { action, sources: found = [] } = result.output as WebSearchOutput;
    for (const source of found) if (source.type === 'url') remember(source.url);
    if (action && 'url' in action) remember(action.url);
  }
  for (const source of sources) if (source.sourceType === 'url') remember(source.url);

  const currentYear = new Date().getFullYear();
  const kept: FlagTimelineEvent[] = [];
  const dropped: DroppedEvent[] = [];
  for (const event of output.events) {
    const verified = event.sourceUrls.filter((url) => {
      const key = normalizeUrl(url);
      return key !== null && seen.has(key);
    });
    const reason =
      event.year < 1000 || event.year > currentYear
        ? 'year out of range'
        : event.endYear !== null && (event.endYear < event.year || event.endYear > currentYear)
          ? 'end year out of range'
          : verified.length === 0
            ? 'cited page was not in the search results'
            : null;
    if (reason) {
      dropped.push({ year: event.year, title: event.title, reason, sources: event.sourceUrls });
      continue;
    }
    // One event per year: the model often splits a single change into "approved" and "adopted". Keep the first, pool the sources.
    const sameYear = kept.find((k) => k.year === event.year);
    if (sameYear) {
      sameYear.sources = [...new Set([...sameYear.sources, ...verified])];
      sameYear.endYear ??= event.endYear;
      dropped.push({ year: event.year, title: event.title, reason: `merged into "${sameYear.title}"`, sources: verified });
      continue;
    }
    kept.push({
      year: event.year,
      endYear: event.endYear,
      kind: event.kind,
      title: event.title.trim(),
      detail: event.detail.trim(),
      sources: verified,
      versionFlagId: null,
      origin: 'research',
    });
  }

  // Only catalogue flags the model confirmed as earlier versions go on the timeline.
  const verdicts = new Map(output.versions.map((v) => [v.name.trim().toLowerCase(), v]));
  const confirmed = versions.flatMap((version) => {
    const verdict = verdicts.get(version.name.trim().toLowerCase());
    if (verdict?.verdict === 'version') return [{ ...version, description: verdict.description.trim() }];
    dropped.push({
      year: version.start,
      title: version.name,
      reason: verdict ? `catalogue flag judged ${verdict.verdict.replace('_', ' ')}` : 'catalogue flag not assessed',
      sources: [],
    });
    return [];
  });

  const events = mergeVersions(kept, confirmed);
  const webSearchCalls = toolCalls.filter((call) => call.toolName === 'web_search').length;

  return {
    flag,
    model,
    status: events.length >= MIN_EVENTS ? 'ok' : 'insufficient',
    events,
    dropped,
    searchSources: [...seen.values()],
    notes: output.notes.trim(),
    usage: buildUsageLog(usage, model, webSearchCalls),
  };
}

export async function saveFlagTimeline(result: TimelineResult) {
  const row = {
    status: result.status,
    events: result.events,
    model: result.model,
    pipelineVersion: PIPELINE_VERSION,
    research: {
      dropped: result.dropped,
      notes: result.notes,
      searchSources: result.searchSources,
      usage: result.usage,
    },
    generatedAt: new Date(),
  };
  await db
    .insert(flagTimelines)
    .values({ flagId: result.flag.id, ...row })
    .onConflictDoUpdate({ target: flagTimelines.flagId, set: row });
  expireCache(FLAGS_TAG);
}
