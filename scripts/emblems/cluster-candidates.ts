import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Candidate } from './harvest-candidates';
import { maskIou, segAgreement } from './features';
import { drawSheet } from './sheets';

/**
 * Step 2: merges harvested objects that are the same emblem (same silhouette and the same colour
 * layout, in any colours), picks the best copy of each, drops obvious junk, and draws numbered
 * contact sheets of the rest for a visual triage.
 *   npm run emblems:cluster -- --out ~/code/vexilo-emblem-work/v2
 * Reads <out>/harvest.json; writes <out>/clusters.json and <out>/triage/sheet-NNN.png (+ .json
 * listing the cluster on each numbered tile). Library emblems absorb their copies but are never
 * merged with each other or triaged; triage scores go in triage/result-NNN.json (see TRIAGE.md).
 */

export type Cluster = {
  id: string;
  /** The copy that represents it: a library emblem if there is one, else the cleanest source. */
  rep: string;
  members: string[];
  /** Distinct flags it appears on. */
  flags: number[];
  library: boolean;
  reject?: string;
};

function parseArgs(argv: string[]) {
  const args = { out: '', perSheet: 64 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--per-sheet') args.perSheet = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('Pass --out <work directory>');
  return args;
}

/** Same emblem: same proportions and silhouette, and the colours laid out alike. */
function same(a: Candidate, b: Candidate, layout: number) {
  const fa = a.features!;
  const fb = b.features!;
  if (Math.abs(Math.log(fa.w / fa.h / (fb.w / fb.h))) > 0.12) return false;
  if (maskIou(fa.mask, fb.mask) < 0.88) return false;
  return segAgreement(fa.seg, fb.seg, fa.palette.length) >= layout;
}

/** 64-bit coarse silhouette (8×8 from the 32×32 mask) as four 16-bit chunks. */
function coarseChunks(mask: number[]) {
  const bits: number[] = [];
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      let on = 0;
      for (let y = gy * 4; y < gy * 4 + 4; y++) for (let x = gx * 4; x < gx * 4 + 4; x++) if ((mask[y] >>> x) & 1) on++;
      bits.push(on >= 8 ? 1 : 0);
    }
  }
  return [0, 1, 2, 3].map((c) => bits.slice(c * 16, c * 16 + 16).reduce((acc, bit, i) => acc | (bit << i), 0));
}

/** Higher is a better copy to keep. */
function quality(c: Candidate) {
  return (
    (c.origin === 'library' ? 1e9 : 0) +
    (c.svg ? 1e8 : 0) +
    Math.min(c.w, c.h, 2000) * 1e4 -
    c.index
  );
}

/** Junk that never needs a look, or null. */
function junk(c: Candidate): string | null {
  const f = c.features!;
  const aspect = f.w / f.h;
  if (aspect > 6 || aspect < 1 / 6) return 'sliver';
  if (f.fill > 0.95) return 'solid block';
  if (!c.svg && Math.max(c.w, c.h) < 72) return 'too small';
  if (f.w * f.h < 600) return 'too small';
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const all = JSON.parse(await readFile(path.join(args.out, 'harvest.json'), 'utf8')) as Candidate[];
  const items = all.filter((c) => c.features);
  console.log(`[cluster] ${items.length} measured of ${all.length}`);

  // Union-find over pairs that share a coarse chunk and the same number of colours finds groups
  // of lookalikes; those chain (a disc ~ a disc with a star ~ a C around a disc), so each group is
  // then split around its best copies, keeping only members that match that copy directly.
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const buckets = new Map<string, number[]>();
  items.forEach((c, i) => {
    const colours = Math.min(c.features!.palette.length, 5);
    coarseChunks(c.features!.mask).forEach((chunk, k) => {
      // Empty rows say nothing about the shape and would put every wide emblem in one bucket.
      if (chunk === 0) return;
      const key = `${colours}:${k}:${chunk}`;
      (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(i);
    });
  });
  let compared = 0;
  for (const members of buckets.values()) {
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        const i = members[a];
        const j = members[b];
        if (find(i) === find(j)) continue;
        compared++;
        if (same(items[i], items[j], 0.85)) parent[find(i)] = find(j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  items.forEach((_, i) => (groups.get(find(i)) ?? groups.set(find(i), []).get(find(i))!).push(i));
  const split = [...groups.values()].flatMap((group) => {
    let rest = group.map((i) => items[i]).sort((a, b) => quality(b) - quality(a));
    const parts: Candidate[][] = [];
    while (rest.length) {
      const rep = rest[0];
      // Every library emblem stays its own entry, since it's already in use.
      parts.push(rest.filter((c) => c === rep || (c.origin !== 'library' && same(rep, c, 0.9))));
      rest = rest.filter((c) => !parts.at(-1)!.includes(c));
    }
    return parts;
  });
  const clusters: Cluster[] = split.map((members) => {
    const rep = members[0];
    const cluster: Cluster = {
      id: rep.key,
      rep: rep.key,
      members: members.map((m) => m.key),
      flags: [...new Set(members.map((m) => m.index))],
      library: rep.origin === 'library',
    };
    const reason = cluster.library ? null : junk(rep);
    if (reason) cluster.reject = reason;
    return cluster;
  });
  clusters.sort((a, b) => b.flags.length - a.flags.length || a.id.localeCompare(b.id));
  const rejected = clusters.filter((c) => c.reject);
  const byReason = rejected.reduce<Record<string, number>>((acc, c) => ((acc[c.reject!] = (acc[c.reject!] ?? 0) + 1), acc), {});
  console.log(
    `[cluster] ${compared} comparisons → ${clusters.length} distinct (${clusters.filter((c) => c.library).length} in the library); auto-rejected ${rejected.length}: ${JSON.stringify(byReason)}`,
  );
  await writeFile(path.join(args.out, 'clusters.json'), JSON.stringify(clusters));

  // Triage sheets for whatever hasn't been triaged yet, in flag order so variants of one flag sit
  // together. Sheets already drawn are kept, so a re-run only adds sheets after them.
  const byKey = new Map(items.map((c) => [c.key, c]));
  const dir = path.join(args.out, 'triage');
  await mkdir(dir, { recursive: true });
  const drawn = (await readdir(dir)).filter((f) => /^sheet-\d+\.json$/.test(f));
  const seen = new Set<string>();
  for (const f of drawn) for (const t of JSON.parse(await readFile(path.join(dir, f), 'utf8')) as { id: string }[]) seen.add(t.id);
  const triage = clusters
    .filter((c) => !c.library && !c.reject && !seen.has(c.id))
    .sort((a, b) => byKey.get(a.rep)!.index - byKey.get(b.rep)!.index || a.rep.localeCompare(b.rep));
  for (let s = 0; s * args.perSheet < triage.length; s++) {
    const page = triage.slice(s * args.perSheet, (s + 1) * args.perSheet);
    const name = `sheet-${String(drawn.length + s).padStart(3, '0')}`;
    await drawSheet(
      path.join(dir, `${name}.png`),
      page.map((c, i) => ({ thumb: path.join(args.out, 'thumb', `${c.rep}.png`), label: String(i + 1) })),
      { cols: 8, tile: 128 },
    );
    await writeFile(path.join(dir, `${name}.json`), JSON.stringify(page.map((c, i) => ({ n: i + 1, id: c.id, flag: byKey.get(c.rep)!.flag, flags: c.flags.length }))));
  }
  console.log(`[cluster] ${triage.length} new to triage on ${Math.ceil(triage.length / args.perSheet)} sheets in ${dir}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
