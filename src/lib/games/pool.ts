import { CLOUD_FRONT_URL } from '@/lib/constant';
import { COUNTRY_ROWS, PLACE_ROWS } from './pool-data';

export type Region = 'AF' | 'AS' | 'EU' | 'NA' | 'SA' | 'OC';

/** How surely a flag has something: 'sure' counts when building a grid, 'maybe' is only accepted. */
export type Level = 'sure' | 'maybe';

export type FlagSet = 'country' | 'us-state' | 'canada' | 'australia' | 'uk' | 'territory' | 'organization' | 'historical';

export type GameFlag = {
  id: string;
  /** What the games call it. */
  name: string;
  /** Its page on Vexilo. */
  href: string;
  image: string;
  set: FlagSet;
};

export type Country = GameFlag & {
  regions: Region[];
  colors: Record<string, Level>;
  traits: Record<string, Level>;
  landlocked: boolean;
  /** Lowercased, accent-free names a player might type. */
  search: string[];
};

export const REGION_NAMES: Record<Region, string> = {
  AF: 'Africa',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  SA: 'South America',
  OC: 'Oceania',
};

export const COLOR_NAMES: Record<string, string> = {
  r: 'Red',
  b: 'Blue',
  g: 'Green',
  y: 'Yellow',
  w: 'White',
  k: 'Black',
  o: 'Orange',
  p: 'Purple',
};

/** Swatches for the colour codes; these are the flag-standard shades, not the theme's. */
export const COLOR_SWATCHES: Record<string, string> = {
  r: '#D52B1E',
  b: '#1F4FA8',
  g: '#13894A',
  y: '#F5C300',
  w: '#FFFFFF',
  k: '#16171A',
  o: '#F08A24',
  p: '#7A3E9D',
};

const LANDLOCKED = new Set([
  'Afghanistan', 'Andorra', 'Armenia', 'Austria', 'Azerbaijan', 'Belarus', 'Bhutan', 'Bolivia', 'Botswana',
  'Burkina Faso', 'Burundi', 'Central African Republic', 'Chad', 'Czech Republic', 'Eswatini', 'Ethiopia',
  'Hungary', 'Kazakhstan', 'Kosovo', 'Kyrgyzstan', 'Laos', 'Lesotho', 'Liechtenstein', 'Luxembourg', 'Malawi',
  'Mali', 'Moldova', 'Mongolia', 'Nepal', 'Niger', 'North Macedonia', 'Paraguay', 'Rwanda', 'San Marino',
  'Serbia', 'Slovakia', 'South Sudan', 'Switzerland', 'Tajikistan', 'Turkmenistan', 'Uganda', 'Uzbekistan',
  'Vatican City', 'Zambia', 'Zimbabwe',
]);

const ALIASES: Record<string, string[]> = {
  'United States': ['USA', 'US', 'America', 'United States of America'],
  'United Kingdom': ['UK', 'Britain', 'Great Britain'],
  'Czech Republic': ['Czechia'],
  'Ivory Coast': ["Côte d'Ivoire", 'Cote dIvoire'],
  'DR Congo': ['Democratic Republic of the Congo', 'DRC', 'Congo-Kinshasa'],
  'Republic of the Congo': ['Congo', 'Congo-Brazzaville'],
  'East Timor': ['Timor-Leste'],
  Eswatini: ['Swaziland'],
  'North Macedonia': ['Macedonia'],
  Myanmar: ['Burma'],
  'Cape Verde': ['Cabo Verde'],
  'Vatican City': ['Holy See', 'Vatican'],
  Taiwan: ['Republic of China', 'ROC'],
  China: ["People's Republic of China", 'PRC'],
  'North Korea': ['DPRK'],
  'South Korea': ['Korea', 'Republic of Korea'],
  Micronesia: ['Federated States of Micronesia'],
  'United Arab Emirates': ['UAE', 'Emirates'],
  'Central African Republic': ['CAR'],
  'Bosnia and Herzegovina': ['Bosnia'],
  Netherlands: ['Holland'],
  Turkey: ['Türkiye'],
  Russia: ['Russian Federation'],
  Vietnam: ['Viet Nam'],
  Laos: ['Lao'],
  Kyrgyzstan: ['Kyrgyz Republic'],
  Brunei: ['Brunei Darussalam'],
  'Trinidad and Tobago': ['Trinidad'],
  'Antigua and Barbuda': ['Antigua'],
  'Saint Kitts and Nevis': ['St Kitts'],
  'Saint Vincent and the Grenadines': ['St Vincent'],
  'Papua New Guinea': ['PNG'],
  'Dominican Republic': ['DR'],
};

/** Lowercase, strip accents and punctuation, and spell out "St". */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bst\b/g, 'saint')
    .trim();

const href = (flag: string) => `/flag/${encodeURIComponent(flag)}`;
const image = (path: string) => `${CLOUD_FRONT_URL}/${path}`;

function levels(codes: string) {
  const out: Record<string, Level> = {};
  for (const code of codes.split(/\s+/).filter(Boolean)) {
    if (code.startsWith('~')) out[code.slice(1)] = 'maybe';
    else out[code] = 'sure';
  }
  return out;
}

export const COUNTRIES: Country[] = COUNTRY_ROWS.map((row) => ({
  id: row.id,
  name: row.name,
  href: href(row.flag),
  image: image(row.image),
  set: 'country',
  regions: row.region.split(' ') as Region[],
  colors: levels(row.colors),
  traits: levels(row.traits),
  landlocked: LANDLOCKED.has(row.name),
  search: [row.name, ...(ALIASES[row.name] ?? [])].map(normalize),
}));

export const PLACES: GameFlag[] = PLACE_ROWS.map((row) => ({
  id: row.id,
  name: row.name,
  href: href(row.flag),
  image: image(row.image),
  set: row.set as FlagSet,
}));

export const COUNTRY_BY_ID = new Map(COUNTRIES.map((country) => [country.id, country]));

/** Countries matching what a player typed, names that start with it first. */
export function searchCountries(query: string, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const scored: { country: Country; score: number }[] = [];
  for (const country of COUNTRIES) {
    let score = Infinity;
    for (const [i, name] of country.search.entries()) {
      // An exact name beats a prefix beats a word start beats anywhere; the country's own name beats an alias.
      const at = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(` ${q}`) ? 2 : name.includes(q) ? 3 : -1;
      if (at >= 0) score = Math.min(score, at * 2 + (i === 0 ? 0 : 1));
    }
    if (score < Infinity) scored.push({ country, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name))
    .slice(0, limit)
    .map((s) => s.country);
}

/** Every colour a country might have, sure ones first. */
export const countryColors = (country: Country) =>
  Object.entries(country.colors)
    .sort((a, b) => (a[1] === b[1] ? 0 : a[1] === 'sure' ? -1 : 1))
    .map(([code]) => code);
