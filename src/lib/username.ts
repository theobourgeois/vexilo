import { z } from 'zod';

/** Usernames are public, unique regardless of case, and contain no spaces. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
export const USERNAME_RULES = 'Use 3–24 letters, numbers or underscores.';

/** Names a non-admin can't take, so nobody can pose as the site or as "anonymous". */
const RESERVED = new Set([
  'admin',
  'administrator',
  'anonymous',
  'anonymous_user',
  'deleted',
  'help',
  'mod',
  'moderator',
  'null',
  'official',
  'root',
  'staff',
  'support',
  'system',
  'undefined',
  'unknown',
  'user',
  'vexilo',
  'vexilo_team',
]);

export const isReservedUsername = (username: string) =>
  RESERVED.has(username.toLowerCase());

export const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_PATTERN, USERNAME_RULES)
  .refine((value) => !isReservedUsername(value), 'That username is reserved.');

/** Used when a name has no Latin letters or digits to build a username from. */
export const FALLBACK_USERNAME = 'vexillologist';

// Cyrillic and Greek spell out in Latin letters; other scripts fall back to FALLBACK_USERNAME.
const TRANSLITERATION: Record<string, string> = Object.fromEntries(
  [
    'а a', 'б b', 'в v', 'г g', 'ґ g', 'д d', 'е e', 'ё e', 'є ye', 'ж zh', 'з z', 'и i', 'і i',
    'ї yi', 'й y', 'к k', 'л l', 'м m', 'н n', 'о o', 'п p', 'р r', 'с s', 'т t', 'у u', 'ў u',
    'ф f', 'х kh', 'ц ts', 'ч ch', 'ш sh', 'щ shch', 'ы y', 'э e', 'ю yu', 'я ya',
    'α a', 'β v', 'γ g', 'δ d', 'ε e', 'ζ z', 'η i', 'θ th', 'ι i', 'κ k', 'λ l', 'μ m', 'ν n',
    'ξ x', 'ο o', 'π p', 'ρ r', 'σ s', 'ς s', 'τ t', 'υ y', 'φ f', 'χ ch', 'ψ ps', 'ω o',
  ].map((pair) => pair.split(' ')),
);

function transliterate(text: string) {
  return text.replace(/[\u0370-\u03ff\u0400-\u04ff]/g, (char) => {
    const lower = char.toLowerCase();
    const latin = TRANSLITERATION[lower];
    if (latin === undefined) return ''; // hard and soft signs, Greek punctuation
    return char === lower ? latin : latin.charAt(0).toUpperCase() + latin.slice(1);
  });
}

/**
 * Turn a free-form name into a username: "Théo Bourgeois" -> "Theo_Bourgeois".
 * Returns '' when nothing usable is left.
 */
export function usernameBase(source: string | null | undefined): string {
  const base = transliterate((source ?? '').normalize('NFKD').replace(/\p{M}/gu, ''))
    .replace(/[ß]/g, 'ss')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/[\s\-.'’]+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, USERNAME_MAX)
    .replace(/_$/, '');
  return base.length >= USERNAME_MIN ? base : '';
}

/** `base` with a number on the end, kept within the length limit. */
export function withSuffix(base: string, n: number): string {
  const suffix = `_${n}`;
  return `${base.slice(0, USERNAME_MAX - suffix.length).replace(/_$/, '')}${suffix}`;
}

/** The first of base, base_2, base_3… that isn't in `taken` (lowercased names). */
export function firstFreeUsername(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base.toLowerCase()) && !isReservedUsername(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = withSuffix(base, n);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
