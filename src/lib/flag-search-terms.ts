/**
 * Vocabulary for describing flags ("red and white with a cross"). Shared by the browse
 * search box (to show chips) and the flag queries (to filter), so both read a query the same way.
 */

export type ColorFamily =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'brown'
  | 'white'
  | 'grey'
  | 'black';

export const COLOR_FAMILIES: Array<{ key: ColorFamily; label: string; swatch: string; words: string[] }> = [
  { key: 'red', label: 'Red', swatch: '#C8102E', words: ['red', 'crimson', 'scarlet', 'maroon', 'burgundy'] },
  { key: 'orange', label: 'Orange', swatch: '#F07C1B', words: ['orange', 'saffron'] },
  { key: 'yellow', label: 'Yellow', swatch: '#FCD116', words: ['yellow', 'gold', 'golden'] },
  { key: 'green', label: 'Green', swatch: '#14904A', words: ['green', 'olive', 'emerald'] },
  { key: 'blue', label: 'Blue', swatch: '#1F4FB4', words: ['blue', 'navy', 'azure', 'teal', 'turquoise', 'cyan'] },
  { key: 'purple', label: 'Purple', swatch: '#6A2C8F', words: ['purple', 'violet', 'lavender'] },
  { key: 'pink', label: 'Pink', swatch: '#F2A2B8', words: ['pink', 'magenta'] },
  { key: 'brown', label: 'Brown', swatch: '#7A4B26', words: ['brown', 'tan'] },
  { key: 'white', label: 'White', swatch: '#FFFFFF', words: ['white', 'silver', 'cream'] },
  { key: 'grey', label: 'Grey', swatch: '#7D7F82', words: ['grey', 'gray'] },
  { key: 'black', label: 'Black', swatch: '#111111', words: ['black'] },
];

/** Broad family for each colour name produced by the image palette (see flag-palette.ts). */
export const PALETTE_NAME_FAMILY: Record<string, ColorFamily> = {
  White: 'white',
  Cream: 'white',
  Silver: 'grey',
  Grey: 'grey',
  Black: 'black',
  Red: 'red',
  Crimson: 'red',
  'Dark red': 'red',
  Maroon: 'red',
  Pink: 'pink',
  Magenta: 'pink',
  Orange: 'orange',
  Saffron: 'orange',
  Gold: 'yellow',
  Yellow: 'yellow',
  Tan: 'brown',
  Brown: 'brown',
  'Light green': 'green',
  Green: 'green',
  'Dark green': 'green',
  Olive: 'green',
  Teal: 'blue',
  Turquoise: 'blue',
  'Sky blue': 'blue',
  'Steel blue': 'blue',
  Blue: 'blue',
  'Royal blue': 'blue',
  Navy: 'blue',
  Purple: 'purple',
  Lavender: 'purple',
};

export type FlagTrait = {
  key: string;
  label: string;
  group: 'type' | 'symbol';
  /** Search tokens on the flag's generated metadata; a flag matches if it has any of them. */
  tokens: string[];
  /** Words and phrases that select this trait when typed. */
  words: string[];
};

export const FLAG_TRAITS: FlagTrait[] = [
  { key: 'nordic_cross', label: 'Nordic cross', group: 'type', tokens: ['layout_nordic_cross'], words: ['nordic cross', 'scandinavian cross', 'nordic', 'scandinavian'] },
  { key: 'cross', label: 'Cross', group: 'type', tokens: ['layout_cross', 'layout_nordic_cross', 'symbol_cross', 'pattern_cross_pattern'], words: ['cross', 'crosses'] },
  { key: 'saltire', label: 'Saltire', group: 'type', tokens: ['layout_saltire'], words: ['saltire', 'x cross'] },
  { key: 'tricolor', label: 'Tricolour', group: 'type', tokens: ['pattern_tricolor'], words: ['tricolor', 'tricolour', 'triband'] },
  { key: 'bicolor', label: 'Bicolour', group: 'type', tokens: ['pattern_bicolor'], words: ['bicolor', 'bicolour'] },
  { key: 'horizontal_stripes', label: 'Horizontal stripes', group: 'type', tokens: ['layout_horizontal_stripes'], words: ['horizontal stripes', 'horizontal'] },
  { key: 'vertical_stripes', label: 'Vertical stripes', group: 'type', tokens: ['layout_vertical_stripes'], words: ['vertical stripes', 'vertical'] },
  { key: 'stripes', label: 'Stripes', group: 'type', tokens: ['pattern_multistripe', 'layout_horizontal_stripes', 'layout_vertical_stripes'], words: ['stripes', 'striped', 'stripe'] },
  { key: 'canton', label: 'Canton', group: 'type', tokens: ['layout_canton', 'pattern_solid_with_canton'], words: ['canton'] },
  { key: 'diagonal', label: 'Diagonal', group: 'type', tokens: ['layout_diagonal', 'pattern_diagonal_pattern'], words: ['diagonal', 'diagonally'] },
  { key: 'triangle', label: 'Triangle', group: 'type', tokens: ['layout_triangle', 'symbol_triangle'], words: ['triangle', 'triangular', 'chevron'] },
  { key: 'quartered', label: 'Quartered', group: 'type', tokens: ['layout_quartered', 'pattern_quartered'], words: ['quartered', 'quarters'] },
  { key: 'solid', label: 'Solid colour', group: 'type', tokens: ['layout_solid', 'pattern_solid'], words: ['plain', 'solid'] },
  { key: 'emblem', label: 'Central emblem', group: 'type', tokens: ['layout_centered_emblem', 'pattern_solid_with_center_symbol'], words: ['emblem', 'centered emblem', 'center symbol'] },
  { key: 'star', label: 'Star', group: 'symbol', tokens: ['symbol_star', 'symbol_constellation'], words: ['star', 'stars', 'starry'] },
  { key: 'sun', label: 'Sun', group: 'symbol', tokens: ['symbol_sun'], words: ['sun', 'suns', 'sunburst', 'rising sun'] },
  { key: 'moon', label: 'Moon', group: 'symbol', tokens: ['symbol_moon'], words: ['moon', 'crescent', 'crescents'] },
  { key: 'circle', label: 'Circle', group: 'symbol', tokens: ['symbol_circle'], words: ['circle', 'disc', 'disk', 'dot'] },
  { key: 'animal', label: 'Animal', group: 'symbol', tokens: ['symbol_animal'], words: ['animal', 'animals'] },
  { key: 'plant', label: 'Plant', group: 'symbol', tokens: ['symbol_plant'], words: ['plant', 'plants', 'tree', 'trees', 'leaf', 'leaves', 'flower'] },
  { key: 'weapon', label: 'Weapon', group: 'symbol', tokens: ['symbol_weapon'], words: ['weapon', 'weapons', 'sword', 'swords', 'spear', 'gun'] },
  { key: 'coat_of_arms', label: 'Coat of arms', group: 'symbol', tokens: ['symbol_coat_of_arms'], words: ['coat of arms', 'arms', 'shield', 'crest'] },
  { key: 'seal', label: 'Seal', group: 'symbol', tokens: ['symbol_seal'], words: ['seal'] },
  { key: 'crown', label: 'Crown', group: 'symbol', tokens: ['symbol_crown'], words: ['crown', 'crowns', 'crowned'] },
  { key: 'text', label: 'Text', group: 'symbol', tokens: ['symbol_text', 'has_text'], words: ['text', 'writing', 'words', 'letters', 'motto'] },
  { key: 'map', label: 'Map', group: 'symbol', tokens: ['symbol_map'], words: ['map', 'outline'] },
  { key: 'building', label: 'Building', group: 'symbol', tokens: ['symbol_building'], words: ['building', 'castle', 'tower', 'church'] },
  { key: 'person', label: 'Person', group: 'symbol', tokens: ['symbol_human'], words: ['person', 'people', 'human', 'man', 'woman'] },
  { key: 'ship', label: 'Ship', group: 'symbol', tokens: ['symbol_ship'], words: ['ship', 'boat', 'anchor'] },
];

const STOP_WORDS = new Set(['a', 'an', 'and', 'with', 'of', 'on', 'in', 'the', 'flag', 'flags', 'or', 'that', 'has', 'have', 'some']);

const TRAITS_BY_KEY = new Map(FLAG_TRAITS.map((trait) => [trait.key, trait]));

export function getTrait(key: string) {
  return TRAITS_BY_KEY.get(key);
}

export function isColorFamily(value: string): value is ColorFamily {
  return COLOR_FAMILIES.some((family) => family.key === value);
}

type Term = { kind: 'color'; key: ColorFamily; phrase: string } | { kind: 'trait'; key: string; phrase: string };

const TERMS: Term[] = [
  ...COLOR_FAMILIES.flatMap((family) => family.words.map((phrase) => ({ kind: 'color' as const, key: family.key, phrase }))),
  ...FLAG_TRAITS.flatMap((trait) => trait.words.map((phrase) => ({ kind: 'trait' as const, key: trait.key, phrase }))),
  // Longest phrases first so "nordic cross" wins over "cross".
].sort((a, b) => b.phrase.length - a.phrase.length);

export type ParsedFlagQuery = {
  colors: ColorFamily[];
  traits: string[];
  /** Words that weren't recognized, matched against names, tags and descriptions. */
  freeWords: string[];
  /** The phrases that were recognized, so a chip can be removed from the query text. */
  matches: Array<{ kind: 'color' | 'trait'; key: string; phrase: string }>;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Reads colours, flag types and symbols out of a free-text query. */
export function parseFlagQuery(query: string): ParsedFlagQuery {
  const original = ` ${normalize(query)} `;
  let rest = original;
  const result: ParsedFlagQuery = { colors: [], traits: [], freeWords: [], matches: [] };

  const found: Term[] = [];
  for (const term of TERMS) {
    const needle = ` ${term.phrase} `;
    if (!rest.includes(needle)) continue;
    rest = rest.split(needle).join(' ');
    found.push(term);
  }
  // Report terms in the order they were typed, so chips read like the query.
  found.sort((a, b) => original.indexOf(` ${a.phrase} `) - original.indexOf(` ${b.phrase} `));
  result.matches = found;
  for (const term of found) {
    if (term.kind === 'color' && !result.colors.includes(term.key)) result.colors.push(term.key);
    if (term.kind === 'trait' && !result.traits.includes(term.key)) result.traits.push(term.key);
  }
  // "Nordic cross" already implies a cross.
  if (result.traits.includes('nordic_cross')) result.traits = result.traits.filter((key) => key !== 'cross');

  result.freeWords = rest.split(' ').filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  return result;
}

/** Removes every phrase that selected the given chip from the query text. */
export function removeFromQuery(query: string, kind: 'color' | 'trait', key: string) {
  const phrases = TERMS.filter((term) => term.kind === kind && term.key === key).map((term) => term.phrase);
  let next = ` ${normalize(query)} `;
  for (const phrase of phrases) next = next.split(` ${phrase} `).join(' ');
  // Drop connectors left hanging, e.g. "red and white flag" minus white → "red flag".
  const words = next.split(' ').filter(Boolean);
  return words
    .filter((word, index) => {
      if (word !== 'and' && word !== 'or') return true;
      const prev = words[index - 1];
      const following = words[index + 1];
      return Boolean(prev && following && !STOP_WORDS.has(prev) && !STOP_WORDS.has(following));
    })
    .join(' ');
}
