const IMAGE_EXTENSION_PATTERN = /\.(svg|png|jpe?g|gif|webp|avif)$/i;
const LEADING_FLAG_PREFIX_PATTERN =
  /^(flag\s+of|(flagge|drapeau|bandera|bandeira)(\s+(de|von|der|du|des|del|do|da))?)\s+/i;
const LEADING_COUNTRY_CODE_PATTERN = /^[A-Z]{2,3}\s+/;
const TRAILING_FLAG_WORD_PATTERN = /\s+(flag|zászló|flagge)$/i;

export const MAX_FLAG_IMAGE_BYTES = 4 * 1024 * 1024;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Turns an uploaded file name into a flag name, following the existing naming
 * convention (no "Flag of" prefix): "Flag_of_the_Kingdom_of_Cochin.svg" -> "Kingdom of Cochin".
 */
export function flagNameFromFileName(fileName: string): string {
  let name = safeDecode(fileName).replace(/^File:/i, '');
  name = name.replace(IMAGE_EXTENSION_PATTERN, '');

  if (name.includes('_')) {
    name = name.replace(/_/g, ' ');
  } else if (!name.includes(' ') && name.includes('-')) {
    name = name.replace(/-/g, ' ');
  }

  name = collapseWhitespace(name);

  const withoutPrefix = name.replace(LEADING_FLAG_PREFIX_PATTERN, '');
  if (withoutPrefix && withoutPrefix !== name) {
    name = withoutPrefix.replace(/^the\s+/i, '');
  }

  return capitalizeFirst(collapseWhitespace(name));
}

/**
 * Detects names that still look like raw file names (e.g. "HUN Kisszallas flag",
 * "IMG 2041") and offers a cleaned-up suggestion when one can be derived.
 * Returns null when the name looks fine.
 */
export function checkFileLikeName(name: string): { suggestion: string | null } | null {
  const trimmed = collapseWhitespace(name);
  if (!trimmed) {
    return null;
  }

  const hasLeadingNumericId = /^\d{3,}\s+[a-z]/.test(trimmed);
  const isGenericFileName =
    /^(img|image|dsc|pxl|screenshot|download|untitled|file)[\s\d_-]/i.test(trimmed);
  const looksLikeFile =
    isGenericFileName ||
    hasLeadingNumericId ||
    IMAGE_EXTENSION_PATTERN.test(trimmed) ||
    /[_]/.test(trimmed) ||
    /\b\d{3,4}px\b/i.test(trimmed) ||
    LEADING_COUNTRY_CODE_PATTERN.test(trimmed) ||
    TRAILING_FLAG_WORD_PATTERN.test(trimmed) ||
    (!trimmed.includes(' ') && /[a-z][A-Z]|\d/.test(trimmed) && trimmed.length > 12);

  if (!looksLikeFile) {
    return null;
  }
  if (isGenericFileName) {
    return { suggestion: null };
  }

  let suggestion = flagNameFromFileName(trimmed);
  suggestion = suggestion
    .replace(/\b\d{3,4}px\b/gi, '')
    .replace(/^\d{3,}\s+/, '')
    .replace(LEADING_COUNTRY_CODE_PATTERN, '')
    .replace(TRAILING_FLAG_WORD_PATTERN, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
  suggestion = capitalizeFirst(collapseWhitespace(suggestion));

  if (!/[a-z]{2}/i.test(suggestion) || suggestion === trimmed) {
    return { suggestion: null };
  }

  return { suggestion };
}

export function normalizeFlagNameForComparison(name: string): string {
  return collapseWhitespace(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/^the\s+/, '');
}

/**
 * Extracts the Commons file title ("File:Flag_of_X.svg") from Wikimedia/Wikipedia
 * file page links and direct upload.wikimedia.org image links.
 */
export function parseWikimediaFileTitle(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith('wikimedia.org') && !host.endsWith('wikipedia.org')) {
    return null;
  }

  if (host === 'upload.wikimedia.org') {
    // /wikipedia/commons/a/ab/Flag.svg or /wikipedia/commons/thumb/a/ab/Flag.svg/120px-Flag.svg.png
    const segments = parsed.pathname.split('/').filter(Boolean);
    const thumbIndex = segments.indexOf('thumb');
    const fileSegment =
      thumbIndex !== -1 ? segments[thumbIndex + 3] : segments[segments.length - 1];
    return fileSegment ? `File:${safeDecode(fileSegment)}` : null;
  }

  const previewFile = parsed.hash.match(/#\/media\/(File:.+)$/i)?.[1];
  if (previewFile) {
    return safeDecode(previewFile);
  }

  const wikiMatch = parsed.pathname.match(/\/wiki\/((?:File|Image|Fichier|Datei|Archivo):.+)$/i);
  if (wikiMatch) {
    return `File:${safeDecode(wikiMatch[1]).replace(/^[^:]+:/, '')}`;
  }

  return null;
}

export function isDirectImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      IMAGE_EXTENSION_PATTERN.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export function isValidSourceUrl(url: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(url.trim());
}

export function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(/https?:\/\/[^\s<>"']+/gi), (match) => match[0]);
}
