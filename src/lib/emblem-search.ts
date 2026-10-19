export const EMBLEM_CATEGORIES = [
  ['stars', 'Stars'], ['sun-moon', 'Sun & moon'], ['animals', 'Animals'], ['birds', 'Birds'],
  ['plants', 'Plants'], ['arms', 'Coats of arms'], ['seals', 'Seals & badges'], ['faith', 'Faith'],
  ['crowns', 'Crowns'], ['tools', 'Tools & weapons'], ['buildings', 'Buildings'], ['sea', 'Ships & sea'],
  ['people', 'People'], ['symbols', 'Symbols'],
] as const;

type SearchableEmblem = { name: string; names: string[]; tags?: string[] };
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\bfleurs\b/g, 'fleur').replace(/\blys\b/g, 'lis');

/** Every word must match; visible names rank above tags, then source flag names. */
export function emblemSearchScore(emblem: SearchableEmblem, query: string) {
  const q = normalize(query);
  if (!q) return 1;
  const name = normalize(emblem.name);
  const nameWords = name.split(' ');
  const tags = (emblem.tags ?? []).map(normalize);
  const flags = emblem.names.map(normalize);
  let total = name === q ? 2 : 0;
  for (const word of q.split(/\s+/)) {
    const forms = word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? [word, word.slice(0, -1)] : [word];
    let score = 0;
    for (const w of forms) {
      if (nameWords.includes(w)) score = Math.max(score, 6);
      else if (nameWords.some((n) => n.startsWith(w))) score = Math.max(score, 5);
      else if (tags.includes(w)) score = Math.max(score, 4);
      else if (tags.some((t) => t.startsWith(w))) score = Math.max(score, 3);
      else if (name.includes(w) || tags.some((t) => t.includes(w))) score = Math.max(score, 2);
      else if (flags.some((f) => f.includes(w))) score = Math.max(score, 1);
    }
    if (!score) return 0;
    total += score;
  }
  return total;
}
