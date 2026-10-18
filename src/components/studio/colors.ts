type Rgb = [number, number, number];
type Lab = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHex([r, g, b]: Rgb) {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function normalizeHex(value: string): string | null {
  const v = value.trim().replace(/^#?/, '#');
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase();
  return null;
}

function srgbToLinear(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgbToLab([r, g, b]: Rgb): Lab {
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function colorDistance(a: string, b: string) {
  const [la, lb] = [rgbToLab(hexToRgb(a)), rgbToLab(hexToRgb(b))];
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

export function nearest(hex: string, choices: string[]) {
  let best = choices[0];
  for (const choice of choices) if (colorDistance(hex, choice) < colorDistance(hex, best)) best = choice;
  return best;
}

export const sameColor = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

export const uniqueColors = (colors: string[]) => [...new Map(colors.map((c) => [c.toUpperCase(), c.toUpperCase()])).values()];

/** Real flag colours, roughly the shades flags actually use. */
export const FLAG_COLORS = [
  '#FFFFFF', '#F4F1EA', '#BFC1C2', '#7D7F82', '#000000', '#3A2416',
  '#EF3340', '#CE1126', '#C8102E', '#B22234', '#8D1B3D', '#5C1A33',
  '#FF9933', '#F77F00', '#FCD116', '#FFCE00', '#DAA520', '#C9A13B',
  '#7CC242', '#1EB53A', '#009B3A', '#007A3D', '#006A4E', '#1F4B2C',
  '#75AADB', '#00A1DE', '#0072CE', '#0055A4', '#0038A8', '#002868',
  '#012169', '#14285C', '#3FC1C9', '#0B7A75', '#6A2C8F', '#C0007A',
];

/** Classic flag colour schemes, applied to the field in order. */
export const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Tricolore', colors: ['#0055A4', '#FFFFFF', '#EF4135'] },
  { name: 'Pan-African', colors: ['#078930', '#FCDD09', '#DA121A', '#000000'] },
  { name: 'Pan-Arab', colors: ['#CE1126', '#FFFFFF', '#000000', '#007A3D'] },
  { name: 'Pan-Slavic', colors: ['#FFFFFF', '#0039A6', '#D52B1E'] },
  { name: 'Nordic', colors: ['#C8102E', '#FFFFFF', '#00205B'] },
  { name: 'Andean', colors: ['#FCD116', '#003893', '#CE1126'] },
  { name: 'Celtic', colors: ['#169B62', '#FFFFFF', '#FF883E'] },
  { name: 'Southern Cross', colors: ['#012169', '#FFFFFF', '#C8102E', '#FFCD00'] },
  { name: 'Rising Sun', colors: ['#FFFFFF', '#BC002D', '#1A1A1A'] },
  { name: 'Steppe', colors: ['#00AFCA', '#FEC50C', '#C4272F'] },
];

/**
 * Repaints colours with the nearest of `targets`, skipping `avoid` (the colour behind the
 * emblem) so nothing disappears into the field. In multi-colour emblems near-blacks and
 * near-whites are left alone, since there they're outlines and highlights rather than colour.
 * Pass an emblem's own colours, not its current ones, so repeated matching never drifts.
 */
export function matchToPalette(colors: string[], targets: string[], avoid?: string) {
  const choices = uniqueColors(targets).filter((c) => !avoid || colorDistance(c, avoid) > 12);
  if (choices.length === 0) return colors;
  const kept = (color: string) => colors.length > 1 && (luminance(color) < 0.02 || luminance(color) > 0.9);
  const used = new Set(colors.filter(kept).map((c) => c.toUpperCase()));
  return colors.map((color) => {
    if (kept(color)) return color;
    const ranked = [...choices].sort((a, b) => colorDistance(color, a) - colorDistance(color, b));
    // Distinct colours stay distinct where the palette has a close enough spare, so detail doesn't merge.
    const limit = colorDistance(color, ranked[0]) + 35;
    const pick = ranked.find((c) => !used.has(c) && colorDistance(color, c) <= limit) ?? ranked[0];
    used.add(pick);
    return pick;
  });
}
