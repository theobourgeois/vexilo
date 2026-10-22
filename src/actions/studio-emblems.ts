'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { flagEmblems } from '@/db/schema';
import { CLOUD_FRONT_URL } from '@/lib/constant';

const MAX_SVG_BYTES = 6_000_000;

/**
 * An emblem's source SVG, for turning it into shapes. Fetched here because the CDN sends no
 * CORS headers; null when the emblem has none or it can't be loaded.
 */
export async function getEmblemSvg(id: string): Promise<string | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [emblem] = await db.select({ svg: flagEmblems.svg }).from(flagEmblems).where(eq(flagEmblems.id, id)).limit(1);
  if (!emblem?.svg) return null;
  const url = new URL(emblem.svg);
  if (url.protocol !== 'https:' || url.hostname !== new URL(CLOUD_FRONT_URL).hostname) return null;
  const response = await fetch(url, { cache: 'force-cache' }).catch(() => null);
  if (!response?.ok || Number(response.headers.get('content-length') ?? 0) > MAX_SVG_BYTES) return null;
  const text = await response.text();
  return text.length > MAX_SVG_BYTES ? null : text;
}
