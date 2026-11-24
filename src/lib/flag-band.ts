import type { PaletteColor } from './flag-palette';

/** The two ends of the gradient behind a flag page's header. */
export type FlagBand = { from: string; to: string };

/** For flags with no colour at all (black and white, greyscale). Also the band's look before the palette loads. */
export const NEUTRAL_BAND: FlagBand = { from: 'hsl(225 7% 24%)', to: 'hsl(225 8% 11%)' };
/** For flags whose only colour is a yellow: dark yellow reads as mud, so a warm grey instead. */
const WARM_BAND: FlagBand = { from: 'hsl(36 16% 22%)', to: 'hsl(36 14% 11%)' };

function toHsl(hex: string) {
  const value = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { hue: hue * 60, saturation, lightness };
}

const isYellow = (hue: number) => hue >= 40 && hue <= 72;

/**
 * Picks the header colour from the flag's own palette: its largest real colour (not white, black, grey or
 * yellow), darkened so white text reads on it. When that colour covers most of the flag it goes darker
 * still, so a red flag on a red band keeps its edge.
 */
export function flagBand(palette: PaletteColor[]): FlagBand {
  const chromatic = palette
    .map((color) => ({ share: color.share, ...toHsl(color.hex) }))
    .filter((color) => color.saturation > 0.25 && color.lightness > 0.12 && color.lightness < 0.9);
  const pick = chromatic.filter((color) => !isYellow(color.hue)).sort((a, b) => b.share - a.share)[0];
  if (!pick) return chromatic.length > 0 ? WARM_BAND : NEUTRAL_BAND;

  const hue = Math.round(pick.hue);
  const saturation = Math.round(Math.min(pick.saturation, 0.62) * 100);
  const [from, to] = pick.share >= 0.5 ? [26, 13] : [36, 20];
  return { from: `hsl(${hue} ${saturation}% ${from}%)`, to: `hsl(${hue} ${saturation}% ${to}%)` };
}

export const bandGradient = (band: FlagBand) => `linear-gradient(160deg, ${band.from} 0%, ${band.to} 100%)`;
