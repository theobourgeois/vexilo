import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstFreeUsername, usernameBase, usernameSchema, withSuffix } from './username';

test('free-form names become usernames', () => {
  const cases: [string, string][] = [
    ['Théo Bourgeois', 'Theo_Bourgeois'],
    ['Mariusz U.', 'Mariusz_U'],
    ["O'Brien-Smith", 'O_Brien_Smith'],
    ['Степан Сычёв', 'Stepan_Sychev'],
    ['Κώστας', 'Kostas'],
    ['Wilhelm Adolf Urban von Stülpnagel-Finckenstein', 'Wilhelm_Adolf_Urban_von'],
    ['大石八重子', ''],
    ['t', ''],
  ];
  for (const [name, username] of cases) assert.equal(usernameBase(name), username, name);
});

test('clashes and reserved names get a number, within the length limit', () => {
  assert.equal(firstFreeUsername('flagfan', new Set()), 'flagfan');
  assert.equal(firstFreeUsername('FlagFan', new Set(['flagfan', 'flagfan_2'])), 'FlagFan_3');
  assert.equal(firstFreeUsername('admin', new Set()), 'admin_2');
  assert.equal(withSuffix('Andres_Villanueva_Herrera', 12), 'Andres_Villanueva_Her_12');
  assert.ok(withSuffix('a'.repeat(24), 100).length <= 24);
});

test('usernames have no spaces and are 3–24 letters, numbers or underscores', () => {
  for (const ok of ['vexi', 'Theo_B', 'abc', 'a'.repeat(24)]) assert.equal(usernameSchema.safeParse(ok).success, true, ok);
  for (const bad of ['ab', 'has space', 'émile', 'a'.repeat(25), 'dash-name', 'Admin', 'anonymous'])
    assert.equal(usernameSchema.safeParse(bad).success, false, bad);
});
