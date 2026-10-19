import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emblemSearchScore } from '../../src/lib/emblem-search';
import { emblemSourceKey, partBox, selectReviewed, type ReviewedEmblem } from './review-selection';

const entry = (id: string, extra: Partial<ReviewedEmblem> = {}): ReviewedEmblem => ({ id, tab: 'library', name: 'Maple leaf', category: 'plants', tags: ['maple', 'leaf'], rank: 43, ...extra });

test('default selection imports kept drawings and excludes suggestions and runners-up', () => {
  const selected = selectReviewed([entry('lib-34-0'), entry('p1-1', { suggest: 'duplicate' }), entry('p2-1', { tab: 'bench' })]);
  assert.deepEqual(selected.map((e) => e.id), ['lib-34-0']);
  assert.equal(emblemSourceKey(selected[0].id), '34-0', 'existing IDs upsert under their original source key');
  assert.equal(emblemSourceKey('p2-1'), 'p2-1');
});

test('exported decisions can restore suggestions, rescue runners-up, and edit metadata', () => {
  const entries = [entry('lib-34-0'), entry('p1-1', { suggest: 'duplicate' }), entry('p2-1', { tab: 'bench' })];
  const selected = selectReviewed(entries, { reject: ['lib-34-0'], add: ['p2-1'], edits: { 'p2-1': { name: 'Oak leaf', tags: ['oak', 'leaf'] } } });
  assert.deepEqual(selected.map((e) => e.id), ['p1-1', 'p2-1']);
  assert.equal(selected[1].name, 'Oak leaf');
  assert.equal(entries[2].name, 'Maple leaf', 'the source review is unchanged');
});

test('bad or empty selections fail before an import can archive anything', () => {
  assert.throws(() => selectReviewed([entry('p1-1', { suggest: 'cut' })]), /empty selection/);
  assert.throws(() => selectReviewed([entry('p1-1')], { reject: [], add: ['p999-1'], edits: {} }), /unknown emblem/);
  assert.throws(() => selectReviewed([entry('p1-1', { tags: [] })]), /search tags/);
  assert.throws(() => selectReviewed([entry('p1-1', { category: 'invalid' })]), /category/);
});

test('part placements account for flag aspect and clip only to the flag edges', () => {
  const box = partBox({ size: 0.4, aspect: 1, x: 0.5, y: 0.5 }, 1.5);
  assert.ok(Math.abs(box[0] - (0.5 - 0.4 / 3)) < 1e-9);
  assert.ok(Math.abs(box[2] - (0.5 + 0.4 / 3)) < 1e-9);
  assert.deepEqual([box[1], box[3]], [0.3, 0.7]);
  assert.equal(partBox({ size: 0.4, aspect: 1, x: 0.05, y: 0.5 }, 1.5)[0], 0);
  assert.throws(() => partBox({ size: 0.4, aspect: 1, x: 0.5, y: 0.5 }, 0), /geometry/);
});

test('stars are found by their drawing and tags, including the Yugoslav star', () => {
  const star = { name: 'Red star with gold border', tags: ['star', 'five-pointed', 'communist', 'yugoslavia'], names: ['Yugoslavia (1946–1992)'] };
  for (const query of ['star', 'stars', 'communist', 'yugoslavia', 'five pointed', 'gold star']) assert.ok(emblemSearchScore(star, query) > 0, query);
  assert.equal(emblemSearchScore(star, 'star eagle'), 0, 'all search words must match');
  assert.ok(emblemSearchScore(star, 'star') > emblemSearchScore({ name: 'Eagle', names: ['Star City'] }, 'star'));
});

test('fleur-de-lis spellings, punctuation and diacritics remain searchable', () => {
  const fleur = { name: 'Fleur-de-lis', tags: ['lily'], names: ['Québec'] };
  for (const query of ['fleur de lis', 'fleurs-de-lys', 'quebec']) assert.ok(emblemSearchScore(fleur, query) > 0, query);
  assert.doesNotThrow(() => emblemSearchScore(fleur, '[.*+?'));
});
