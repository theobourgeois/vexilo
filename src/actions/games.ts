'use server';

import { createHash } from 'crypto';
import { db } from '@/db';
import { redis } from '@/db/redis';
import { gameResults } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { dayIndex, isPlayableDate, puzzleNumber, seededRandom, shuffle } from '@/lib/games/daily';
import { CRITERIA, fitsCell, generateGrid, type GridSpec } from '@/lib/games/grid';
import { COUNTRIES, COUNTRY_BY_ID } from '@/lib/games/pool';

// A day's puzzle is kept for a few days, long enough for every time zone to finish it.
const KEEP = 60 * 60 * 24 * 4;

/**
 * The repo is public, so the puzzles are seeded with the server's secret: nobody can work out
 * tomorrow's answer from the code.
 */
function seed(key: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? 'vexilo';
  return createHash('sha256').update(`${secret}:${key}`).digest().readUInt32LE(0);
}

/** The first answer served for a day sticks, even if the pool changes later that day. */
async function pinned<T>(key: string, make: () => T, valid: (value: T) => boolean): Promise<T> {
  const existing = await redis.get<T>(key);
  if (existing && valid(existing)) return existing;
  const value = make();
  await redis.set(key, value, { nx: true, ex: KEEP });
  const stored = await redis.get<T>(key);
  return stored && valid(stored) ? stored : value;
}

function assertDate(date: string) {
  if (!isPlayableDate(date)) throw new Error('That puzzle isn’t available.');
}

function assertPlayer(player: string) {
  if (typeof player !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(player)) throw new Error('Invalid player.');
}

export async function getUnfurlPuzzle(date: string) {
  assertDate(date);
  const answerId = await pinned(
    `games:unfurl:${date}`,
    () => {
      // Every country comes up once before any repeats.
      const day = dayIndex(date);
      const round = Math.floor(day / COUNTRIES.length);
      return shuffle(COUNTRIES, seededRandom(seed(`unfurl:${round}`)))[day % COUNTRIES.length].id;
    },
    (id) => COUNTRY_BY_ID.has(id),
  );
  return { date, number: puzzleNumber(date), answerId };
}

export async function getGridPuzzle(date: string) {
  assertDate(date);
  const grid = await pinned<GridSpec>(
    `games:grid:${date}`,
    () => generateGrid(seededRandom(seed(`grid:${date}`))),
    (spec) => [...spec.rows, ...spec.cols].every((id) => CRITERIA.has(id)),
  );
  return { date, number: puzzleNumber(date), grid };
}

const cellKey = (date: string, cell: number) => `games:grid:${date}:cell:${cell}`;

/** Checks a guess and, if it's right, counts it toward how rare each answer is. */
export async function submitGridGuess(date: string, cell: number, countryId: string, player: string) {
  const country = COUNTRY_BY_ID.get(countryId);
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || !country) throw new Error('Invalid guess.');
  assertPlayer(player);
  const { grid } = await getGridPuzzle(date);

  if ((await redis.set(`games:grid:${date}:player:${player}`, 1, { nx: true, ex: KEEP })) === 'OK') {
    const players = await redis.incr(`games:grid:${date}:players`);
    if (players === 1) await redis.expire(`games:grid:${date}:players`, KEEP);
  }

  if (!fitsCell(grid, cell, country)) return { correct: false as const };

  // Each player counts once per cell, however often the guess is sent.
  const key = cellKey(date, cell);
  if ((await redis.set(`games:grid:${date}:player:${player}:${cell}`, 1, { nx: true, ex: KEEP })) === 'OK') {
    await redis.hincrby(key, countryId, 1);
    await redis.hincrby(key, '_total', 1);
    await redis.expire(key, KEEP);
  }
  const counts = (await redis.hgetall<Record<string, number>>(key)) ?? {};
  return { correct: true as const, percent: percentOf(counts, countryId) };
}

function percentOf(counts: Record<string, number>, id: string) {
  const total = Number(counts._total ?? 0);
  return total ? Math.max(1, Math.round((Number(counts[id] ?? 0) / total) * 100)) : 100;
}

/** How everyone answered each cell, for the end of the game. */
export async function getGridResults(date: string) {
  assertDate(date);
  const [players, ...cells] = await Promise.all([
    redis.get<number>(`games:grid:${date}:players`),
    ...Array.from({ length: 9 }, (_, cell) => redis.hgetall<Record<string, number>>(cellKey(date, cell))),
  ]);
  return {
    players: Number(players ?? 0),
    cells: cells.map((counts) => {
      const all = counts ?? {};
      const top = Object.entries(all)
        .filter(([id]) => id !== '_total')
        .map(([id, count]) => ({ id, count: Number(count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(({ id }) => ({ id, percent: percentOf(all, id) }));
      return { total: Number(all._total ?? 0), top, percents: Object.fromEntries(Object.keys(all).filter((id) => id !== '_total').map((id) => [id, percentOf(all, id)])) };
    }),
  };
}

type Result = Omit<typeof gameResults.$inferInsert, 'id' | 'userId' | 'createdAt'>;

/** Saves a finished game. A player's first result for the day is the one that counts. */
async function saveResult(result: Result) {
  const session = await getServerAuthSession();
  await db
    .insert(gameResults)
    .values({ ...result, userId: session?.user?.id ?? null })
    .onConflictDoNothing({ target: [gameResults.game, gameResults.date, gameResults.player] });
}

/** Records a finished Unfurl. The guesses are checked against the answer rather than trusting the outcome. */
export async function recordUnfurlResult(date: string, guesses: string[], player: string) {
  assertPlayer(player);
  if (!Array.isArray(guesses) || guesses.length > 6 || new Set(guesses).size !== guesses.length || !guesses.every((id) => COUNTRY_BY_ID.has(id))) {
    throw new Error('Invalid guesses.');
  }
  const { answerId } = await getUnfurlPuzzle(date);
  const solved = guesses.includes(answerId);
  const played = solved ? guesses.slice(0, guesses.indexOf(answerId) + 1) : guesses;
  if (!solved && played.length < 6) throw new Error('That game isn’t finished.');
  await saveResult({ game: 'unfurl', date, player, solved, guesses: played.length, score: solved ? played.length : 7, picks: played });
}

/** Records a finished Vexigrid. Each square is checked, so only answers that fit are kept. */
export async function recordGridResult(date: string, picks: (string | null)[], left: number, player: string) {
  assertPlayer(player);
  if (!Array.isArray(picks) || picks.length !== 9 || !Number.isInteger(left) || left < 0 || left > 9) throw new Error('Invalid board.');
  const { grid } = await getGridPuzzle(date);
  const board = picks.map((id, cell) => {
    const country = id ? COUNTRY_BY_ID.get(id) : undefined;
    return country && fitsCell(grid, cell, country) ? country.id : null;
  });
  const filled = board.filter(Boolean);
  if (new Set(filled).size !== filled.length) throw new Error('Invalid board.');
  // Giving up spends whatever guesses were left.
  await saveResult({ game: 'grid', date, player, solved: filled.length === 9, guesses: 9 - left, score: filled.length, picks: board });
}
