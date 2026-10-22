'use client';

import { useSession } from 'next-auth/react';
import { openSignIn } from '@/lib/sign-in';
import { toast } from 'sonner';
import { uploadStudioImage } from '@/actions/studio';
import { loadImage } from './cutout';
import { isSvgFile, MAX_LAYERS, readSvg, SvgImportError, SvgTooDetailedError } from './import-svg';
import type { StudioEmblem } from './model';
import type { Studio } from './use-studio';

const MAX_SIZE = 1024;
/** Server actions take about a megabyte; leave room for the rest of the request. */
const MAX_DATA_URL = 950_000;
/** RGB distance within which a pixel is the image's plain background. */
const BACKGROUND_DISTANCE = 40;
const EDGE_DISTANCE = 110;

/**
 * Gets an image ready to become a layer: a plain background (a logo on white, say) is cut
 * away from the edges in, the rest trimmed to its content, and the result encoded small
 * enough to upload. Images that already have transparency, or have no plain background
 * (photos), are kept as they are.
 */
export async function prepareImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  const img = await loadImage(objectUrl).finally(() => URL.revokeObjectURL(objectUrl));
  const k = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  removeBackground(image.data, w, h);
  ctx.putImageData(image, 0, 0);

  // Trim to what's left.
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (image.data[(y * w + x) * 4 + 3] > 10) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) throw new Error('Empty image');
  const pad = 2;
  [x0, y0, x1, y1] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(w - 1, x1 + pad), Math.min(h - 1, y1 + pad)];

  for (const scale of [1, 0.75, 0.5, 0.35]) {
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round((x1 - x0 + 1) * scale));
    out.height = Math.max(1, Math.round((y1 - y0 + 1) * scale));
    out.getContext('2d')!.drawImage(canvas, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, out.width, out.height);
    const dataUrl = out.toDataURL('image/webp', 0.92);
    if (dataUrl.length <= MAX_DATA_URL) return dataUrl;
  }
  throw new Error('Image too large');
}

function removeBackground(px: Uint8ClampedArray, w: number, h: number) {
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  if (border.filter((p) => px[p * 4 + 3] < 128).length > border.length * 0.02) return;

  // The background is the colour most of the border shares.
  const median = [0, 1, 2].map((c) => border.map((p) => px[p * 4 + c]).sort((a, b) => a - b)[border.length >> 1]);
  const far = (p: number) => Math.hypot(px[p * 4] - median[0], px[p * 4 + 1] - median[1], px[p * 4 + 2] - median[2]);
  if (border.filter((p) => far(p) < BACKGROUND_DISTANCE).length < border.length * 0.6) return;

  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const visit = (p: number) => {
    if (!outside[p] && far(p) < BACKGROUND_DISTANCE) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  border.forEach(visit);
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (p >= w) visit(p - w);
    if (p < w * (h - 1)) visit(p + w);
  }
  let cleared = 0;
  for (let p = 0; p < w * h; p++) cleared += outside[p];
  if (cleared > w * h * 0.97) return;

  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (outside[p]) {
      px[i + 3] = 0;
      continue;
    }
    // Anti-aliased edges are part background: fade them and take the background back out.
    const x = p % w;
    const touches = (x > 0 && outside[p - 1]) || (x < w - 1 && outside[p + 1]) || (p >= w && outside[p - w]) || (p < w * (h - 1) && outside[p + w]);
    const d = far(p);
    if (!touches || d >= EDGE_DISTANCE) continue;
    const alpha = Math.max(0.05, (d - BACKGROUND_DISTANCE / 2) / (EDGE_DISTANCE - BACKGROUND_DISTANCE / 2));
    for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, (px[i + c] - (1 - alpha) * median[c]) / alpha));
    px[i + 3] = Math.round(px[i + 3] * alpha);
  }
}

const nameOf = (file: File, fallback: string) => file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 40) || fallback;

/**
 * Turns dropped, pasted or picked image files into layers. SVGs come in as shapes that can be
 * recoloured and edited; other images are uploaded. Returns whether there were any images.
 */
export function useImageImport(studio: Studio) {
  const { data: session } = useSession();
  return async (files: Iterable<File>, at?: { x: number; y: number }) => {
    const all = [...files].filter((file) => file.type.startsWith('image/') || isSvgFile(file)).slice(0, 4);
    if (all.length === 0) return false;
    // Several at once fan out a little instead of stacking.
    const spot = (i: number) => at && { x: at.x + i * 0.04, y: at.y + i * 0.04 };
    const images: File[] = [];
    let used = studio.design.layers.length;
    for (const [i, file] of all.entries()) {
      if (!isSvgFile(file)) {
        images.push(file);
        continue;
      }
      const id = toast.loading('Adding SVG');
      try {
        const name = nameOf(file, 'SVG');
        const result = await readSvg(await file.text(), { name, W: studio.W, at: spot(i), budget: MAX_LAYERS - used });
        studio.actions.addLayers(result.layers, result.group ? [result.group] : []);
        used += result.layers.length;
        const left = [result.skipped.text && 'text', result.skipped.images && 'pictures'].filter(Boolean);
        if (left.length) toast(`Added ${name} without its ${left.join(' or ')}`, { id, description: 'Only shapes can come in from an SVG.' });
        else toast.dismiss(id);
      } catch (error) {
        if (error instanceof SvgTooDetailedError) {
          // Still worth having, just not part by part.
          toast(error.message, { id, description: 'Adding it as an image instead.' });
          images.push(file);
        } else toast.error(error instanceof SvgImportError ? error.message : 'Couldn’t read that SVG', { id });
      }
    }
    if (images.length === 0) return true;
    if (!session?.user) {
      toast('Sign in to use your own images', { action: { label: 'Sign in', onClick: () => openSignIn() } });
      return true;
    }
    for (const [i, file] of images.entries()) {
      const id = toast.loading('Adding image');
      try {
        const result = await uploadStudioImage(await prepareImage(file));
        if (!result.success) {
          toast.error(result.message, { id });
          continue;
        }
        const emblem: StudioEmblem = {
          id: 'upload',
          name: nameOf(file, 'Image'),
          names: [],
          collection: 'upload',
          src: result.url,
          aspect: result.aspect,
          colors: result.colors,
          copies: 1,
        };
        studio.actions.addEmblem(emblem, spot(i));
        toast.dismiss(id);
      } catch {
        toast.error('Couldn’t read that image', { id });
      }
    }
    return true;
  };
}
