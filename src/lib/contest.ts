/**
 * Design contest timing, shared by the server and the browser. A contest moves through its
 * phases by date alone; only the last step (showing the winner) waits for an admin.
 */

export type ContestPhase = 'draft' | 'upcoming' | 'open' | 'voting' | 'judging' | 'results';

export type ContestTiming = {
  published: boolean;
  startsAt: Date;
  votingStartsAt: Date;
  endsAt: Date;
  announcedAt: Date | null;
  winnerEntryId: string | null;
};

export const CONTEST_TAG = 'design contest';
export const STATEMENT_MAX = 280;
export const DEFAULT_RULES = [
  'One entry per person. You can change it until submissions close.',
  'Make it in the Vexilo flag maker. Your own uploaded images are fine if you made them.',
  'No real flags with small tweaks, no hateful or explicit symbols.',
  'Entries stay anonymous until the winner is announced.',
  'Vote with your account only, and not for your own entry. Suspicious votes are removed.',
];

export function contestPhase(contest: ContestTiming, now = new Date()): ContestPhase {
  if (!contest.published) return 'draft';
  if (contest.announcedAt && contest.winnerEntryId) return 'results';
  if (now < contest.startsAt) return 'upcoming';
  if (now < contest.votingStartsAt) return 'open';
  if (now < contest.endsAt) return 'voting';
  return 'judging';
}

/** When the current phase ends, or null when nothing is scheduled next. */
export function phaseEndsAt(contest: Pick<ContestTiming, 'startsAt' | 'votingStartsAt' | 'endsAt'>, phase: ContestPhase) {
  if (phase === 'upcoming') return contest.startsAt;
  if (phase === 'open') return contest.votingStartsAt;
  if (phase === 'voting') return contest.endsAt;
  return null;
}

export const PHASE_LABEL: Record<ContestPhase, string> = {
  draft: 'Draft',
  upcoming: 'Coming soon',
  open: 'Open for entries',
  voting: 'Voting',
  judging: 'Picking a winner',
  results: 'Winner announced',
};

/** "3 days", "5 hours", "12 minutes" until `date`. */
export function timeLeft(date: Date, now = new Date()) {
  const ms = Math.max(0, date.getTime() - now.getTime());
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 2) return `${days} days`;
  if (hours >= 2) return `${hours} hours`;
  if (hours === 1) return '1 hour';
  return minutes === 1 ? '1 minute' : `${Math.max(minutes, 1)} minutes`;
}

/** The parts of a countdown clock. */
export function countdownParts(date: Date, now = new Date()) {
  const seconds = Math.max(0, Math.floor((date.getTime() - now.getTime()) / 1000));
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export function formatContestDate(date: Date, withTime = false) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

/** "Nov 1 – Nov 21" style range. */
export function formatRange(from: Date, to: Date) {
  return `${formatContestDate(from)} – ${formatContestDate(to)}`;
}

/** A small seeded shuffle so everyone sees entries in their own stable order. */
export function seededShuffle<T>(items: T[], seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
