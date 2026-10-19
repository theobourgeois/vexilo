'use client';

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { StudioDesign } from '@/lib/studio-design';
import { studioDesignSchema } from '@/lib/studio-design-schema';
import { FlagArt } from './FlagArt';
import { layerImage } from './cutout';
import { recolor, toDataUrl } from './images';
import { flagWidth, type StudioDoc } from './model';

/** A standalone SVG of the design, with every image embedded. */
export async function designToSvg(design: StudioDesign, width = 1200) {
  const layers: Record<string, string> = {};
  await Promise.all(
    design.layers
      .filter((layer) => !layer.hidden)
      .map(async (layer) => {
        layers[layer.id] = await toDataUrl(await recolor(layerImage(layer), layer.palette, layer.colors));
      }),
  );
  const field =
    design.field.kind === 'image'
      ? await toDataUrl(await recolor(design.field.src, design.field.palette, design.field.colors))
      : undefined;

  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => {
    root.render(<FlagArt design={design} hrefs={{ field, layers }} width={width} height={Math.round(width / flagWidth(design))} />);
  });
  const svg = container.innerHTML;
  root.unmount();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}

export async function designToPng(design: StudioDesign, width = 2000): Promise<Blob> {
  const height = Math.round(width / flagWidth(design));
  const svg = await designToSvg(design, width);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not render the flag');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileName = (name: string) => name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'flag';

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

/** A design packed into a URL-safe string, for share links. */
export async function encodeDoc(doc: StudioDoc) {
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(doc)), new CompressionStream('deflate-raw')));
}

export async function decodeDoc(value: string): Promise<StudioDoc | null> {
  try {
    const json = JSON.parse(new TextDecoder().decode(await pipe(fromBase64Url(value), new DecompressionStream('deflate-raw'))));
    const design = studioDesignSchema.safeParse(json?.design);
    if (!design.success || typeof json.name !== 'string') return null;
    return { name: json.name.slice(0, 120), design: design.data };
  } catch {
    return null;
  }
}
