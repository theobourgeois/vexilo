import { sanitizeSvg } from '@/lib/svg-sanitize';

export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

/** An upload that isn't an image we can serve safely; its message is fit to show the user. */
export class UnsafeImageError extends Error {}

/** What's stored for an upload: SVGs are rebuilt without anything active, and only images get in. */
export function safeImageBody(file: string | Buffer, contentType: string) {
  if (!IMAGE_EXTENSIONS[contentType]) {
    throw new UnsafeImageError("That file type isn't supported.");
  }
  if (contentType !== 'image/svg+xml') return file;
  const svg = sanitizeSvg(file.toString());
  if (!svg) throw new UnsafeImageError("That file isn't a valid SVG.");
  return Buffer.from(svg);
}
