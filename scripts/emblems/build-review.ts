import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Cluster } from './cluster-candidates';
import { maskIou } from './features';
import type { Candidate } from './harvest-candidates';
import { readResults, type TagResult, type TriageResult } from './sheets';

/**
 * Step 4: a local review page. "Picked" is the proposed library: everything already in it plus
 * the best-ranked new emblems up to --target; "Runners-up" are the rest that passed triage; "Junk"
 * is what was thrown out. Decisions (rejects, additions, name/tag edits) download as JSON.
 *   npm run emblems:review -- --out ~/code/vexilo-emblem-work/v2
 * <out>/curation.json ({ id: reason }) lists picks Claude would drop after looking through them;
 * the page starts with those rejected, showing why. Writes <out>/review/index.html, data.js and
 * picks.json. keep.json ({ id: reason }) restores reviewed variants, including tagger duplicates.
 * Serve <out> (e.g. python3 -m http.server) and open /review/index.html.
 */

export const CATEGORIES = ['stars', 'sun-moon', 'animals', 'birds', 'plants', 'arms', 'seals', 'faith', 'crowns', 'tools', 'buildings', 'sea', 'people', 'symbols'];

function parseArgs(argv: string[]) {
  const args = { out: '', target: 3500, minRank: 3, perName: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--target') args.target = Number(argv[++i]);
    else if (arg === '--per-name') args.perName = Number(argv[++i]);
    else if (arg === '--min-rank') args.minRank = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('Pass --out <work directory>');
  if (!Number.isInteger(args.target) || args.target < 1) throw new Error('--target must be a positive integer');
  if (!Number.isInteger(args.minRank) || args.minRank < 1 || args.minRank > 5) throw new Error('--min-rank must be 1–5');
  if (args.perName !== Infinity && (!Number.isInteger(args.perName) || args.perName < 1)) throw new Error('--per-name must be a positive integer');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clusters = JSON.parse(await readFile(path.join(args.out, 'clusters.json'), 'utf8')) as Cluster[];
  const candidates = new Map((JSON.parse(await readFile(path.join(args.out, 'harvest.json'), 'utf8')) as Candidate[]).map((c) => [c.key, c]));
  const triage = new Map((await readResults<TriageResult>(path.join(args.out, 'triage'))).map((r) => [r.id, r]));
  const tags = new Map((await readResults<TagResult>(path.join(args.out, 'tag'))).map((r) => [r.id, r]));
  // Picks Claude looked through and would drop ({ id: reason }); the page starts with them rejected.
  const curationFile = path.join(args.out, 'curation.json');
  const curation: Record<string, string> = existsSync(curationFile) ? JSON.parse(await readFile(curationFile, 'utf8')) : {};
  const keepFile = path.join(args.out, 'keep.json');
  const keep: Record<string, string> = existsSync(keepFile) ? JSON.parse(await readFile(keepFile, 'utf8')) : {};
  const duplicateFile = path.join(args.out, 'duplicate-of.json');
  const duplicateOf: Record<string, string> = existsSync(duplicateFile) ? JSON.parse(await readFile(duplicateFile, 'utf8')) : {};
  const legacyFile = path.join(args.out, 'legacy-suggestions.json');
  const legacySuggestions: string[] = existsSync(legacyFile) ? JSON.parse(await readFile(legacyFile, 'utf8')) : [];
  // Persist the defaults already shown to reviewers, so a rebuild can migrate saved decisions.
  const previousData = path.join(args.out, 'review', 'data.js');
  if (existsSync(previousData)) {
    const previous = (await readFile(previousData, 'utf8')).split('window.EMBLEMS = ')[1];
    if (previous) {
      const entries = JSON.parse(previous.trim().replace(/;$/, '')) as { id: string; suggest?: string }[];
      legacySuggestions.push(...entries.filter((e) => e.suggest).map((e) => e.id));
    }
  }
  await writeFile(legacyFile, JSON.stringify([...new Set(legacySuggestions)], null, 1));

  const usable = (c: Cluster) => {
    const t = tags.get(c.id);
    return t && !t.reject && (!t.dup || keep[c.id]) && (t.rank >= args.minRank || keep[c.id]) && CATEGORIES.includes(t.category);
  };
  // Best first: famous (rank), then how good it looked in triage, then how many flags carry it.
  const priority = (c: Cluster) => (tags.get(c.id)?.rank ?? 0) * 10 + (triage.get(c.id)?.score ?? 0) * 3 + Math.min(c.flags.length, 10) / 10;
  const library = clusters.filter((c) => c.library);
  const fresh = clusters.filter((c) => !c.library && usable(c)).sort((a, b) => priority(b) - priority(a));
  // Names describe subjects, not drawings: several lions or fleurs-de-lis can all be useful.
  // A name cap is available only when explicitly requested.
  const named = new Map<string, number>();
  const crowded = new Set<string>();
  const chosen: Cluster[] = [];
  // Clustering has already merged near-identical art. At selection time only suppress identical
  // rendered images; coarse silhouette/colour tests confuse different drawings inside a disc.
  const shape = (c: Cluster) => candidates.get(c.rep)!.features!;
  const fingerprints = new Map(await Promise.all([...library, ...fresh].map(async (c) =>
    [c.id, createHash('sha256').update(await readFile(path.join(args.out, 'thumb', `${c.rep}.png`))).digest('hex')] as const,
  )));
  const seenImages = new Map(library.map((c) => [fingerprints.get(c.id)!, c]));
  const shadowed = new Map<string, string>();
  for (const c of fresh) {
    if (chosen.length >= args.target - library.length) break;
    const twin = seenImages.get(fingerprints.get(c.id)!);
    if (twin) {
      shadowed.set(c.id, tags.get(twin.id)?.name ?? twin.id);
      continue;
    }
    const name = tags.get(c.id)!.name.toLowerCase();
    const n = (named.get(name) ?? 0) + 1;
    named.set(name, n);
    if (n > args.perName) crowded.add(c.id);
    else {
      chosen.push(c);
      seenImages.set(fingerprints.get(c.id)!, c);
    }
  }
  const picked = new Set([...library, ...chosen].map((c) => c.id));

  // A suggested duplicate names the closest pick that stays, so it's clear what it duplicates.
  const kept = clusters.filter((c) => picked.has(c.id) && !curation[c.id]);
  const explain = (c: Cluster): { reason?: string; twin?: Cluster } => {
    const reason = curation[c.id];
    if (!reason?.startsWith('duplicate')) return { reason };
    const confirmed = kept.find((k) => k.id === duplicateOf[c.id]);
    if (confirmed) return { reason: `duplicate of “${tags.get(confirmed.id)?.name ?? candidates.get(confirmed.rep)!.flag}” (${candidates.get(confirmed.rep)!.flag})`, twin: confirmed };
    const f = shape(c);
    const words = (k: Cluster) => new Set((tags.get(k.id)?.name ?? '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2));
    const mine = words(c);
    const likeness = (k: Cluster) => {
      const theirs = words(k);
      const shared = [...mine].filter((w) => theirs.has(w)).length;
      return (shared / Math.max(1, new Set([...mine, ...theirs]).size)) * 2 + maskIou(f.mask, shape(k).mask);
    };
    const category = tags.get(c.id)?.category;
    const twin = kept
      .filter((k) => tags.get(k.id)?.category === category)
      .reduce<Cluster | null>((best, k) => (!best || likeness(k) > likeness(best) ? k : best), null);
    return twin
      ? { reason: `duplicate of “${tags.get(twin.id)?.name ?? candidates.get(twin.rep)!.flag}” (${candidates.get(twin.rep)!.flag})`, twin }
      : { reason };
  };

  const entries = clusters.flatMap((c) => {
    const rep = candidates.get(c.rep)!;
    const t = tags.get(c.id);
    const tri = triage.get(c.id);
    const tab = picked.has(c.id) ? 'library' : c.reject || (tri && tri.score === 0) || t?.reject ? 'rejected' : tri || t ? 'bench' : null;
    if (!tab) return [];
    const flags = [...new Set(c.members.map((m) => candidates.get(m)!.flag))];
    const why: ReturnType<typeof explain> = picked.has(c.id) ? explain(c) : {};
    return [
      {
        id: c.id,
        tab,
        origin: c.library ? 'library' : 'part',
        thumb: `../thumb/${c.rep}.png`,
        name: t?.name ?? (tri && tri.score > 0 ? tri.note ?? '' : ''),
        category: t?.category ?? 'unsorted',
        tags: t?.tags ?? [],
        rank: (t?.rank ?? 0) * 10 + (tri?.score ?? 0),
        flag: rep.flag,
        flags: flags.slice(0, 40),
        count: flags.length,
        colors: rep.features?.palette.map((p) => p.hex) ?? rep.colors,
        reason:
          c.reject ??
          (t?.reject ? t.note : shadowed.has(c.id) ? `identical image: ${shadowed.get(c.id)}` : t?.dup && !keep[c.id] ? 'same drawing flagged during tagging' : crowded.has(c.id) ? 'name limit' : tri?.score === 0 ? tri.note : undefined),
        svg: rep.svg,
        suggest: why.reason,
        twin: why.twin && `../thumb/${why.twin.rep}.png`,
      },
    ];
  });

  const dir = path.join(args.out, 'review');
  await mkdir(dir, { recursive: true });
  await copyFile(path.join(__dirname, 'review.html'), path.join(dir, 'index.html'));
  await writeFile(path.join(dir, 'data.js'), `window.CATEGORIES = ${JSON.stringify([...CATEGORIES, 'unsorted'])};\nwindow.LEGACY_SUGGESTIONS = ${JSON.stringify([...new Set(legacySuggestions)])};\nwindow.EMBLEMS = ${JSON.stringify(entries)};\n`);
  await writeFile(path.join(dir, 'picks.json'), JSON.stringify([...picked]));
  const count = (tab: string) => entries.filter((e) => e.tab === tab).length;
  console.log(`[review] picked ${count('library')} (${library.length} current + ${picked.size - library.length} new), runners-up ${count('bench')}, junk ${count('rejected')} → ${path.join(dir, 'index.html')}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
