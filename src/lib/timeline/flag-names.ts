// Helpers for reading the dates people put in flag names, e.g. "Albania (1946–1992)" or "Syria (2025-)".
// Used to group a flag with its older versions in the catalogue.

const YEAR = String.raw`\b(1[0-9]{3}|20[0-2][0-9])\b`;

// "(1946–1992)", "(1964)", "(c. 1800)", "1701-1935", "(before 1820)", "(2025-)", "(2023–present)"
export const YEAR_SPAN = new RegExp(
  String.raw`\s*\(?\s*(?:c\.\s*|before\s+|after\s+|from\s+|until\s+)?${YEAR}(?:\s*[-–—]\s*(?:${YEAR}|present|today)?)?\s*\)?`,
  'gi',
);

export const hasYearSpan = (name: string) => new RegExp(YEAR_SPAN.source, 'i').test(name);

/** Historical versions have a closed date ("(1946–1992)", "(1964)"); "(2025-)" and "(2023–present)" are current. */
export const isHistoricalVersion = (name: string) =>
  hasYearSpan(name) && !new RegExp(String.raw`${YEAR}\s*[-–—]\s*(present|today)?\s*\)?\s*$`, 'i').test(name);

/** The first year span in a name: "Libya (1972–1977)" → { start: 1972, end: 1977 }; "Canada (1964)" → { start: 1964, end: null }. */
export function parseYearSpan(name: string): { start: number; end: number | null } | null {
  const match = new RegExp(
    String.raw`${YEAR}(?:\s*[-–—]\s*(?:${YEAR}|present|today)?)?`,
    'i',
  ).exec(name);
  if (!match) return null;
  return { start: Number(match[1]), end: match[2] ? Number(match[2]) : null };
}

/** Lowercase, no accents, "&" → "and", "St." → "Saint". */
export const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/\bSt\.\s*/g, 'Saint ')
    .replace(/\bU\.S\.\s*/g, 'United States ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** "the People's Republic of China" → "china"; "Kingdom of Hawaii" → "hawaii". */
const FORMAL_PREFIX =
  /^(?:(?:people'?s|islamic|democratic|federal|socialist|united|arab|free|independent|provisional|second|first|third)\s+)*(?:republic|kingdom|state|empire|principality|emirate|sultanate|grand duchy|duchy|commonwealth|federation|union|dominion|confederation)\s+of\s+(?:the\s+)?/i;
export const stripFormalPrefix = (key: string) => key.replace(FORMAL_PREFIX, '');

/** The name a flag shares with its other versions: "the Philippines (1898–1901)" → "philippines"; "Flag of Bhutan" → "bhutan". */
export function lineageKey(name: string) {
  return normalizeName(name)
    .replace(YEAR_SPAN, ' ')
    .replace(/^\s*(the\s+)?flag\s+of\s+/i, '')
    .replace(/\s+flag\s*$/i, '')
    .replace(/^\s*the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Groups a flag with its versions across formal names too: "the Islamic Emirate of Afghanistan" and "Afghanistan (1931–1973)" → "afghanistan". */
export const timelineKey = (name: string) => stripFormalPrefix(lineageKey(name));
