import { getStudioEmblems } from '@/lib/studio-data';

// Read on request so the build doesn't need the database; the CDN keeps the response instead.
export const dynamic = 'force-dynamic';

/**
 * The flag maker's emblem library. It's the same for everyone and large, so it's fetched by the
 * browser once and kept by Vercel's CDN rather than sent inside every /create page.
 */
export async function GET() {
  return Response.json(await getStudioEmblems(), {
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
