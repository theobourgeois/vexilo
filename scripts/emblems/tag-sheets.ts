import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Cluster } from './cluster-candidates';
import { maskIou } from './features';
import type { Candidate } from './harvest-candidates';
import { drawSheet, readResults, type TriageResult } from './sheets';

/**
 * Step 3: after the triage (triage/result-NNN.json, scored 0–3 by eye), draws bigger numbered
 * sheets of everything worth naming: the current library plus every new emblem scored 2 or 3.
 * Lookalikes are placed next to each other so whoever names them can spot duplicates.
 *   npm run emblems:tag-sheets -- --out ~/code/vexilo-emblem-work/v2
 * Writes <out>/tag/sheet-NNN.png and .json; names, categories and tags go in tag/result-NNN.json
 * (see TAGGING.md).
 */

async function main() {
  const out = process.argv[process.argv.indexOf('--out') + 1];
  if (!out || !process.argv.includes('--out')) throw new Error('Pass --out <work directory>');
  const clusters = JSON.parse(await readFile(path.join(out, 'clusters.json'), 'utf8')) as Cluster[];
  const candidates = new Map((JSON.parse(await readFile(path.join(out, 'harvest.json'), 'utf8')) as Candidate[]).map((c) => [c.key, c]));
  const triage = new Map((await readResults<TriageResult>(path.join(out, 'triage'))).map((r) => [r.id, r]));

  const picked = clusters.filter((c) => c.library || (triage.get(c.id)?.score ?? 0) >= 2);
  console.log(`[tag] ${triage.size} triaged; naming ${picked.length} (${picked.filter((c) => c.library).length} from the library)`);

  // Loose lookalike groups (same silhouette, any colours), largest first, so duplicates sit together.
  const parent = picked.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const f = picked.map((c) => candidates.get(c.rep)!.features!);
  for (let i = 0; i < picked.length; i++) {
    for (let j = i + 1; j < picked.length; j++) {
      if (Math.abs(Math.log(f[i].w / f[i].h / (f[j].w / f[j].h))) > 0.2) continue;
      if (maskIou(f[i].mask, f[j].mask) >= 0.78) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  picked.forEach((_, i) => (groups.get(find(i)) ?? groups.set(find(i), []).get(find(i))!).push(i));
  const order = [...groups.values()].sort((a, b) => b.length - a.length).flat().map((i) => picked[i]);

  const dir = path.join(out, 'tag');
  await mkdir(dir, { recursive: true });
  const perSheet = 20;
  for (let s = 0; s * perSheet < order.length; s++) {
    const page = order.slice(s * perSheet, (s + 1) * perSheet);
    const name = `sheet-${String(s).padStart(3, '0')}`;
    await drawSheet(
      path.join(dir, `${name}.png`),
      page.map((c, i) => ({ thumb: path.join(out, 'thumb', `${c.rep}.png`), label: String(i + 1) })),
      { cols: 5, tile: 200 },
    );
    await writeFile(
      path.join(dir, `${name}.json`),
      JSON.stringify(
        page.map((c, i) => ({
          n: i + 1,
          id: c.id,
          flag: candidates.get(c.rep)!.flag,
          flags: [...new Set(c.members.map((m) => candidates.get(m)!.flag))].slice(0, 12),
          note: triage.get(c.id)?.note,
        })),
      ),
    );
  }
  console.log(`[tag] ${Math.ceil(order.length / perSheet)} sheets in ${dir}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
