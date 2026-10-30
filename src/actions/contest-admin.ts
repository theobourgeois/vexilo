'use server';

import { and, count, desc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { redis } from '@/db/redis';
import { contestEntries, contests, contestVotes, favorites, flagOfTheDay, flagRequests, users } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { CONTEST_TAG, contestPhase, slugify, type ContestPhase } from '@/lib/contest';
import { CUSTOM_TAG } from '@/lib/studio-design';
import { approveFlagRequests } from './requests';
import { CONTESTS_TAG, expireCache } from '@/lib/cache-tags';

async function isAdmin() {
  const session = await getServerAuthSession();
  return Boolean(session?.user?.isAdmin);
}

const NOT_ALLOWED = { success: false as const, message: 'Only admins can do that.' };

export type AdminContestRow = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  phase: ContestPhase;
  startsAt: Date;
  votingStartsAt: Date;
  endsAt: Date;
  entries: number;
  votes: number;
  winnerImage: string | null;
};

export async function listContestsAdmin(): Promise<AdminContestRow[] | null> {
  if (!(await isAdmin())) return null;
  const rows = await db.select().from(contests).orderBy(desc(contests.startsAt));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [entryCounts, voteCounts, winners] = await Promise.all([
    db
      .select({ contestId: contestEntries.contestId, count: count() })
      .from(contestEntries)
      .where(and(inArray(contestEntries.contestId, ids), eq(contestEntries.status, 'active')))
      .groupBy(contestEntries.contestId),
    db
      .select({ contestId: contestVotes.contestId, count: count() })
      .from(contestVotes)
      .where(and(inArray(contestVotes.contestId, ids), isNull(contestVotes.voidedAt)))
      .groupBy(contestVotes.contestId),
    db
      .select({ contestId: contestEntries.contestId, id: contestEntries.id, image: contestEntries.image })
      .from(contestEntries)
      .innerJoin(contests, eq(contests.winnerEntryId, contestEntries.id)),
  ]);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    theme: row.theme,
    phase: contestPhase(row),
    startsAt: row.startsAt,
    votingStartsAt: row.votingStartsAt,
    endsAt: row.endsAt,
    entries: entryCounts.find((c) => c.contestId === row.id)?.count ?? 0,
    votes: voteCounts.find((c) => c.contestId === row.id)?.count ?? 0,
    winnerImage: winners.find((w) => w.contestId === row.id)?.image ?? null,
  }));
}

const contestSchema = z
  .object({
    id: z.string().uuid().nullable(),
    slug: z.string().trim().max(80),
    title: z.string().trim().min(1, 'Give the contest a title.').max(120),
    theme: z.string().trim().min(1, 'Give the contest a theme.').max(160),
    brief: z.string().trim().max(4000),
    rules: z.array(z.string().trim().min(1).max(300)).max(15),
    prize: z.string().trim().max(200),
    startsAt: z.coerce.date(),
    votingStartsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    votesPerVoter: z.number().int().min(1).max(10),
    published: z.boolean(),
  })
  .refine((c) => c.startsAt < c.votingStartsAt && c.votingStartsAt < c.endsAt, {
    message: 'Dates must go: entries open, then voting opens, then voting closes.',
  });

export type ContestInput = z.input<typeof contestSchema>;

/** Creates a contest, or updates one when `id` is set. */
export async function saveContest(input: ContestInput) {
  if (!(await isAdmin())) return NOT_ALLOWED;
  const parsed = contestSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;
  const slug = slugify(data.slug || data.title);
  if (!slug) return { success: false as const, message: 'The contest needs a link name.' };

  const [clash] = await db
    .select({ id: contests.id })
    .from(contests)
    .where(id ? and(eq(contests.slug, slug), ne(contests.id, id)) : eq(contests.slug, slug))
    .limit(1);
  if (clash) return { success: false as const, message: `Another contest already uses /contest/${slug}.` };

  if (id) {
    await db
      .update(contests)
      .set({ ...data, slug, updatedAt: new Date() })
      .where(eq(contests.id, id));
    expireCache(CONTESTS_TAG);
    return { success: true as const, id, slug };
  }
  const [created] = await db.insert(contests).values({ ...data, slug }).returning({ id: contests.id });
  expireCache(CONTESTS_TAG);
  return { success: true as const, id: created.id, slug };
}

/** Deletes a contest nobody has entered yet. Contests with entries can be unpublished instead. */
export async function deleteContest(id: string) {
  if (!(await isAdmin())) return NOT_ALLOWED;
  const [entries] = await db.select({ count: count() }).from(contestEntries).where(eq(contestEntries.contestId, id));
  if (entries.count > 0) return { success: false as const, message: 'People have entered this contest. Unpublish it instead.' };
  await db.delete(contests).where(eq(contests.id, id));
  expireCache(CONTESTS_TAG);
  return { success: true as const };
}

export type VoterSignal = 'new-account' | 'no-history' | 'entrant-network' | 'shared-network';

export type AdminEntry = {
  id: string;
  title: string;
  statement: string;
  image: string;
  status: 'active' | 'disqualified';
  statusReason: string;
  createdAt: Date;
  flagId: string | null;
  designer: { id: string; name: string; email: string; image: string | null; userNumber: string };
  /** Votes that count. */
  votes: number;
  /** Counted votes from voters with at least one warning sign. */
  flaggedVotes: number;
  voidedVotes: number;
  rank: number;
};

export type AdminVoter = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  userNumber: string;
  joinedAt: Date;
  signals: VoterSignal[];
  /** How many other voters share a network with this one. */
  sharedWith: number;
  votes: { id: string; entryId: string; createdAt: Date; voidedAt: Date | null; voidReason: string }[];
};

export type ContestAdminView = {
  contest: typeof contests.$inferSelect & { phase: ContestPhase };
  entries: AdminEntry[];
  voters: AdminVoter[];
  totals: { votes: number; voided: number; voters: number; flaggedVoters: number };
};

/** The full picture for one contest: entries with live tallies and every voter with warning signs. */
export async function getContestAdmin(id: string): Promise<ContestAdminView | null> {
  if (!(await isAdmin())) return null;
  const [contest] = await db.select().from(contests).where(eq(contests.id, id)).limit(1);
  if (!contest) return null;

  const [entryRows, voteRows] = await Promise.all([
    db
      .select({
        id: contestEntries.id,
        title: contestEntries.title,
        statement: contestEntries.statement,
        image: contestEntries.image,
        status: contestEntries.status,
        statusReason: contestEntries.statusReason,
        createdAt: contestEntries.createdAt,
        flagId: contestEntries.flagId,
        ipHash: contestEntries.ipHash,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatar: users.image,
        userNumber: users.userNumber,
      })
      .from(contestEntries)
      .innerJoin(users, eq(users.id, contestEntries.userId))
      .where(eq(contestEntries.contestId, id))
      .orderBy(contestEntries.createdAt),
    db
      .select({
        id: contestVotes.id,
        entryId: contestVotes.entryId,
        ipHash: contestVotes.ipHash,
        createdAt: contestVotes.createdAt,
        voidedAt: contestVotes.voidedAt,
        voidReason: contestVotes.voidReason,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatar: users.image,
        userNumber: users.userNumber,
        joinedAt: users.createdAt,
      })
      .from(contestVotes)
      .innerJoin(users, eq(users.id, contestVotes.userId))
      .where(eq(contestVotes.contestId, id))
      .orderBy(contestVotes.createdAt),
  ]);

  const voterIds = [...new Set(voteRows.map((vote) => vote.userId))];
  const [favouriteCounts, requestCounts] = voterIds.length
    ? await Promise.all([
        db
          .select({ userId: favorites.userId, count: count() })
          .from(favorites)
          .where(inArray(favorites.userId, voterIds))
          .groupBy(favorites.userId),
        db
          .select({ userId: flagRequests.userId, count: count() })
          .from(flagRequests)
          .where(inArray(flagRequests.userId, voterIds))
          .groupBy(flagRequests.userId),
      ])
    : [[], []];

  // Who else voted from each network.
  const votersByNetwork = new Map<string, Set<string>>();
  for (const vote of voteRows) {
    if (!vote.ipHash) continue;
    if (!votersByNetwork.has(vote.ipHash)) votersByNetwork.set(vote.ipHash, new Set());
    votersByNetwork.get(vote.ipHash)!.add(vote.userId);
  }
  const entrantNetwork = new Map(entryRows.map((entry) => [entry.id, entry.ipHash]));

  const voters = new Map<string, AdminVoter>();
  for (const vote of voteRows) {
    let voter = voters.get(vote.userId);
    if (!voter) {
      voter = {
        id: vote.userId,
        name: vote.name ?? 'Unnamed',
        email: vote.email,
        image: vote.avatar,
        userNumber: vote.userNumber,
        joinedAt: vote.joinedAt,
        signals: [],
        sharedWith: 0,
        votes: [],
      };
      voters.set(vote.userId, voter);
    }
    voter.votes.push({ id: vote.id, entryId: vote.entryId, createdAt: vote.createdAt, voidedAt: vote.voidedAt, voidReason: vote.voidReason });
    const entrant = entrantNetwork.get(vote.entryId);
    if (vote.ipHash && entrant && vote.ipHash === entrant && !voter.signals.includes('entrant-network')) voter.signals.push('entrant-network');
    const shared = vote.ipHash ? (votersByNetwork.get(vote.ipHash)?.size ?? 1) - 1 : 0;
    voter.sharedWith = Math.max(voter.sharedWith, shared);
  }
  for (const voter of voters.values()) {
    if (voter.joinedAt > contest.startsAt) voter.signals.unshift('new-account');
    const history =
      (favouriteCounts.find((c) => c.userId === voter.id)?.count ?? 0) + (requestCounts.find((c) => c.userId === voter.id)?.count ?? 0);
    if (history === 0) voter.signals.push('no-history');
    if (voter.sharedWith > 0) voter.signals.push('shared-network');
  }
  const flaggedVoters = new Set([...voters.values()].filter((voter) => voter.signals.length > 0).map((voter) => voter.id));
  const entries: AdminEntry[] = entryRows.map((entry) => {
    const votes = voteRows.filter((vote) => vote.entryId === entry.id);
    const counted = votes.filter((vote) => !vote.voidedAt);
    return {
      id: entry.id,
      title: entry.title,
      statement: entry.statement,
      image: entry.image,
      status: entry.status,
      statusReason: entry.statusReason,
      createdAt: entry.createdAt,
      flagId: entry.flagId,
      designer: { id: entry.userId, name: entry.name ?? 'Unnamed', email: entry.email, image: entry.avatar, userNumber: entry.userNumber },
      votes: counted.length,
      flaggedVotes: counted.filter((vote) => flaggedVoters.has(vote.userId)).length,
      voidedVotes: votes.length - counted.length,
      rank: 0,
    };
  });
  const ranked = entries
    .filter((entry) => entry.status === 'active')
    .sort((a, b) => b.votes - a.votes || a.createdAt.getTime() - b.createdAt.getTime());
  ranked.forEach((entry, index) => {
    // Ties share a rank.
    entry.rank = index > 0 && ranked[index - 1].votes === entry.votes ? ranked[index - 1].rank : index + 1;
  });
  entries.sort((a, b) => (a.rank || 999) - (b.rank || 999));

  const voterList = [...voters.values()].sort((a, b) => b.signals.length - a.signals.length || a.name.localeCompare(b.name));
  return {
    contest: { ...contest, phase: contestPhase(contest) },
    entries,
    voters: voterList,
    totals: {
      votes: voteRows.filter((vote) => !vote.voidedAt).length,
      voided: voteRows.filter((vote) => vote.voidedAt).length,
      voters: voterList.length,
      flaggedVoters: flaggedVoters.size,
    },
  };
}

/** Stops votes counting. They're kept (and can be restored), and the voter can't recast them. */
export async function voidVotes(voteIds: string[], reason: string) {
  if (!(await isAdmin())) return NOT_ALLOWED;
  if (!voteIds.length) return { success: true as const, count: 0 };
  const rows = await db
    .update(contestVotes)
    .set({ voidedAt: new Date(), voidReason: reason.trim().slice(0, 200) })
    .where(and(inArray(contestVotes.id, voteIds), isNull(contestVotes.voidedAt)))
    .returning({ id: contestVotes.id });
  return { success: true as const, count: rows.length };
}

export async function restoreVotes(voteIds: string[]) {
  if (!(await isAdmin())) return NOT_ALLOWED;
  if (!voteIds.length) return { success: true as const, count: 0 };
  const rows = await db
    .update(contestVotes)
    .set({ voidedAt: null, voidReason: '' })
    .where(and(inArray(contestVotes.id, voteIds), isNotNull(contestVotes.voidedAt)))
    .returning({ id: contestVotes.id });
  return { success: true as const, count: rows.length };
}

/** Removes an entry from the running (its votes stop mattering), or puts it back. */
export async function setEntryStatus(entryId: string, status: 'active' | 'disqualified', reason = '') {
  if (!(await isAdmin())) return NOT_ALLOWED;
  const [entry] = await db.select({ contestId: contestEntries.contestId }).from(contestEntries).where(eq(contestEntries.id, entryId)).limit(1);
  if (!entry) return { success: false as const, message: 'That entry no longer exists.' };
  await db
    .update(contestEntries)
    .set({ status, statusReason: status === 'disqualified' ? reason.trim().slice(0, 200) : '', updatedAt: new Date() })
    .where(eq(contestEntries.id, entryId));
  if (status === 'disqualified') {
    // A disqualified entry can't stay the winner.
    await db
      .update(contests)
      .set({ winnerEntryId: null, announcedAt: null, updatedAt: new Date() })
      .where(and(eq(contests.id, entry.contestId), eq(contests.winnerEntryId, entryId)));
  }
  return { success: true as const };
}

/** Picks the winner. Defaults to the top of the tally in the admin view, but any entry in the running can win. */
export async function setContestWinner(contestId: string, entryId: string | null) {
  if (!(await isAdmin())) return NOT_ALLOWED;
  if (entryId) {
    const [entry] = await db
      .select({ id: contestEntries.id })
      .from(contestEntries)
      .where(and(eq(contestEntries.id, entryId), eq(contestEntries.contestId, contestId), eq(contestEntries.status, 'active')))
      .limit(1);
    if (!entry) return { success: false as const, message: 'That entry isn’t in the running.' };
  }
  await db
    .update(contests)
    .set({ winnerEntryId: entryId, ...(entryId ? {} : { announcedAt: null }), updatedAt: new Date() })
    .where(eq(contests.id, contestId));
  expireCache(CONTESTS_TAG);
  return { success: true as const };
}

/** Shows the winner on the site. Voting has to be over first. */
export async function announceContest(contestId: string, announce: boolean) {
  if (!(await isAdmin())) return NOT_ALLOWED;
  const [contest] = await db.select().from(contests).where(eq(contests.id, contestId)).limit(1);
  if (!contest) return { success: false as const, message: 'That contest no longer exists.' };
  if (announce) {
    if (!contest.winnerEntryId) return { success: false as const, message: 'Pick a winner first.' };
    if (new Date() < contest.endsAt) return { success: false as const, message: 'Voting is still open.' };
    if (!contest.published) return { success: false as const, message: 'Publish the contest first.' };
  }
  await db
    .update(contests)
    .set({ announcedAt: announce ? new Date() : null, updatedAt: new Date() })
    .where(eq(contests.id, contestId));
  expireCache(CONTESTS_TAG);
  return { success: true as const };
}

/**
 * Adds entries to Browse as flags credited to their designers (tagged `custom` and
 * `design contest`). Skips entries that are already published.
 */
export async function publishContestEntries(contestId: string, entryIds: string[]) {
  if (!(await isAdmin())) return NOT_ALLOWED;
  const [contest] = await db.select().from(contests).where(eq(contests.id, contestId)).limit(1);
  if (!contest) return { success: false as const, message: 'That contest no longer exists.' };
  const entries = await db
    .select()
    .from(contestEntries)
    .where(
      and(
        eq(contestEntries.contestId, contestId),
        inArray(contestEntries.id, entryIds.length ? entryIds : ['00000000-0000-0000-0000-000000000000']),
        eq(contestEntries.status, 'active'),
        isNull(contestEntries.flagId),
      ),
    );
  if (!entries.length) return { success: true as const, published: 0 };

  const requests = await db
    .insert(flagRequests)
    .values(
      entries.map((entry) => {
        const won = entry.id === contest.winnerEntryId && contest.announcedAt;
        const intro = won
          ? `Winner of the Vexilo ${contest.title} design contest: “${contest.theme}”.`
          : `Entry in the Vexilo ${contest.title} design contest: “${contest.theme}”.`;
        return {
          userId: entry.userId,
          userMessage: `Contest entry: ${contest.title}`,
          flag: {
            flagName: entry.title,
            flagImage: entry.image,
            index: -1,
            link: '',
            sources: [],
            tags: [CUSTOM_TAG, CONTEST_TAG],
            description: entry.statement ? `${intro}\n\n${entry.statement}` : intro,
            relatedFlags: [],
            remixOf: null,
            design: entry.design,
          },
        };
      }),
    )
    .returning({ id: flagRequests.id });

  const result = await approveFlagRequests(requests.map((request) => request.id));
  if (!result) return NOT_ALLOWED;
  const published = await db
    .select({ id: flagRequests.id, flagId: flagRequests.flagId })
    .from(flagRequests)
    .where(inArray(flagRequests.id, result.approved));
  // Requests come back in insert order, matching `entries`.
  for (const [index, request] of requests.entries()) {
    const flagId = published.find((row) => row.id === request.id)?.flagId;
    if (flagId) await db.update(contestEntries).set({ flagId }).where(eq(contestEntries.id, entries[index].id));
  }
  return { success: true as const, published: published.length, failed: result.failed.length };
}

/** Makes the winning flag today's flag of the day. The winner has to be published to Browse first. */
export async function featureContestWinner(contestId: string) {
  if (!(await isAdmin())) return NOT_ALLOWED;
  const [winner] = await db
    .select({ flagId: contestEntries.flagId })
    .from(contests)
    .innerJoin(contestEntries, eq(contestEntries.id, contests.winnerEntryId))
    .where(eq(contests.id, contestId))
    .limit(1);
  if (!winner) return { success: false as const, message: 'Pick a winner first.' };
  if (!winner.flagId) return { success: false as const, message: 'Publish the winner to Browse first.' };
  await db.insert(flagOfTheDay).values({ flagId: winner.flagId });
  await redis.del('fotd');
  expireCache(CONTESTS_TAG);
  return { success: true as const };
}
