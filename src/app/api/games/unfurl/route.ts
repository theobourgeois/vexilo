import { getUnfurlPuzzle } from '@/actions/games';
import { rasterizeFlag } from '@/lib/flag-texture';
import { COUNTRY_BY_ID } from '@/lib/games/pool';
import { NextResponse } from 'next/server';

// Today's flag by date, so the answer's name isn't sitting in the image URL.
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date') ?? '';
  const puzzle = await getUnfurlPuzzle(date).catch(() => null);
  const country = puzzle && COUNTRY_BY_ID.get(puzzle.answerId);
  if (!country) return NextResponse.json({ message: 'No puzzle for that date.' }, { status: 404 });
  return rasterizeFlag(country.image, 'public, max-age=86400');
}
