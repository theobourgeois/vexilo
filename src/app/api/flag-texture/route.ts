import { MAX_FLAG_IMAGE_BYTES } from '@/lib/batch-flags';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

// WebGL can only sample same-origin or CORS-enabled images, and our CDN sends no CORS
// headers. This rasterizes a flag from a known host into a PNG the waving flag can use.
const ALLOWED_HOSTS = new Set([
  new URL(CLOUD_FRONT_URL).hostname,
  'upload.wikimedia.org',
  'flagcdn.com',
  'static.wikitide.net',
]);

const MAX_SIZE = 2048;

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src') ?? '';
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return NextResponse.json({ message: 'Invalid image URL.' }, { status: 400 });
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return NextResponse.json({ message: 'Unsupported image host.' }, { status: 400 });
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'VexiloBot/1.0 (https://vexilo.org)' },
  }).catch(() => null);
  if (!response?.ok) {
    return NextResponse.json({ message: 'Could not load the image.' }, { status: 502 });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_FLAG_IMAGE_BYTES) {
    return NextResponse.json({ message: 'Image is too large.' }, { status: 413 });
  }

  try {
    // A high density keeps SVG edges crisp before downscaling to the texture size.
    const png = await sharp(buffer, { density: 300 })
      .resize({ width: MAX_SIZE, height: MAX_SIZE, fit: 'inside' })
      .png()
      .toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Unsupported image.' }, { status: 415 });
  }
}
