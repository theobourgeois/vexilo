/** Post addresses: vexilo.org/@username/slug. Slugs are unique per person. */
export const SLUG_MAX = 60;
const FALLBACK_SLUG = 'flag';
/** Pages under a profile, which a post can't take the address of. */
const RESERVED_SLUGS = new Set(['followers', 'following', 'likes', 'liked', 'remixes', 'designs', 'encyclopedia', 'settings']);

/** "Republic of Ōsaka (remix)" -> "republic-of-osaka-remix". */
export function slugBase(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  if (!slug) return FALLBACK_SLUG;
  return RESERVED_SLUGS.has(slug) ? `${slug}-flag` : slug;
}

/** The first of `base`, `base-2`, `base-3`… that isn't in `taken` (lowercase slugs). */
export function firstFreeSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export const postPath = (username: string, slug: string) => `/@${username}/${slug}`;
export const profilePath = (username: string) => `/@${username}`;
