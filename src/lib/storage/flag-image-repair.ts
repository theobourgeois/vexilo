import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { flags } from '@/db/schema';
import { storeFlagColors } from '@/lib/flag-palette';
import { ensureFlagImageSelfHosted } from '@/lib/storage/flag-image-mirror';

/**
 * Finding replacements for flags whose image link died (usually a Wikimedia file that was
 * renamed or deleted), and swapping them in. Used by the admin "Broken images" view and
 * scripts/storage/repair-dead-flag-images.ts.
 */

const USER_AGENT = 'Vexilo/1.0 (https://vexilo.org; flag image repair)';
const IMAGE_EXTENSIONS = /\.(svg|png|jpe?g|gif|webp)$/i;

export type ImageCandidate = { title: string; url: string; wiki: 'commons' | 'en' };

export type ReplacementLookup = {
  /** How the suggestion was found; absent when there's no confident suggestion. */
  method?: 'renamed' | 'moved' | 'exact-match';
  suggestion?: ImageCandidate;
  candidates: ImageCandidate[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function wikiApi(wiki: 'commons' | 'en', params: Record<string, string>) {
  const host = wiki === 'commons' ? 'commons.wikimedia.org' : 'en.wikipedia.org';
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } }).catch(() => null);
    if (response?.ok) return response.json();
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`Wiki API failed: ${url}`);
}

/** Whether an image URL is gone for good (as opposed to slow or rate limited). */
export async function isImageGone(url: string) {
  const response = await fetch(url, {
    method: 'HEAD',
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  return response?.status === 404 || response?.status === 410;
}

/** Image URL for a file title, following renames; null when the file doesn't exist. */
async function resolveFile(wiki: 'commons' | 'en', title: string): Promise<ImageCandidate | null> {
  const data = await wikiApi(wiki, { action: 'query', titles: title, redirects: '1', prop: 'imageinfo', iiprop: 'url' });
  const page = data?.query?.pages?.[0];
  const url = page?.imageinfo?.[0]?.url;
  return page && !page.missing && url ? { title: page.title, url, wiki } : null;
}

async function searchFiles(wiki: 'commons' | 'en', query: string): Promise<ImageCandidate[]> {
  const data = await wikiApi(wiki, { action: 'query', list: 'search', srnamespace: '6', srlimit: '8', srsearch: query });
  const titles: string[] = (data?.query?.search ?? [])
    .map((hit: { title: string }) => hit.title)
    .filter((title: string) => IMAGE_EXTENSIONS.test(title));
  const resolved: ImageCandidate[] = [];
  for (const title of titles) {
    const file = await resolveFile(wiki, title);
    if (file) resolved.push(file);
  }
  return resolved;
}

/** Comparable form of a file title or flag name: no extension, punctuation, dashes or leading "the". */
function normalizeTitle(value: string) {
  return value
    .replace(/^File:/i, '')
    .replace(IMAGE_EXTENSIONS, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_–—-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fileTitleFromUrl(url: string) {
  const match = url.match(/upload\.wikimedia\.org\/wikipedia\/(commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/);
  if (!match) return null;
  return {
    wiki: (match[1] === 'en' ? 'en' : 'commons') as 'commons' | 'en',
    title: `File:${decodeURIComponent(match[2]).replace(/_/g, ' ')}`,
  };
}

/**
 * Looks for a replacement image, cheapest first: the same file under a new name (Commons keeps
 * redirects and a move log), then a file whose title exactly matches the flag. Anything less
 * certain comes back as candidates for a person to choose from.
 */
export async function findImageReplacements(flag: { name: string; image: string }, maxCandidates = 6): Promise<ReplacementLookup> {
  const original = fileTitleFromUrl(flag.image);

  if (original) {
    const renamed = await resolveFile(original.wiki, original.title);
    if (renamed && renamed.url !== flag.image) return { method: 'renamed', suggestion: renamed, candidates: [] };

    const log = await wikiApi(original.wiki, { action: 'query', list: 'logevents', letype: 'move', letitle: original.title, lelimit: '1' });
    const target = log?.query?.logevents?.[0]?.params?.target_title;
    const moved = target ? await resolveFile(original.wiki, target) : null;
    if (moved) return { method: 'moved', suggestion: moved, candidates: [] };
  }

  const wanted = new Set([normalizeTitle(`Flag of ${flag.name}`), normalizeTitle(flag.name)]);
  if (original) wanted.add(normalizeTitle(original.title));
  const queries = [
    `Flag of ${flag.name.replace(/^the /i, '')}`,
    ...(original ? [original.title.replace(/^File:/, '').replace(IMAGE_EXTENSIONS, '')] : []),
  ];

  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>([flag.image]);
  for (const wiki of ['commons', 'en'] as const) {
    for (const query of queries) {
      for (const candidate of await searchFiles(wiki, query)) {
        if (seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        candidates.push(candidate);
      }
    }
  }

  const exact = candidates
    .filter((candidate) => wanted.has(normalizeTitle(candidate.title)))
    // Prefer SVG when the same title exists in several formats.
    .sort((a, b) => Number(b.url.endsWith('.svg')) - Number(a.url.endsWith('.svg')));
  return {
    method: exact.length > 0 ? 'exact-match' : undefined,
    suggestion: exact[0],
    candidates: candidates.slice(0, maxCandidates),
  };
}

/**
 * Points a flag at a new image, copies it to CloudFront and re-reads its colours.
 * `expectedImage` guards against overwriting an image someone changed in the meantime.
 */
export async function replaceFlagImage(flagId: string, newImage: string, expectedImage?: string) {
  const [flag] = await db
    .update(flags)
    .set({ image: newImage, updatedAt: new Date() })
    .where(and(eq(flags.id, flagId), expectedImage ? inArray(flags.image, [expectedImage, newImage]) : undefined))
    .returning({ id: flags.id, name: flags.name, index: flags.index });
  if (!flag) return null;

  const hosted = await ensureFlagImageSelfHosted({ ...flag, image: newImage });
  const colors = await storeFlagColors(flagId, hosted);
  return { image: hosted, colors };
}
