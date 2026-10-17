import sharp from 'sharp';
import { redis } from '@/db/redis';

export type PaletteColor = {
  hex: string;
  name: string;
  /** Fraction of the flag's opaque area, 0–1. */
  share: number;
};

const CACHE_PREFIX = 'flag-palette-v1:';
const CACHE_SECONDS = 60 * 60 * 24 * 30;
const FAILURE_CACHE_SECONDS = 60 * 60 * 24;
const SAMPLE_SIZE = 240;
/** Colours closer than this (CIE76 ΔE) count as one, which absorbs shading and anti-aliasing. */
const MERGE_DISTANCE = 16;
const MIN_SHARE = 0.006;
/** A small colour this close to the line between two bigger ones is an anti-aliased edge between them. */
const BLEND_DISTANCE = 12;
const MAX_COLORS = 6;

type Lab = [number, number, number];

function srgbToLinear(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function distance(a: Lab, b: Lab) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

const NAMED_COLORS = Object.entries({
  White: '#FFFFFF',
  Cream: '#EFE3B8',
  Silver: '#BFC1C2',
  Grey: '#7D7F82',
  Black: '#111111',
  Red: '#D21F26',
  Crimson: '#B22234',
  'Dark red': '#9B1B24',
  Maroon: '#6E1A26',
  Pink: '#F2A2B8',
  Magenta: '#C0007A',
  Orange: '#F07C1B',
  Saffron: '#FF9933',
  Gold: '#C9A13B',
  Yellow: '#FCD116',
  Tan: '#C8A97E',
  Brown: '#7A4B26',
  'Light green': '#7CC242',
  Green: '#14904A',
  'Dark green': '#1F4B2C',
  Olive: '#6B7A2A',
  Teal: '#0B7A75',
  Turquoise: '#3FC1C9',
  'Sky blue': '#75AADB',
  'Steel blue': '#41637A',
  Blue: '#1F4FB4',
  'Royal blue': '#2B3990',
  Navy: '#14285C',
  Purple: '#6A2C8F',
  Lavender: '#B39DDB',
}).map(([name, hex]) => ({ name, lab: rgbToLab(...hexToRgb(hex)) }));

/** Distance from p to segment ab, and where along it (0–1) p falls. */
function segmentDistance(p: Lab, a: Lab, b: Lab) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const lengthSq = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  if (lengthSq === 0) return { distance: distance(p, a), t: 0 };
  const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / lengthSq));
  return { distance: distance(p, [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]]), t };
}

function nameColor(lab: Lab) {
  let best = NAMED_COLORS[0];
  for (const candidate of NAMED_COLORS) {
    if (distance(lab, candidate.lab) < distance(lab, best.lab)) best = candidate;
  }
  return best.name;
}

/** `seed` is the cluster's most common colour, which is the exact painted colour on flat flags. */
type Cluster = { count: number; r: number; g: number; b: number; lab: Lab; seed: [number, number, number] };

/** Reads the colours actually painted on a flag image, with how much of the flag each covers. */
export async function extractPalette(image: Buffer): Promise<PaletteColor[]> {
  const { data, info } = await sharp(image, { density: 96 })
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'inside', kernel: 'nearest' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Bucket pixels at 5 bits per channel, skipping transparent areas (pennants, Nepal).
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
    opaque++;
  }
  if (opaque === 0) return [];

  // Merge buckets into clusters, most common first, so each cluster is seeded by its main colour.
  const clusters: Cluster[] = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b.count - a.count)) {
    const lab = rgbToLab(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count);
    const match = clusters.find((cluster) => distance(cluster.lab, lab) < MERGE_DISTANCE);
    if (match) {
      match.count += bucket.count;
      match.r += bucket.r;
      match.g += bucket.g;
      match.b += bucket.b;
    } else {
      clusters.push({ ...bucket, lab, seed: [bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count] });
    }
  }

  // Fold anti-aliasing blends (e.g. pink where red meets white) into the colours they sit between.
  const merge = (into: Cluster, from: Cluster) => {
    into.count += from.count;
    into.r += from.r;
    into.g += from.g;
    into.b += from.b;
  };
  for (let i = clusters.length - 1; i >= 0; i--) {
    const blend = clusters[i];
    if (blend.count / opaque > 0.08) continue;
    const parents = clusters.slice(0, i).filter((cluster) => cluster.count > blend.count * 2);
    let found: Cluster | null = null;
    for (let a = 0; a < parents.length && !found; a++) {
      for (let b = a + 1; b < parents.length && !found; b++) {
        const { distance: d, t } = segmentDistance(blend.lab, parents[a].lab, parents[b].lab);
        if (d < BLEND_DISTANCE && t > 0.1 && t < 0.9) found = t < 0.5 ? parents[a] : parents[b];
      }
    }
    if (found) {
      merge(found, blend);
      clusters.splice(i, 1);
    }
  }

  // Clusters that land on the same name read as duplicates, so combine them.
  const byName = new Map<string, PaletteColor>();
  for (const cluster of clusters.sort((a, b) => b.count - a.count)) {
    const name = nameColor(cluster.lab);
    const existing = byName.get(name);
    if (existing) existing.share += cluster.count / opaque;
    else byName.set(name, { hex: toHex(...cluster.seed), name, share: cluster.count / opaque });
  }

  return [...byName.values()]
    .filter((color) => color.share >= MIN_SHARE)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_COLORS);
}

/** Cached palette for a flag image URL; empty when the image can't be read. */
export async function getFlagPalette(imageUrl: string): Promise<PaletteColor[]> {
  const key = CACHE_PREFIX + imageUrl;
  const cached = await redis.get<PaletteColor[]>(key).catch(() => null);
  if (cached) return cached;

  let palette: PaletteColor[] = [];
  try {
    const response = await fetch(imageUrl, {
      // Wikimedia rejects requests without a descriptive user agent.
      headers: { 'User-Agent': 'Vexilo/1.0 (https://vexilo.org)' },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) palette = await extractPalette(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(`[flag-palette] Could not read ${imageUrl}:`, error);
  }

  await redis
    .set(key, palette, { ex: palette.length > 0 ? CACHE_SECONDS : FAILURE_CACHE_SECONDS })
    .catch(() => null);
  return palette;
}
