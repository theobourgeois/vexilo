import sharp from 'sharp';
import {
  defaultParams,
  LAYOUT_VARIANTS,
  LAYOUTS,
} from '../../src/components/studio/layouts';
import type { LayoutId, StudioDesignV1 } from '../../src/lib/studio-design';

/** Independent from the SVG extractor: changing this never invalidates the SVG backfill. */
export const RASTER_VERSION = 2;
const SAMPLE = 240;
const MAX_SIDE = 1600;
const MIN_DISTANCE = 24;
const MAX_MISMATCH = 0.015;
type Box = [number, number, number, number];
type RGB = [number, number, number];
type Component = { pixels: number[]; box: Box; core: number };
export type RasterPart = { png: Buffer; box: Box; palette: string[] };
export type RasterResult = {
  width: number;
  height: number;
  original: Buffer;
  field: Buffer;
  rebuilt: Buffer;
  fit:
    | Extract<StudioDesignV1['field'], { kind: 'layout' }>
    | Omit<Extract<StudioDesignV1['field'], { kind: 'image' }>, 'src'>;
  parts: RasterPart[];
  mismatch: number;
  meanError: number;
  fieldShare: number;
};
const distance = (
  a: ArrayLike<number>,
  ai: number,
  b: ArrayLike<number>,
  bi: number,
) => Math.hypot(a[ai] - b[bi], a[ai + 1] - b[bi + 1], a[ai + 2] - b[bi + 2]);
const rgbColor = (color: string): RGB =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as RGB;
const hex = (rgb: RGB) =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

function svg(
  width: number,
  height: number,
  layout: LayoutId,
  params: Record<string, number>,
  colors: string[],
) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width / height} 1">${LAYOUTS[
      layout
    ]
      .shapes(width / height, { ...defaultParams(layout), ...params })
      .map((s) => `<path fill="${colors[s.slot]}" d="${s.d}"/>`)
      .join('')}</svg>`,
  );
}

/** Modes resist emblems and JPEG fringes; medians can invent a colour between two regions. */
function dominant(pixels: Buffer, indices: number[]): RGB {
  const bins = new Map<number, number[]>();
  for (const p of indices) {
    const i = p * 4;
    const key =
      (pixels[i] >> 4) * 256 + (pixels[i + 1] >> 4) * 16 + (pixels[i + 2] >> 4);
    const bin = bins.get(key) ?? [0, 0, 0, 0];
    bin[0]++;
    for (let c = 0; c < 3; c++) bin[c + 1] += pixels[i + c];
    bins.set(key, bin);
  }
  const best = [...bins.values()].sort((a, b) => b[0] - a[0])[0];
  return best
    ? (best.slice(1).map((v) => Math.round(v / best[0])) as RGB)
    : [0, 0, 0];
}

function modeColor(colors: RGB[]): RGB {
  const bins = new Map<number, number[]>();
  for (const color of colors) {
    const key = (color[0] >> 4) * 256 + (color[1] >> 4) * 16 + (color[2] >> 4);
    const bin = bins.get(key) ?? [0, 0, 0, 0];
    bin[0]++;
    for (let c = 0; c < 3; c++) bin[c + 1] += color[c];
    bins.set(key, bin);
  }
  const best = [...bins.values()].sort((a, b) => b[0] - a[0])[0];
  return best.slice(1).map((v) => Math.round(v / best[0])) as RGB;
}

/**
 * Share of the perimeter that disagrees with a field. A canton (Union Jack, stars) legitimately
 * covers one corner of the edge, so a fit that is clean everywhere else is nearly as good.
 */
function edgeMismatch(cornerOff: number[], cornerCount: number[]) {
  const sum = (a: number[]) => a.reduce((n, v) => n + v, 0);
  const all = sum(cornerOff) / (sum(cornerCount) || 1);
  const canton = Math.min(
    ...[0, 1, 2, 3].map(
      (q) =>
        (sum(cornerOff) - cornerOff[q]) /
        (sum(cornerCount) - cornerCount[q] || 1),
    ),
  );
  return all <= 0.35 && canton <= 0.02 ? Math.min(all, canton + 0.03) : all;
}

/**
 * Scans and exports often add a thin frame, a light antialias line or a half-transparent row at
 * the edge. Measure it per side so it can be cropped before the field is fitted.
 */
function frameDepths(pixels: Buffer, w: number, h: number) {
  const max = Math.max(2, Math.round(Math.min(w, h) * 0.015));
  const at = (x: number, y: number) => (y * w + x) * 4;
  const sides: [number, (t: number, k: number) => number][] = [
    [w, (t, k) => at(t, k)],
    [w, (t, k) => at(t, h - 1 - k)],
    [h, (t, k) => at(k, t)],
    [h, (t, k) => at(w - 1 - k, t)],
  ];
  return sides.map(([n, pixel]) => {
    let depth = 0;
    for (let k = 0; k < max; k++) {
      let differ = 0;
      for (let t = 0; t < n; t++) {
        const i = pixel(t, k);
        if (
          pixels[i + 3] < 240 ||
          // Inside a frame, JPEG ringing tints the next line or two.
          distance(pixels, i, pixels, pixel(t, max + 1)) > (depth ? 20 : 40)
        )
          differ++;
      }
      if (differ < n * 0.5) break;
      depth = k + 1;
    }
    return depth;
  }) as [number, number, number, number];
}

/** Fit the field using both the whole image and its perimeter, so central badges remain objects. */
async function fitField(pixels: Buffer, w: number, h: number) {
  let best = null as {
    fit: Extract<StudioDesignV1['field'], { kind: 'layout' }>;
    score: number;
    off: number;
    borderOff: number;
  } | null;
  for (const layout of Object.keys(LAYOUTS) as LayoutId[]) {
    // A disc is usually an emblem. Treating it as field makes it impossible to select.
    if (layout === 'disc') continue;
    const variants = [...(LAYOUT_VARIANTS[layout] ?? [{}])];
    if (layout === 'saltire')
      for (const width of [
        0.12, 0.14, 0.16, 0.18, 0.22, 0.24, 0.28, 0.3, 0.32, 0.36, 0.4,
      ])
        variants.push({ width });
    if (layout === 'stars-stripes')
      for (const count of [7, 9, 11, 13])
        for (const width of [0.333, 0.4, 0.5])
          variants.push({ count, width, height: 1 });
    for (const params of variants) await score(layout, params);
  }
  if (!best) throw new Error('No reliable field');
  // Presets are coarse: a hoist triangle 1% too shallow leaves seams that swallow nearby stars.
  for (const step of [0.02, 0.01, 0.005, 0.0025, 0.00125])
    for (let improved = true; improved;) {
      improved = false;
      const { layout, params } = best.fit;
      for (const key of Object.keys(params)) {
        if (key === 'count') continue;
        for (const sign of [-1, 1]) {
          const value = params[key] + sign * step;
          if (value <= 0.01) continue;
          if (await score(layout, { ...params, [key]: value })) improved = true;
        }
      }
    }
  async function score(layout: LayoutId, params: Record<string, number>) {
    const n = LAYOUTS[layout].slots.length;
    const labels = Array.from({ length: n }, (_, i) =>
      hex([i * 30 + 10, 0, 0]),
    );
    const label = await sharp(svg(w, h, layout, params, labels))
      .ensureAlpha()
      .raw()
      .toBuffer();
    const slots = new Int8Array(w * h).fill(-1);
    const buckets: number[][] = Array.from({ length: n }, () => []);
    for (let p = 0; p < w * h; p++) {
      const slot = Math.round((label[p * 4] - 10) / 30);
      if (
        slot < 0 ||
        slot >= n ||
        Math.abs(label[p * 4] - (slot * 30 + 10)) > 2
      )
        continue;
      slots[p] = slot;
      buckets[slot].push(p);
    }
    if (buckets.some((b) => b.length < w * h * 0.005)) return false;
    const medians = buckets.map((b) => dominant(pixels, b));
    let off = 0,
      count = 0;
    const cornerOff = [0, 0, 0, 0],
      cornerCount = [0, 0, 0, 0];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x,
          slot = slots[p];
        if (slot < 0 || pixels[p * 4 + 3] < 240) continue;
        // Seams vary slightly between rasterizers; do not score those pixels.
        if ((x && slots[p - 1] !== slot) || (y && slots[p - w] !== slot))
          continue;
        const mismatch = distance(pixels, p * 4, medians[slot], 0) > 42;
        count++;
        if (mismatch) off++;
        if (x < w * 0.02 || x >= w * 0.98 || y < h * 0.02 || y >= h * 0.98) {
          const q = Number(x >= w / 2) + 2 * Number(y >= h / 2);
          cornerCount[q]++;
          if (mismatch) cornerOff[q]++;
        }
      }
    off /= count || 1;
    const borderOff = edgeMismatch(cornerOff, cornerCount);
    const score = off + borderOff * 1.8 + n * 0.003;
    if (best && score >= best.score - 1e-6) return false;
    best = {
      fit: { kind: 'layout', layout, params, colors: medians.map(hex) },
      score,
      off,
      borderOff,
    };
    return true;
  }
  if (!best) throw new Error('No reliable field');
  let custom: {
    shapes: string;
    colors: string[];
    score: number;
    off: number;
    borderOff: number;
  } | null = null;
  // Infer arbitrary straight bands from agreeing colours on opposite edges. This also handles
  // unequal bands that are absent from the editor's preset layouts. Never sample the emblem.
  for (const vertical of [false, true]) {
    const length = vertical ? w : h,
      breadth = vertical ? h : w;
    const lineColors: RGB[] = [];
    let disagree = 0;
    for (let t = 0; t < length; t++) {
      const ends = [[], []] as number[][];
      for (let u = 1; u <= Math.max(2, Math.round(breadth * 0.025)); u++) {
        ends[0].push(vertical ? u * w + t : t * w + u);
        ends[1].push(vertical ? (h - 1 - u) * w + t : t * w + w - 1 - u);
      }
      const a = dominant(pixels, ends[0]),
        b = dominant(pixels, ends[1]);
      if (distance(a, 0, b, 0) > 30) disagree++;
      lineColors.push(a.map((v, c) => Math.round((v + b[c]) / 2)) as RGB);
    }
    if (disagree > length * 0.02) continue;
    const runs: { start: number; end: number; color: RGB }[] = [];
    for (let t = 0; t < length; t++) {
      const last = runs.at(-1);
      if (last && distance(last.color, 0, lineColors[t], 0) < 30)
        last.end = t + 1;
      else runs.push({ start: t, end: t + 1, color: lineColors[t] });
    }
    // One-pixel antialiasing strips join the closest neighbouring run.
    for (let i = 0; i < runs.length; i++) {
      if (runs[i].end - runs[i].start > 2 || runs.length === 1) continue;
      const prev = runs[i - 1],
        next = runs[i + 1];
      if (
        prev &&
        (!next ||
          distance(prev.color, 0, runs[i].color, 0) <
            distance(next.color, 0, runs[i].color, 0))
      )
        prev.end = runs[i].end;
      else if (next) next.start = runs[i].start;
      runs.splice(i--, 1);
    }
    if (runs.length > 20 || runs.some((r) => r.end - r.start < 3)) continue;
    // A run starts on its seam line, which is a blend. Paint it with its interior's colour.
    for (const run of runs)
      run.color = modeColor(lineColors.slice(run.start + 1, run.end - 1));
    const expected = Buffer.alloc(w * h * 4);
    for (const run of runs)
      for (let t = run.start; t < run.end; t++)
        for (let u = 0; u < breadth; u++) {
          const i = (vertical ? u * w + t : t * w + u) * 4;
          for (let c = 0; c < 3; c++) expected[i + c] = run.color[c];
          expected[i + 3] = 255;
        }
    let off = 0;
    const cornerOff = [0, 0, 0, 0],
      cornerCount = [0, 0, 0, 0];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4,
          bad = distance(pixels, i, expected, i) > 42;
        if (bad) off++;
        if (x < w * 0.02 || x >= w * 0.98 || y < h * 0.02 || y >= h * 0.98) {
          const q = Number(x >= w / 2) + 2 * Number(y >= h / 2);
          cornerCount[q]++;
          if (bad) cornerOff[q]++;
        }
      }
    off /= w * h;
    const borderOff = edgeMismatch(cornerOff, cornerCount);
    const colors = [...new Set(runs.map((r) => hex(r.color)))];
    const score = off + borderOff * 1.8 + colors.length * 0.003 + 0.005;
    const shapes = runs
      .map((r) =>
        vertical
          ? `<path fill="${hex(r.color)}" d="M${(r.start / w) * (w / h)} 0h${((r.end - r.start) / w) * (w / h)}v1H${(r.start / w) * (w / h)}z"/>`
          : `<path fill="${hex(r.color)}" d="M0 ${r.start / h}h${w / h}v${(r.end - r.start) / h}H0z"/>`,
      )
      .join('');
    if (!custom || score < custom.score)
      custom = { shapes, colors, score, off, borderOff };
  }
  if (
    custom &&
    custom.score < best.score &&
    custom.off <= 0.45 &&
    custom.borderOff <= 0.08
  ) {
    return {
      fit: {
        kind: 'image' as const,
        palette: custom.colors.slice(0, 8),
        colors: custom.colors.slice(0, 8),
      },
      shapes: custom.shapes,
    };
  }
  if (best.off > 0.45 || best.borderOff > 0.08)
    throw new Error(
      'No reliable field: background geometry or texture needs review',
    );
  if (
    best.fit.colors.every(
      (c) => distance(rgbColor(c), 0, rgbColor(best!.fit.colors[0]), 0) < 16,
    )
  ) {
    best.fit = {
      kind: 'layout',
      layout: 'solid',
      params: {},
      colors: [
        hex(
          dominant(
            pixels,
            Array.from({ length: w * h }, (_, i) => i),
          ),
        ),
      ],
    };
  }
  return { fit: best.fit, shapes: null };
}

function components(
  mask: Uint8Array,
  strong: Uint8Array,
  w: number,
  h: number,
): Component[] {
  const seen = new Uint8Array(mask.length),
    found: Component[] = [];
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || seen[p]) continue;
    const queue = [p];
    seen[p] = 1;
    const box: Box = [w, h, 0, 0];
    let core = 0;
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i],
        x = q % w,
        y = Math.floor(q / w);
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x + 1);
      box[3] = Math.max(box[3], y + 1);
      core += strong[q];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy,
            j = ny * w + nx;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[j] && !seen[j]) {
            seen[j] = 1;
            queue.push(j);
          }
        }
    }
    // Never erode: a thin ray or laser can be only one pixel wide. Reject compression specks by support.
    if (
      core >= Math.max(2, w * h * 0.000005) &&
      queue.length >= Math.max(3, w * h * 0.000015)
    )
      found.push({ pixels: queue, box, core });
  }
  return found;
}

function groupObjects(objects: Component[], w: number, h: number) {
  const gap = h * 0.018;
  // Only merge close pieces or when actual pixels lie inside another object's box.
  for (let changed = true; changed;) {
    changed = false;
    outer: for (let i = 0; i < objects.length; i++)
      for (let j = i + 1; j < objects.length; j++) {
        const a = objects[i],
          b = objects[j];
        const dx = Math.max(0, a.box[0] - b.box[2], b.box[0] - a.box[2]);
        const dy = Math.max(0, a.box[1] - b.box[3], b.box[1] - a.box[3]);
        const inside = (o: Component, box: Box) =>
          o.pixels.filter(
            (p) =>
              p % w >= box[0] &&
              p % w < box[2] &&
              Math.floor(p / w) >= box[1] &&
              Math.floor(p / w) < box[3],
          ).length / o.pixels.length;
        const small = Math.min(a.pixels.length, b.pixels.length) < w * h * 0.02;
        const minor = Math.min(a.pixels.length, b.pixels.length) < w * h * 0.05;
        // A crest's crown or motto sits just above or below it, within its width.
        const stacked =
          minor &&
          dx === 0 &&
          dy < gap &&
          Math.min(a.box[2], b.box[2]) - Math.max(a.box[0], b.box[0]) >=
            Math.min(a.box[2] - a.box[0], b.box[2] - b.box[0]) * 0.8;
        // Words of one line of text: same height, side by side, a letter's width apart.
        const ha = a.box[3] - a.box[1],
          hb = b.box[3] - b.box[1];
        const word =
          minor &&
          Math.max(ha, hb) < h * 0.2 &&
          dy === 0 &&
          Math.max(ha, hb) < Math.min(ha, hb) * 1.4 &&
          Math.min(a.box[3], b.box[3]) - Math.max(a.box[1], b.box[1]) >
            Math.min(ha, hb) * 0.7 &&
          dx < Math.min(ha, hb) * 0.6;
        if (
          (small && Math.hypot(dx, dy) < gap) ||
          stacked ||
          word ||
          (dx === 0 &&
            dy === 0 &&
            Math.max(inside(a, b.box), inside(b, a.box)) > 0.65)
        ) {
          objects[i] = {
            pixels: [...a.pixels, ...b.pixels],
            core: a.core + b.core,
            box: [
              Math.min(a.box[0], b.box[0]),
              Math.min(a.box[1], b.box[1]),
              Math.max(a.box[2], b.box[2]),
              Math.max(a.box[3], b.box[3]),
            ],
          };
          objects.splice(j, 1);
          changed = true;
          break outer;
        }
      }
  }
  // Crumbs where a band meets the flag's edge are not emblems.
  return objects
    .filter(
      (o) =>
        o.pixels.length >= w * h * 0.0005 ||
        (o.box[0] > 0 && o.box[1] > 0 && o.box[2] < w && o.box[3] < h),
    )
    .sort((a, b) => b.pixels.length - a.pixels.length);
}

function palette(pixels: Buffer, indices: number[], fieldColors: string[]) {
  const bins = new Map<number, number[]>();
  for (const p of indices) {
    const i = p * 4,
      key =
        (pixels[i] >> 4) * 256 +
        (pixels[i + 1] >> 4) * 16 +
        (pixels[i + 2] >> 4);
    const bin = bins.get(key) ?? [0, 0, 0, 0];
    bin[0]++;
    for (let c = 0; c < 3; c++) bin[c + 1] += pixels[i + c];
    bins.set(key, bin);
  }
  const colors: RGB[] = [];
  for (const bin of [...bins.values()].sort((a, b) => b[0] - a[0])) {
    if (bin[0] < indices.length * 0.004) continue;
    const color = bin.slice(1).map((v) => Math.round(v / bin[0])) as RGB;
    // Edge mixtures are shades of the object against its old field, not extra paint slots.
    const blend = colors.some((a) =>
      [...colors, ...fieldColors.map(rgbColor)].some((b) => {
        const span = a.map((v, c) => b[c] - v),
          len = span.reduce((n, v) => n + v * v, 0);
        if (!len) return false;
        const t = span.reduce((n, v, c) => n + v * (color[c] - a[c]), 0) / len;
        return (
          t > 0.02 &&
          t < 0.98 &&
          distance(
            color,
            0,
            a.map((v, c) => v + t * span[c]),
            0,
          ) < 22
        );
      }),
    );
    if (!blend && colors.every((c) => distance(c, 0, color, 0) > 40))
      colors.push(color);
    if (colors.length === 12) break;
  }
  return colors.map(hex);
}

export async function extractRaster(source: Buffer): Promise<RasterResult> {
  const metadata = await sharp(source, {
    limitInputPixels: 250_000_000,
  }).metadata();
  if ((metadata.pages ?? 1) > 1)
    throw new Error('Animated/multipage source needs review');
  if (!['png', 'jpeg', 'gif', 'webp', 'avif'].includes(metadata.format ?? ''))
    throw new Error('Unsupported raster format');
  const { data: loaded, info: loadedInfo } = await sharp(source, {
    limitInputPixels: 250_000_000,
  })
    .rotate()
    .resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [top, bottom, left, right] = frameDepths(
    loaded,
    loadedInfo.width,
    loadedInfo.height,
  );
  const { data: pixels, info } =
    top + bottom + left + right
      ? await sharp(loaded, {
          raw: {
            width: loadedInfo.width,
            height: loadedInfo.height,
            channels: 4,
          },
        })
          .extract({
            left,
            top,
            width: loadedInfo.width - left - right,
            height: loadedInfo.height - top - bottom,
          })
          .raw()
          .toBuffer({ resolveWithObject: true })
      : { data: loaded, info: loadedInfo };
  const w = info.width,
    h = info.height,
    area = w * h;
  if (w < 32 || h < 24 || w / h > 5 || h / w > 3)
    throw new Error('Source dimensions need review');
  let transparent = 0;
  for (let p = 0; p < area; p++) if (pixels[p * 4 + 3] < 240) transparent++;
  if (transparent > area * 0.01)
    throw new Error('Nonrectangular/transparent source needs review');
  const sample = await sharp(pixels, {
    raw: { width: w, height: h, channels: 4 },
  })
    .resize(SAMPLE, Math.max(8, Math.round((SAMPLE * h) / w)))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const fitted = await fitField(
    sample.data,
    sample.info.width,
    sample.info.height,
  );
  const fit = fitted.fit;
  const fieldSvg =
    fit.kind === 'layout'
      ? svg(w, h, fit.layout, fit.params, fit.colors)
      : Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w / h} 1">${fitted.shapes}</svg>`,
        );
  const field = await sharp(fieldSvg).ensureAlpha().png().toBuffer();
  const background = await sharp(field).raw().toBuffer();
  const mask = new Uint8Array(area),
    strong = new Uint8Array(area);
  const reach = Math.max(1, Math.round(Math.max(w, h) / SAMPLE));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x,
        i = p * 4;
      let d = distance(pixels, i, background, i);
      if (d <= MIN_DISTANCE) continue;
      // JPEG ringing and slightly shifted stripe seams are field, not long thin objects.
      const near = new Set<number>();
      for (const dy of [-reach, 0, reach])
        for (const dx of [-reach, 0, reach]) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const j = (ny * w + nx) * 4;
          const key =
            (background[j] << 16) |
            (background[j + 1] << 8) |
            background[j + 2];
          near.add(key);
        }
      if (near.size > 1) {
        const colors = [...near].map((c) => [c >> 16, (c >> 8) & 255, c & 255]);
        for (const a of colors)
          for (const b of colors) {
            const span = a.map((v, c) => b[c] - v),
              len = span.reduce((s, v) => s + v * v, 0);
            const t = len
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    span.reduce(
                      (s, v, c) => s + v * (pixels[i + c] - a[c]),
                      0,
                    ) / len,
                  ),
                )
              : 0;
            d = Math.min(
              d,
              distance(
                pixels,
                i,
                a.map((v, c) => v + t * span[c]),
                0,
              ),
            );
          }
      }
      if (d > MIN_DISTANCE) mask[p] = 1;
      if (d > 48) strong[p] = 1;
    }
  const seamSliver = (o: Component) => {
    const [x0, y0, x1, y1] = o.box,
      cx = Math.floor((x0 + x1) / 2),
      cy = Math.floor((y0 + y1) / 2);
    const r = reach * 3;
    const horizontal =
      x1 - x0 > w * 0.15 &&
      y1 - y0 <= r &&
      cy >= r &&
      cy + r < h &&
      distance(
        background,
        ((cy - r) * w + cx) * 4,
        background,
        ((cy + r) * w + cx) * 4,
      ) > 40;
    const vertical =
      y1 - y0 > h * 0.15 &&
      x1 - x0 <= r &&
      cx >= r &&
      cx + r < w &&
      distance(
        background,
        (cy * w + cx - r) * 4,
        background,
        (cy * w + cx + r) * 4,
      ) > 40;
    return horizontal || vertical;
  };
  // Seams the layout fit missed by a pixel or two, widened by JPEG chroma blur (often 6-8px).
  const seamReach = Math.max(5, Math.ceil(reach * 1.5));
  const nearSeam = new Uint8Array(area);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ]) {
        const ax = x - dx * seamReach,
          ay = y - dy * seamReach,
          bx = x + dx * seamReach,
          by = y + dy * seamReach;
        const a =
            (Math.min(h - 1, Math.max(0, ay)) * w +
              Math.min(w - 1, Math.max(0, ax))) *
            4,
          b =
            (Math.min(h - 1, Math.max(0, by)) * w +
              Math.min(w - 1, Math.max(0, bx))) *
            4;
        if (
          distance(background, a, background, i) > 40 ||
          distance(background, b, background, i) > 40
        ) {
          nearSeam[y * w + x] = 1;
          break;
        }
      }
    }
  const diagonalSeam = (o: Component) => {
    const length = Math.hypot(o.box[2] - o.box[0], o.box[3] - o.box[1]);
    return (
      length >= reach * 6 &&
      o.pixels.length / length <= seamReach * 2 &&
      o.pixels.filter((p) => nearSeam[p]).length >= o.pixels.length * 0.9
    );
  };
  const objects = groupObjects(
    components(mask, strong, w, h).filter(
      (o) => !seamSliver(o) && !diagonalSeam(o),
    ),
    w,
    h,
  );
  if (objects.length > 40)
    throw new Error(
      `Too many disconnected objects (${objects.length}); needs review`,
    );
  const parts: RasterPart[] = [],
    overlays: sharp.OverlayOptions[] = [];
  for (const o of objects) {
    const [x0, y0, x1, y1] = o.box,
      ow = x1 - x0,
      oh = y1 - y0;
    // Broad residuals reaching two field edges are generally an unfitted band/panel.
    const touch = [x0 <= reach, y0 <= reach, x1 >= w - reach, y1 >= h - reach];
    const sides = touch.filter(Boolean).length;
    // A canton touches two adjacent edges; a band the fit missed touches opposite ones.
    const canton =
      sides === 2 &&
      !(touch[0] && touch[2]) &&
      !(touch[1] && touch[3]) &&
      ow * oh <= area * 0.3;
    if (
      o.pixels.length > area * 0.45 ||
      (sides >= 2 && ow * oh > area * 0.03 && !canton)
    )
      throw new Error('An object includes a field region; needs review');
    // An edge piece painted mostly in another of the field's colours is field geometry the fit
    // missed (a V-shaped field, scalloped bands), not an emblem.
    if (sides && ow * oh > area * 0.01) {
      const fieldRgb = fit.colors.map(rgbColor);
      const foreign = o.pixels.filter((p) =>
        fieldRgb.some((c) => distance(pixels, p * 4, c, 0) < 32),
      ).length;
      if (foreign > o.pixels.length * 0.6)
        throw new Error('An object is part of the field; needs review');
    }
    if (ow / oh > 50)
      throw new Error('An object is a narrow stripe artifact; needs review');
    const rgba = Buffer.alloc(ow * oh * 4);
    // A canton is a rectangle: keep it whole so moving it doesn't leave its ground behind.
    if (canton)
      for (let y = y0; y < y1; y++)
        pixels.copy(
          rgba,
          (y - y0) * ow * 4,
          (y * w + x0) * 4,
          (y * w + x1) * 4,
        );
    else
      for (const p of o.pixels) {
        const x = p % w,
          y = Math.floor(p / w),
          j = ((y - y0) * ow + x - x0) * 4;
        pixels.copy(rgba, j, p * 4, p * 4 + 4);
      }
    // Unmix the old field at the outer edge to prevent coloured halos after moving/recolouring.
    const member = new Uint8Array(area);
    for (const p of o.pixels) member[p] = 1;
    if (!canton)
      for (const p of o.pixels) {
        const x = p % w,
          y = Math.floor(p / w);
        let edge = false;
        for (let dy = -3; dy <= 3 && !edge; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if (
              nx < 0 ||
              nx >= w ||
              ny < 0 ||
              ny >= h ||
              !member[ny * w + nx]
            ) {
              edge = true;
              break;
            }
          }
        if (!edge) continue;
        const i = p * 4;
        let fg = -1,
          far = distance(pixels, i, background, i);
        for (let dy = -5; dy <= 5; dy++)
          for (let dx = -5; dx <= 5; dx++) {
            const nx = x + dx,
              ny = y + dy,
              q = ny * w + nx;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h || !member[q]) continue;
            const d = distance(pixels, q * 4, background, i);
            if (d > far * 1.05) {
              far = d;
              fg = q * 4;
            }
          }
        if (distance(pixels, i, background, i) < 48) {
          rgba[((y - y0) * ow + x - x0) * 4 + 3] = 0;
          continue;
        }
        if (fg < 0) continue;
        const span = [0, 1, 2].map((c) => pixels[fg + c] - background[i + c]);
        const len = span.reduce((s, v) => s + v * v, 0);
        const alpha = Math.max(
          0,
          Math.min(
            1,
            span.reduce(
              (s, v, c) => s + v * (pixels[i + c] - background[i + c]),
              0,
            ) / len,
          ),
        );
        // Only unmix colours actually on the line between foreground and field.
        const projected = span.map((v, c) => background[i + c] + v * alpha);
        if (distance(pixels, i, projected, 0) > 18) continue;
        const j = ((y - y0) * ow + x - x0) * 4;
        for (let c = 0; c < 3; c++) rgba[j + c] = pixels[fg + c];
        rgba[j + 3] = Math.round(alpha * pixels[i + 3]);
      }
    const png = await sharp(rgba, {
      raw: { width: ow, height: oh, channels: 4 },
    })
      .png()
      .toBuffer();
    parts.push({
      png,
      box: [x0 / w, y0 / h, x1 / w, y1 / h],
      palette: palette(pixels, o.pixels, fit.colors),
    });
    overlays.push({ input: png, left: x0, top: y0 });
  }
  const rebuilt = await sharp(field).composite(overlays).png().toBuffer();
  const rebuiltPixels = await sharp(rebuilt).raw().toBuffer();
  let off = 0,
    error = 0;
  // Seams a pixel or two away from the source's are invisible; a missing detail is not, because
  // no rebuilt pixel nearby has its colour.
  const shift = Math.max(1, Math.round(Math.min(w, h) / 300));
  for (let p = 0; p < area; p++) {
    const d = distance(pixels, p * 4, rebuiltPixels, p * 4);
    error += d / Math.sqrt(3) / 255;
    if (d <= 64) continue;
    const x = p % w,
      y = Math.floor(p / w);
    let matched = false;
    for (let dy = -shift; dy <= shift && !matched; dy++)
      for (let dx = -shift; dx <= shift && !matched; dx++) {
        const nx = x + dx,
          ny = y + dy;
        matched =
          nx >= 0 &&
          nx < w &&
          ny >= 0 &&
          ny < h &&
          distance(pixels, p * 4, rebuiltPixels, (ny * w + nx) * 4) <= 64;
      }
    if (!matched) off++;
  }
  const mismatch = off / area,
    meanError = error / area;
  if (mismatch > MAX_MISMATCH || meanError > 0.04)
    throw new Error(
      `Reconstruction needs review (${(mismatch * 100).toFixed(2)}% mismatch, ${(meanError * 100).toFixed(2)}% mean error)`,
    );
  return {
    width: w,
    height: h,
    original: await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toBuffer(),
    field,
    rebuilt,
    fit,
    parts,
    mismatch,
    meanError,
    fieldShare: 1 - objects.reduce((n, o) => n + o.pixels.length, 0) / area,
  };
}

export function rasterDesign(
  result: RasterResult,
  urls: string[],
  fieldUrl?: string,
): StudioDesignV1 {
  if (result.fit.kind === 'image' && !fieldUrl)
    throw new Error('An inferred field needs its cached image URL');
  return {
    version: 1,
    ratio: [1, result.width / result.height],
    field:
      result.fit.kind === 'image'
        ? { ...result.fit, src: fieldUrl! }
        : result.fit,
    layers: result.parts.map((part, i) => {
      const [x0, y0, x1, y1] = part.box;
      return {
        id: `raster-${i + 1}`,
        emblemId: 'part',
        name: result.parts.length === 1 ? 'Emblem' : `Object ${i + 1}`,
        src: urls[i],
        aspect: ((x1 - x0) * result.width) / ((y1 - y0) * result.height),
        palette: part.palette,
        colors: [...part.palette],
        x: (x0 + x1) / 2,
        y: (y0 + y1) / 2,
        size: y1 - y0,
        rotation: 0,
        flipX: false,
        flipY: false,
        outline: null,
        repeat: null,
      };
    }),
  };
}
