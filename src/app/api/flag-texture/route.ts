import { rasterizeFlag } from '@/lib/flag-texture';

export async function GET(request: Request) {
  return rasterizeFlag(new URL(request.url).searchParams.get('src') ?? '');
}
