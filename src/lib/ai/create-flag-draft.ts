import { db } from '@/db';
import { flagTags } from '@/db/schema';
import { findExistingFlags, resolveWikimediaFlag, type ExistingFlagMatch } from '@/actions/batch-flags';
import { uploadFile } from '@/actions/s3';
import { buildUsageLog } from '@/lib/ai/flag-metadata-pipeline';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { openai } from '@ai-sdk/openai';
import { Output, generateText } from 'ai';
import { desc } from 'drizzle-orm';
import sharp from 'sharp';
import { z } from 'zod';

const DEFAULT_MODEL = process.env.FLAG_AI_MODEL || 'gpt-5';
const MAX_WEB_SEARCH_CALLS = 2;
const MAX_SVG_BYTES = 200 * 1024;
const WIKIMEDIA_USER_AGENT = 'VexiloBot/1.0 (https://vexilo.org)';

export type FlagImageMode = 'commons-first' | 'draw' | 'commons-only';

export type FlagDraftOptions = {
  image: FlagImageMode;
  research: boolean;
};

export type FlagDraft = {
  name: string;
  description: string;
  tags: string[];
  sources: string[];
  image: {
    url: string;
    origin: 'commons' | 'drawn';
    /** Commons file name, e.g. "Flag_of_Scotland.svg". */
    fileName?: string;
  } | null;
  fictional: boolean;
  duplicate: ExistingFlagMatch | null;
  model: string;
  webSearches: number;
  costUsd: number | null;
};

const researchSchema = z.object({
  name: z.string(),
  fictional: z.boolean(),
  description: z.string(),
  tags: z.array(z.string()),
  sources: z.array(z.string()),
  commonsFileTitles: z.array(z.string()),
  visualDescription: z.string(),
  aspectRatio: z.number(),
});

type Research = z.infer<typeof researchSchema>;

function addCost(total: number | null, usage: ReturnType<typeof buildUsageLog>) {
  if (usage.estimatedCostUsd === undefined) return total;
  return (total ?? 0) + Number(usage.estimatedCostUsd);
}

async function getSiteTags(): Promise<string[]> {
  const rows = await db
    .select({ tag: flagTags.tag })
    .from(flagTags)
    .orderBy(desc(flagTags.count))
    .limit(80);
  return rows.map((row) => row.tag);
}

function buildResearchPrompt(input: string, research: boolean, siteTags: string[]) {
  return [
    'You are drafting a new entry for Vexilo, a community flag encyclopedia.',
    'The admin typed one line. It is either the name of a real flag (a country, region, city, organisation, historical flag, proposal) or a description of a fictional flag.',
    research
      ? 'Use web search to confirm the flag exists, find its history and adoption, and find the Wikimedia Commons file for it.'
      : 'Do not search the web. Use only what you know with confidence.',
    'Do not invent facts. If unsure, leave a field empty.',
    '',
    `Line: ${input}`,
    '',
    'Fields:',
    '- name: the entry name as Vexilo titles flags: the place or organisation, not "Flag of …" (e.g. "Scotland", "Texas", "Portland, Oregon (2002)"). For fictional flags use the name given.',
    '- fictional: true if this is not a real-world flag.',
    '- description: 1–3 sentences of direct encyclopedia copy covering the design and what it represents. No commentary about sources.',
    '- tags: 3–8 lowercase kebab-case tags. Prefer existing site tags where they fit. Add "fictional" for fictional flags.',
    `  Existing site tags: ${siteTags.join(', ')}`,
    '- sources: URLs that document this flag (Wikipedia, government pages, Commons file page). Empty for fictional flags unless one was given.',
    '- commonsFileTitles: up to 3 likely Wikimedia Commons file titles for the image, most likely first, e.g. "File:Flag of Scotland.svg". Empty if fictional.',
    '- visualDescription: a precise description an illustrator could draw from: layout, every colour as a hex value, positions and sizes of emblems, proportions.',
    '- aspectRatio: width divided by height of the official flag (e.g. 1.5 for 2:3, 2 for 1:2). Use 1.5 if unknown.',
  ].join('\n');
}

export async function researchFlag(input: string, options: FlagDraftOptions, model: string) {
  const siteTags = await getSiteTags();
  const result = await generateText({
    model: openai(model),
    prompt: buildResearchPrompt(input, options.research, siteTags),
    ...(options.research
      ? {
          tools: { web_search: openai.tools.webSearch({ searchContextSize: 'low' }) },
          providerOptions: { openai: { maxToolCalls: MAX_WEB_SEARCH_CALLS } },
        }
      : {}),
    output: Output.object({ schema: researchSchema }),
  });

  const webSearches = result.toolCalls.filter((call) => call.toolName === 'web_search').length;
  return {
    output: result.output,
    webSearches,
    usage: buildUsageLog(result.usage, model, webSearches),
  };
}

export async function searchCommonsFileTitles(name: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    list: 'search',
    srnamespace: '6',
    srlimit: '8',
    srsearch: `"Flag of ${name}" filetype:drawing`,
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': WIKIMEDIA_USER_AGENT },
  }).catch(() => null);
  if (!response?.ok) return [];
  const data = (await response.json()) as { query?: { search?: Array<{ title: string }> } };
  return (data.query?.search ?? []).map((hit) => hit.title).filter((title) => /\.svg$/i.test(title));
}

async function findCommonsImage(research: Research) {
  const searched = await searchCommonsFileTitles(research.name);
  const titles = Array.from(new Set([...research.commonsFileTitles, ...searched.slice(0, 2)]));

  for (const title of titles) {
    const normalized = title.startsWith('File:') ? title : `File:${title}`;
    const resolved = await resolveWikimediaFlag(
      `https://commons.wikimedia.org/wiki/${encodeURIComponent(normalized.replace(/ /g, '_'))}`,
    ).catch(() => null);
    if (resolved?.success) {
      return resolved;
    }
  }
  return null;
}

/** Rejects anything that could run script or pull in remote content. */
function sanitizeSvg(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;
  const svg = match[0];
  if (
    svg.length > MAX_SVG_BYTES ||
    /<script|<foreignObject|<iframe|<image|\son\w+\s*=|javascript:|(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)
  ) {
    return null;
  }
  return svg;
}

async function renderPng(svg: string): Promise<Buffer | null> {
  try {
    return await sharp(Buffer.from(svg)).resize({ width: 900 }).png().toBuffer();
  } catch {
    return null;
  }
}

/**
 * Draws the flag as SVG, then shows the model its own rendering once so it can fix
 * misplaced or malformed emblems (crescents and stars are the usual offenders).
 */
export async function drawFlagSvg(research: Research, input: string, model: string) {
  const ratio = research.aspectRatio > 0.3 && research.aspectRatio < 4 ? research.aspectRatio : 1.5;
  const height = 600;
  const width = Math.round(height * ratio);
  const brief = [
    `Flag: ${research.name || input}`,
    `Design: ${research.visualDescription || input}`,
    '',
    'Rules:',
    `- One standalone SVG with viewBox="0 0 ${width} ${height}", width="${width}" height="${height}". The flag fills the whole canvas.`,
    '- Flat colours only: no gradients, shadows, textures, folds or outlines around the flag.',
    '- Basic shapes and paths only. No <image>, <script>, <foreignObject>, external links or fonts. Only add text if the flag itself has lettering.',
    '- Get the geometry right: compute star points with trigonometry, build crescents from two circles (a filled circle with an offset circle in the field colour on top), and keep emblems centred where the design says.',
  ].join('\n');

  const first = await generateText({
    model: openai(model),
    prompt: `Draw this flag.\n\n${brief}\n\nReply with the SVG only.`,
    providerOptions: { openai: { reasoningEffort: 'high' } },
  });
  let usage = buildUsageLog(first.usage, model);
  let svg = sanitizeSvg(first.text);
  const png = svg ? await renderPng(svg) : null;
  if (!svg || !png) return { svg: null, usage };

  const review = await generateText({
    model: openai(model),
    providerOptions: { openai: { reasoningEffort: 'medium' } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is your SVG for the flag below and how it renders. Compare the rendering with the design. If anything is wrong (shapes, positions, proportions, colours), reply with a corrected SVG. If it is right, reply with the same SVG. Reply with the SVG only.\n\n${brief}\n\nSVG:\n${svg}`,
          },
          { type: 'image', image: png, mediaType: 'image/png' },
        ],
      },
    ],
  });
  const reviewUsage = buildUsageLog(review.usage, model);
  usage = {
    ...usage,
    estimatedCostUsd:
      usage.estimatedCostUsd !== undefined && reviewUsage.estimatedCostUsd !== undefined
        ? String(Number(usage.estimatedCostUsd) + Number(reviewUsage.estimatedCostUsd))
        : undefined,
  };

  const revised = sanitizeSvg(review.text);
  if (revised && (await renderPng(revised))) {
    svg = revised;
  }
  return { svg, usage };
}

async function uploadSvg(svg: string) {
  const key = `images/${crypto.randomUUID()}.svg`;
  await uploadFile(Buffer.from(svg), process.env.S3_BUCKET_NAME!, key, 'image/svg+xml');
  return `${CLOUD_FRONT_URL}/${key}`;
}

function cleanTags(tags: string[], fictional: boolean) {
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean);
  if (fictional) cleaned.push('fictional');
  return Array.from(new Set(cleaned)).slice(0, 10);
}

function cleanSources(sources: string[]) {
  return Array.from(
    new Set(sources.map((source) => source.trim()).filter((source) => /^https?:\/\//.test(source))),
  );
}

/**
 * Turns one line typed by an admin into a flag draft: researches it, finds the image on
 * Wikimedia Commons (or draws one as SVG), and checks Vexilo for an existing entry.
 */
export async function createFlagDraft(
  input: string,
  options: FlagDraftOptions,
  model = DEFAULT_MODEL,
): Promise<FlagDraft> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY.');
  }

  const researched = await researchFlag(input, options, model);
  const info = researched.output;
  let costUsd = addCost(null, researched.usage);

  let image: FlagDraft['image'] = null;
  const sources = cleanSources(info.sources);

  if (options.image !== 'draw' && !info.fictional) {
    const commons = await findCommonsImage(info);
    if (commons?.success) {
      image = { url: commons.imageUrl, origin: 'commons', fileName: commons.fileName };
      if (!sources.includes(commons.source)) sources.push(commons.source);
    }
  }

  if (!image && options.image !== 'commons-only') {
    const drawn = await drawFlagSvg(info, input, model);
    costUsd = addCost(costUsd, drawn.usage);
    if (drawn.svg) {
      image = { url: await uploadSvg(drawn.svg), origin: 'drawn' };
    }
  }

  const name = info.name.trim() || input.trim();
  const [duplicate] = await findExistingFlags([{ key: 'draft', name, sources }]);

  return {
    name,
    description: info.description.trim(),
    tags: cleanTags(info.tags, info.fictional),
    sources,
    image,
    fictional: info.fictional,
    duplicate: duplicate ?? null,
    model,
    webSearches: researched.webSearches,
    costUsd,
  };
}
