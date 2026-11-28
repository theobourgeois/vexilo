import { NextResponse } from 'next/server';
import { isLocalStorage, readLocalFile } from '@/lib/storage/local-storage';

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

/** Serves files the local upload sandbox stored. Only exists in local development. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!isLocalStorage()) return new NextResponse(null, { status: 404 });
  const key = (await params).key.join('/');
  const body = await readLocalFile(key).catch(() => null);
  if (!body) return new NextResponse(null, { status: 404 });
  const type = TYPES[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      // Uploaded SVGs are sanitized, but never let one run script on this origin.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
