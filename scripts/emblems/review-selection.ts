import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export const EMBLEM_CATEGORIES = ['stars', 'sun-moon', 'animals', 'birds', 'plants', 'arms', 'seals', 'faith', 'crowns', 'tools', 'buildings', 'sea', 'people', 'symbols'] as const;

export type ReviewedEmblem = {
  id: string;
  tab: 'library' | 'bench' | 'rejected';
  name: string;
  tags: string[];
  category: string;
  rank: number;
  suggest?: string;
};

export type ReviewDecisions = {
  reject: string[];
  add: string[];
  edits: Record<string, Partial<Pick<ReviewedEmblem, 'name' | 'tags' | 'category'>>>;
};

/** Read the generated data without depending on the ordering of its window assignments. */
export async function readReview(file: string): Promise<ReviewedEmblem[]> {
  const context = { window: {} as { EMBLEMS?: ReviewedEmblem[] } };
  vm.runInNewContext(await readFile(file, 'utf8'), context, { timeout: 1000 });
  if (!Array.isArray(context.window.EMBLEMS)) throw new Error('Missing EMBLEMS in review data');
  return context.window.EMBLEMS;
}

/** An exported decisions file contains final cuts, including default suggestions. */
export function selectReviewed(entries: ReviewedEmblem[], decisions?: ReviewDecisions) {
  const all = new Map(entries.map((e) => [e.id, e]));
  if (all.size !== entries.length) throw new Error('Duplicate IDs in review data');
  const reject = new Set(decisions?.reject ?? entries.filter((e) => e.suggest).map((e) => e.id));
  const add = new Set(decisions?.add ?? []);
  for (const id of [...reject, ...add, ...Object.keys(decisions?.edits ?? {})]) {
    if (!all.has(id)) throw new Error(`Decision references unknown emblem: ${id}`);
  }
  const selected = entries
    .filter((e) => e.tab === 'library' ? !reject.has(e.id) : add.has(e.id))
    .map((e) => ({ ...e, ...decisions?.edits?.[e.id] }));
  if (!selected.length) throw new Error('Refusing to import an empty selection');
  for (const e of selected) {
    if (!/^(lib-\d+-\d+|p\d+-\d+)$/.test(e.id)) throw new Error(`Invalid emblem ID: ${e.id}`);
    if (typeof e.name !== 'string' || !e.name.trim() || e.name.length > 160) throw new Error(`Invalid name: ${e.id}`);
    if (!Array.isArray(e.tags) || !e.tags.length || e.tags.some((t) => typeof t !== 'string' || !t.trim())) throw new Error(`Missing search tags: ${e.id}`);
    if (!(EMBLEM_CATEGORIES as readonly string[]).includes(e.category)) throw new Error(`Invalid category: ${e.id}`);
  }
  return selected;
}

export const emblemSourceKey = (id: string) => id.replace(/^lib-/, '');

/** Parts store a height fraction and an aspect ratio; the horizontal fraction needs the flag ratio. */
export function partBox(c: { size: number; aspect: number; x: number; y: number }, flagAspect: number): [number, number, number, number] {
  if (![c.size, c.aspect, flagAspect].every((n) => Number.isFinite(n) && n > 0) || ![c.x, c.y].every(Number.isFinite)) {
    throw new Error('Invalid part geometry');
  }
  const halfWidth = c.size * c.aspect / flagAspect / 2;
  const halfHeight = c.size / 2;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const box: [number, number, number, number] = [clamp(c.x - halfWidth), clamp(c.y - halfHeight), clamp(c.x + halfWidth), clamp(c.y + halfHeight)];
  if (box[2] <= box[0] || box[3] <= box[1]) throw new Error('Part lies outside its flag');
  return box;
}
