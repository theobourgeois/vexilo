/** The first day of the daily games; it's puzzle #1. */
export const DAILY_EPOCH = '2026-10-22';

const DAY = 24 * 60 * 60 * 1000;

/** The player's own date, as YYYY-MM-DD. Each day's puzzle changes at their local midnight. */
export function localDate(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Days since the first puzzle. */
export const dayIndex = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`)) / DAY);

export const puzzleNumber = (date: string) => dayIndex(date) + 1;

/** Somewhere in the world it's this date right now, and it's not before the games began. */
export function isPlayableDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return false;
  if (dayIndex(date) < 0) return false;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.abs(Date.parse(`${date}T00:00:00Z`) - today) <= DAY;
}

/** The day before, as YYYY-MM-DD. */
export const previousDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - DAY).toISOString().slice(0, 10);

/** A small seeded random number generator (mulberry32). */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: () => number) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Time left until the player's next midnight, as "5h 12m". */
export function untilTomorrow(now = new Date()) {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const minutes = Math.max(0, Math.ceil((midnight.getTime() - now.getTime()) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
