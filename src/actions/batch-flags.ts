'use server';

import { db } from '@/db';
import { flagRequests, flags } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import {
  MAX_FLAG_IMAGE_BYTES,
  flagNameFromFileName,
  normalizeFlagNameForComparison,
  parseWikimediaFileTitle,
} from '@/lib/batch-flags';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { uploadFile } from './s3';

const WIKIMEDIA_USER_AGENT = 'VexiloBot/1.0 (https://vexilo.org)';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

type WikimediaImageInfo = {
  url: string;
  descriptionurl: string;
  mime: string;
  size: number;
};

async function fetchWikimediaImageInfo(
  apiHost: string,
  title: string,
): Promise<WikimediaImageInfo | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
  });
  const response = await fetch(`https://${apiHost}/w/api.php?${params}`, {
    headers: { 'User-Agent': WIKIMEDIA_USER_AGENT },
  });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    query?: { pages?: Array<{ imageinfo?: WikimediaImageInfo[] }> };
  };
  return data.query?.pages?.[0]?.imageinfo?.[0] ?? null;
}

export type ResolvedWikimediaFlag =
  | {
      success: true;
      name: string;
      fileName: string;
      imageUrl: string;
      source: string;
    }
  | { success: false; message: string };

/**
 * Resolves a Wikimedia Commons / Wikipedia file link into a flag name, a
 * self-hosted copy of the image and the file page to use as its source.
 */
export async function resolveWikimediaFlag(
  url: string,
): Promise<ResolvedWikimediaFlag> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return { success: false, message: 'You must be logged in to add flags.' };
  }

  const title = parseWikimediaFileTitle(url);
  if (!title) {
    return { success: false, message: 'Not a Wikimedia file link.' };
  }

  const linkHost = new URL(url).hostname.toLowerCase();
  const apiHosts = ['commons.wikimedia.org'];
  if (linkHost.endsWith('wikipedia.org')) {
    apiHosts.push(linkHost.replace(/^([a-z-]+)\.m\./, '$1.'));
  }

  let info: WikimediaImageInfo | null = null;
  for (const apiHost of apiHosts) {
    info = await fetchWikimediaImageInfo(apiHost, title).catch(() => null);
    if (info) {
      break;
    }
  }

  if (!info) {
    return { success: false, message: 'Could not find that file on Wikimedia.' };
  }

  const extension = EXTENSION_BY_MIME[info.mime];
  if (!extension) {
    return { success: false, message: 'That Wikimedia file is not an image.' };
  }
  if (info.size > MAX_FLAG_IMAGE_BYTES) {
    return { success: false, message: 'Image is too large (4 MB max).' };
  }

  const imageResponse = await fetch(info.url, {
    headers: { 'User-Agent': WIKIMEDIA_USER_AGENT },
  });
  if (!imageResponse.ok) {
    return { success: false, message: 'Could not download the Wikimedia image.' };
  }

  const key = `images/${crypto.randomUUID()}.${extension}`;
  await uploadFile(
    Buffer.from(await imageResponse.arrayBuffer()),
    process.env.S3_BUCKET_NAME!,
    key,
    info.mime,
  );

  const fileName = title.replace(/^File:/, '');
  return {
    success: true,
    name: flagNameFromFileName(fileName),
    fileName,
    imageUrl: `${CLOUD_FRONT_URL}/${key}`,
    source: info.descriptionurl,
  };
}

export type ExistingFlagMatch = {
  key: string;
  name: string;
  status: 'live' | 'pending';
};

/**
 * Finds flags that already exist (or are waiting for review) with the same
 * name or the same source link as any of the candidates.
 */
export async function findExistingFlags(
  candidates: Array<{ key: string; name: string; sources: string[] }>,
): Promise<ExistingFlagMatch[]> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return [];
  }

  const named = candidates.filter((candidate) => candidate.name.trim());
  if (named.length === 0) {
    return [];
  }

  // Prefilter in SQL on lowercase names without a leading "the"; exact
  // comparison (accents, dashes) happens below.
  const lowerNames = Array.from(
    new Set(
      named.map((candidate) =>
        candidate.name.trim().toLowerCase().replace(/^the\s+/, ''),
      ),
    ),
  );
  const sourceUrls = Array.from(
    new Set(named.flatMap((candidate) => candidate.sources)),
  ).filter((source) => /wikimedia\.org|wikipedia\.org/i.test(source));

  const lowerNameList = sql.join(
    lowerNames.map((name) => sql`${name}`),
    sql`, `,
  );

  const [liveFlags, pendingRequests] = await Promise.all([
    db
      .select({ name: flags.name, sources: flags.sources })
      .from(flags)
      .where(
        or(
          sql`lower(regexp_replace(${flags.name}, '^the\\s+', '', 'i')) in (${lowerNameList})`,
          sourceUrls.length > 0
            ? sql`${flags.sources} && array[${sql.join(
                sourceUrls.map((source) => sql`${source}`),
                sql`, `,
              )}]::text[]`
            : undefined,
        ),
      ),
    db
      .select({ flag: flagRequests.flag })
      .from(flagRequests)
      .where(
        and(
          eq(flagRequests.approved, false),
          eq(flagRequests.deleted, false),
          eq(flagRequests.isEdit, false),
          inArray(
            sql`lower(regexp_replace(${flagRequests.flag}->>'flagName', '^the\\s+', '', 'i'))`,
            lowerNames,
          ),
        ),
      ),
  ]);

  const matches: ExistingFlagMatch[] = [];
  for (const candidate of named) {
    const normalizedName = normalizeFlagNameForComparison(candidate.name);
    const live = liveFlags.find(
      (flag) =>
        normalizeFlagNameForComparison(flag.name) === normalizedName ||
        flag.sources.some((source) => candidate.sources.includes(source)),
    );
    if (live) {
      matches.push({ key: candidate.key, name: live.name, status: 'live' });
      continue;
    }

    const pending = pendingRequests.find(
      (request) =>
        normalizeFlagNameForComparison(request.flag.flagName) === normalizedName,
    );
    if (pending) {
      matches.push({
        key: candidate.key,
        name: pending.flag.flagName,
        status: 'pending',
      });
    }
  }

  return matches;
}
