import sharp from 'sharp';

/**
 * What the emblem harvester measures on each 256px thumbnail: enough to find the same shape
 * on different flags and to throw out obvious junk before anyone looks at it.
 */
export type Features = {
  /** Thumbnail size (the source trimmed to its pixels and fitted in 256px). */
  w: number;
  h: number;
  /** Share of the thumbnail that's painted. A canton or a stripe offcut is close to 1. */
  fill: number;
  /** 32×32 silhouette, centred in a square, as 32 rows of 32 bits. */
  mask: number[];
  /** 16×16 map of which palette colour dominates each cell (-1 for empty), centred in a square. */
  seg: number[];
  /** Colours covering at least 2% of the painted area, largest first, with their share. */
  palette: { hex: string; share: number }[];
  /** Share of painted pixels sitting on an edge (alpha or colour change); fine detail scores high. */
  detail: number;
  /** Separate pieces of at least 0.3% of the painted area. Lettering and scatter score high. */
  pieces: number;
};

const OPAQUE = 128;

export async function features(png: Buffer): Promise<Features> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const opaque = new Uint8Array(w * h);
  let painted = 0;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] >= OPAQUE) {
      opaque[i] = 1;
      painted++;
    }
  }
  if (painted === 0) throw new Error('Empty image');

  // Palette: 5-bit bins, then merge bins close to a bigger one.
  const bins = new Map<number, number>();
  for (let i = 0; i < w * h; i++) {
    if (!opaque[i]) continue;
    const bin = ((data[i * 4] >> 3) << 10) | ((data[i * 4 + 1] >> 3) << 5) | (data[i * 4 + 2] >> 3);
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }
  const rgb = (bin: number) => [((bin >> 10) & 31) * 8 + 4, ((bin >> 5) & 31) * 8 + 4, (bin & 31) * 8 + 4];
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const merged: { rgb: number[]; count: number }[] = [];
  for (const [bin, count] of [...bins].sort((a, b) => b[1] - a[1])) {
    const c = rgb(bin);
    const near = merged.find((m) => dist(m.rgb, c) < 48);
    if (near) near.count += count;
    else merged.push({ rgb: c, count });
  }
  const significant = merged.filter((m) => m.count / painted >= 0.02).sort((a, b) => b.count - a.count);
  const hex = (c: number[]) => '#' + c.map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const palette = significant.map((m) => ({ hex: hex(m.rgb), share: Math.round((m.count / painted) * 1000) / 1000 }));
  const nearest = (i: number) => {
    const c = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    let best = 0;
    let bestDist = Infinity;
    significant.forEach((m, k) => {
      const d = dist(m.rgb, c);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    });
    return best;
  };

  // Square grids with the image centred, for comparing shapes regardless of aspect.
  const side = Math.max(w, h);
  const ox = (side - w) / 2;
  const oy = (side - h) / 2;
  const grid = (n: number) => {
    const cells: number[][] = Array.from({ length: n * n }, () => []);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = Math.min(n - 1, Math.floor(((x + ox) / side) * n));
        const gy = Math.min(n - 1, Math.floor(((y + oy) / side) * n));
        cells[gy * n + gx].push(y * w + x);
      }
    }
    return cells;
  };
  const mask: number[] = new Array(32).fill(0);
  grid(32).forEach((pixels, cell) => {
    if (pixels.length && pixels.filter((i) => opaque[i]).length * 2 > pixels.length) mask[cell >> 5] |= 1 << (cell & 31);
  });
  const seg = grid(16).map((pixels) => {
    const inked = pixels.filter((i) => opaque[i]);
    if (!pixels.length || inked.length * 2 <= pixels.length) return -1;
    const votes = new Array(significant.length).fill(0);
    for (const i of inked) votes[nearest(i)]++;
    return votes.indexOf(Math.max(...votes));
  });

  // Edges: a painted pixel whose right or lower neighbour is empty or a different colour.
  let edges = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!opaque[i]) continue;
      const differs = (j: number) =>
        !opaque[j] ||
        Math.abs(data[i * 4] - data[j * 4]) + Math.abs(data[i * 4 + 1] - data[j * 4 + 1]) + Math.abs(data[i * 4 + 2] - data[j * 4 + 2]) > 90;
      if ((x + 1 < w && differs(i + 1)) || (y + 1 < h && differs(i + w))) edges++;
    }
  }

  // Connected pieces (4-connected), counting only ones that matter.
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!opaque[start] || label[start] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x + 1 < w ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < w * h && opaque[j] && label[j] < 0) {
          label[j] = id;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
  }

  return {
    w,
    h,
    fill: Math.round((painted / (w * h)) * 1000) / 1000,
    mask,
    seg,
    palette,
    detail: Math.round((edges / painted) * 1000) / 1000,
    pieces: sizes.filter((s) => s / painted >= 0.003).length,
  };
}

const popcount = (n: number) => {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

/** Overlap of two silhouettes: shared cells over cells in either. */
export function maskIou(a: number[], b: number[]) {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < 32; i++) {
    inter += popcount(a[i] & b[i]);
    union += popcount(a[i] | b[i]);
  }
  return union ? inter / union : 0;
}

/** Share of cells painted in both where the colour layout agrees, trying both orders for two colours. */
export function segAgreement(a: number[], b: number[], colours: number) {
  const score = (map: (k: number) => number) => {
    let both = 0;
    let same = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] < 0 || b[i] < 0) continue;
      both++;
      if (map(a[i]) === b[i]) same++;
    }
    return both ? same / both : 0;
  };
  const straight = score((k) => k);
  return colours === 2 ? Math.max(straight, score((k) => 1 - k)) : straight;
}
