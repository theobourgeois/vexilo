export const SITE_URL = 'https://vexilo.org';

export const flagPath = (name: string) => `/flag/${encodeURIComponent(name)}`;

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

// Names that already say what kind of flag they are ("Eureka Flag", "Presidential Standard of Yemen").
const FLAG_WORDS = /\b(flags?|banners?|standards?|ensigns?|pennants?|jacks?|guidons?|vexilloids?|colou?rs)\b/i;

/** How people search for a flag: "Flag of Canada", "Flag of the United States", but "Eureka Flag" as is. */
export function flagHeadline(name: string) {
  const trimmed = name.trim();
  if (FLAG_WORDS.test(trimmed)) return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `Flag of ${trimmed}`;
}

/** Inline schema.org data for search engines. `<` is escaped so text can't close the script tag. */
export function jsonLd(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
