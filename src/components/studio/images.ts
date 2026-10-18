'use client';

import React from 'react';
import type { FlagRecolorer } from '@/lib/flag-recolor';
import { isCutoutKey, renderCutout } from './cutout';

/** Images go through the texture route so their pixels can be read (and embedded on export). */
export const proxied = (src: string) =>
  /^(blob:|data:|\/)/.test(src) ? src : `/api/flag-texture?src=${encodeURIComponent(src)}`;

/** Cutouts are cut once and then treated like any other image. */
const cutouts = new Map<string, Promise<string>>();
const cutoutUrls = new Map<string, string>();
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

/** A same-origin URL for an image key: an emblem or flag through the proxy, or a cutout's blob. */
function baseUrl(src: string): Promise<string> {
  if (!isCutoutKey(src)) return Promise.resolve(proxied(src));
  let pending = cutouts.get(src);
  if (!pending) {
    pending = renderCutout(src, proxied).then((url) => (cutoutUrls.set(src, url), url));
    pending.catch(() => cutouts.delete(src));
    cutouts.set(src, pending);
  }
  return pending;
}

/** The base image if it's ready now, for a first paint without waiting. */
const baseUrlNow = (src: string) => (isCutoutKey(src) ? (cutoutUrls.get(src) ?? BLANK) : proxied(src));

const recolorers = new Map<string, Promise<FlagRecolorer>>();
const outputs = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const MAX_OUTPUTS = 80;
/** Blob URLs something is showing right now, which mustn't be revoked from under it. */
const showing = new Map<string, number>();

function getRecolorer(src: string, palette: string[]) {
  const key = `${src}|${palette.join(',')}`;
  let recolorer = recolorers.get(key);
  if (!recolorer) {
    recolorer = Promise.all([import('@/lib/flag-recolor'), baseUrl(src)]).then(([{ createFlagRecolorer }, url]) =>
      createFlagRecolorer(url, palette, { snapPalette: true }),
    );
    recolorer.catch(() => recolorers.delete(key));
    recolorers.set(key, recolorer);
  }
  return recolorer;
}

const unchanged = (palette: string[], colors: string[]) =>
  colors.every((color, i) => color.toUpperCase() === palette[i]?.toUpperCase());

const outputKey = (src: string, palette: string[], colors: string[]) => `${src}|${palette.join(',')}|${colors.join(',')}`;

let canvas: HTMLCanvasElement | null = null;

/**
 * The image with palette colour i painted as colors[i]; a blob URL, cached. `src` is an image
 * key: an image URL, or a cutout's (see `layerImage`).
 */
export function recolor(src: string, palette: string[], colors: string[]): Promise<string> {
  if (unchanged(palette, colors)) return baseUrl(src);
  const key = outputKey(src, palette, colors);
  const cached = outputs.get(key);
  if (cached) {
    outputs.delete(key);
    outputs.set(key, cached);
    return Promise.resolve(cached);
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  const work = getRecolorer(src, palette)
    .then(async (recolorer) => {
      canvas ??= document.createElement('canvas');
      canvas.width = recolorer.width;
      canvas.height = recolorer.height;
      canvas.getContext('2d')?.putImageData(recolorer.render(colors), 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not encode image');
      const url = URL.createObjectURL(blob);
      outputs.set(key, url);
      for (const [oldKey, oldUrl] of outputs) {
        if (outputs.size <= MAX_OUTPUTS) break;
        if (showing.has(oldUrl)) continue;
        outputs.delete(oldKey);
        URL.revokeObjectURL(oldUrl);
      }
      return url;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}

/**
 * Live recoloured URL; shows the last good image while a new one renders. Renders one at a
 * time and skips straight to the newest colours, so dragging through a picker never queues
 * up a backlog of stale repaints.
 */
export function useRecolored(src: string, palette: string[], colors: string[]) {
  const key = outputKey(src, palette, colors);
  const [url, setUrl] = React.useState(() =>
    unchanged(palette, colors) ? baseUrlNow(src) : (outputs.get(key) ?? baseUrlNow(src)),
  );
  const wanted = React.useRef({ key, src, palette, colors });
  wanted.current = { key, src, palette, colors };
  const busy = React.useRef(false);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    if (busy.current) return;
    busy.current = true;
    (async () => {
      let job = wanted.current;
      for (;;) {
        try {
          const next = await recolor(job.src, job.palette, job.colors);
          if (!mounted.current) break;
          setUrl(next);
        } catch {
          // Keep showing the last good image.
        }
        if (wanted.current.key === job.key) break;
        job = wanted.current;
      }
      busy.current = false;
    })();
  }, [key]);

  React.useEffect(() => {
    // Read the image ahead of time, so the first colour change is as quick as the rest.
    const warm = () => getRecolorer(src, palette).catch(() => undefined);
    const idle = window.requestIdleCallback?.(warm, { timeout: 1500 });
    const timer = idle === undefined ? window.setTimeout(warm, 300) : undefined;
    return () => {
      mounted.current = false;
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per image
  }, []);

  React.useEffect(() => {
    showing.set(url, (showing.get(url) ?? 0) + 1);
    return () => {
      const count = (showing.get(url) ?? 1) - 1;
      if (count > 0) showing.set(url, count);
      else showing.delete(url);
    };
  }, [url]);
  return url;
}

const dataUrls = new Map<string, Promise<string>>();

/** Inlines an image for export, where SVGs can't load anything external. */
export function toDataUrl(url: string) {
  if (url.startsWith('data:')) return Promise.resolve(url);
  let pending = dataUrls.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${url}`);
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      );
    pending.catch(() => dataUrls.delete(url));
    dataUrls.set(url, pending);
  }
  return pending;
}
