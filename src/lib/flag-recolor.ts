/** Repaints a flag image in the browser, swapping each of its palette colours for a new one. */

const MAX_SIZE = 1400;
/** A pixel this close (RGB) to the line between two palette colours is an anti-aliased edge between them. */
const BLEND_DISTANCE = 24;
/** Pixels within this ΔE of their palette colour follow it fully; detail further out fades to unchanged. */
const FOLLOW_DISTANCE = 20;
const IGNORE_DISTANCE = 40;

type Rgb = [number, number, number];
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

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export type FlagRecolorer = {
  width: number;
  height: number;
  /** The flag with palette colour i painted as `colors[i]`. */
  render: (colors: string[]) => ImageData;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/**
 * Reads a flag image and works out, once per distinct pixel colour, which palette colour
 * (or blend of two) it belongs to, so each repaint is just a table lookup per pixel.
 * `src` must be same-origin, since the pixels are read back from a canvas.
 */
export async function createFlagRecolorer(
  src: string,
  palette: string[],
  options: { snapPalette?: boolean; cleanEdges?: boolean } = {},
): Promise<FlagRecolorer> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.drawImage(img, 0, 0, width, height);
  const source = ctx.getImageData(0, 0, width, height);
  const data = source.data;

  const oldRgb = palette.map(hexToRgb);
  if (options.snapPalette) {
    // Approximate palettes (rounded, or read from a smaller copy) are moved onto the colour actually
    // painted most near each entry, so unchanged colours repaint exactly.
    const counts = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    oldRgb.forEach((rgb, index) => {
      let best = -1;
      let bestCount = 0;
      for (const [key, count] of counts) {
        const d = Math.hypot(((key >> 16) & 255) - rgb[0], ((key >> 8) & 255) - rgb[1], (key & 255) - rgb[2]);
        if (d < 40 && count > bestCount) [best, bestCount] = [key, count];
      }
      if (best >= 0) oldRgb[index] = [(best >> 16) & 255, (best >> 8) & 255, best & 255];
    });
  }
  const oldLab = oldRgb.map((rgb) => rgbToLab(...rgb));

  // Each distinct colour: its RGB, the palette colours it sits between (a → b at t), and how much it follows them.
  const lookup = new Map<number, number>();
  const pixelEntry = new Uint32Array(width * height);
  const base: number[] = [];
  const from: number[] = [];
  const to: number[] = [];
  const along: number[] = [];
  const weight: number[] = [];

  for (let p = 0; p < pixelEntry.length; p++) {
    const i = p * 4;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let entry = lookup.get(key);
    if (entry === undefined) {
      entry = base.length / 3;
      lookup.set(key, entry);
      const rgb: Rgb = [data[i], data[i + 1], data[i + 2]];
      const lab = rgbToLab(...rgb);

      let a = 0;
      let nearest = Infinity;
      oldLab.forEach((candidate, index) => {
        const d = Math.hypot(lab[0] - candidate[0], lab[1] - candidate[1], lab[2] - candidate[2]);
        if (d < nearest) [a, nearest] = [index, d];
      });

      // Anti-aliasing is a straight RGB mix, so look for the palette colour this one is mixed towards.
      let b = a;
      let t = 0;
      let blendDistance = Infinity;
      oldRgb.forEach((candidate, index) => {
        if (index === a) return;
        const start = oldRgb[a];
        const ab = [candidate[0] - start[0], candidate[1] - start[1], candidate[2] - start[2]];
        const lengthSq = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
        if (lengthSq === 0) return;
        const s = Math.min(1, ((rgb[0] - start[0]) * ab[0] + (rgb[1] - start[1]) * ab[1] + (rgb[2] - start[2]) * ab[2]) / lengthSq);
        if (s <= (options.cleanEdges ? 0 : 0.05)) return;
        const d = Math.hypot(rgb[0] - (start[0] + s * ab[0]), rgb[1] - (start[1] + s * ab[1]), rgb[2] - (start[2] + s * ab[2]));
        if (d < BLEND_DISTANCE && d < blendDistance) [b, t, blendDistance] = [index, s, d];
      });

      base.push(...rgb);
      from.push(a);
      to.push(b);
      along.push(t);
      weight.push(
        b !== a ? 1 : Math.min(1, Math.max(0, (IGNORE_DISTANCE - nearest) / (IGNORE_DISTANCE - FOLLOW_DISTANCE))),
      );
    }
    pixelEntry[p] = entry;
  }

  const entries = from.length;
  const table = new Uint8ClampedArray(entries * 3);

  return {
    width,
    height,
    render(colors) {
      // Shift each colour by how far its palette colour moved, so shading and edges carry over.
      const shift = colors.map((hex, index) => {
        const next = hexToRgb(hex);
        return [next[0] - oldRgb[index][0], next[1] - oldRgb[index][1], next[2] - oldRgb[index][2]];
      });
      for (let e = 0; e < entries; e++) {
        const sa = shift[from[e]];
        const sb = shift[to[e]];
        const t = along[e];
        const w = weight[e];
        for (let c = 0; c < 3; c++) {
          // Raster edges contain mixtures of the old palette, sometimes with a small
          // rounding/compression error. Rebuild confident matches from the new palette
          // so that error doesn't survive as a coloured fringe after a remix.
          const original = oldRgb[from[e]][c] + t * (oldRgb[to[e]][c] - oldRgb[from[e]][c]);
          const color = options.cleanEdges && w === 1 ? original : base[e * 3 + c];
          table[e * 3 + c] = color + w * (sa[c] + t * (sb[c] - sa[c]));
        }
      }
      const output = new ImageData(width, height);
      const out = output.data;
      for (let p = 0; p < pixelEntry.length; p++) {
        const i = p * 4;
        const e = pixelEntry[p] * 3;
        out[i] = table[e];
        out[i + 1] = table[e + 1];
        out[i + 2] = table[e + 2];
        out[i + 3] = data[i + 3];
      }
      return output;
    },
  };
}
