import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emblemSearchScore, mixEmblemCategories } from '../../src/lib/emblem-search';
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

test('All browsing separates repeated subjects and preserves every drawing and its category ranking', () => {
  const entries = [
    { id: 'star-1', category: 'stars' }, { id: 'star-2', category: 'stars' }, { id: 'star-3', category: 'stars' },
    { id: 'lily-1', category: 'plants' }, { id: 'lily-2', category: 'plants' },
    { id: 'eagle', category: 'birds' }, { id: 'lion', category: 'animals' },
  ];
  const original = [...entries];
  const mixed = mixEmblemCategories(entries);
  assert.equal(new Set(mixed.slice(0, 4).map((e) => e.category)).size, 4);
  assert.deepEqual(mixed.filter((e) => e.category === 'stars').map((e) => e.id), ['star-1', 'star-2', 'star-3']);
  assert.deepEqual(new Set(mixed.map((e) => e.id)), new Set(entries.map((e) => e.id)));
  assert.equal(mixed.length, entries.length);
  assert.deepEqual(entries, original, 'ranking input remains unchanged');
  assert.deepEqual(mixEmblemCategories(entries), mixed, 'browsing order stays stable');
});
