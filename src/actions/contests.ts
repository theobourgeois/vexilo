'use server';

import { createHash } from 'crypto';
import { unstable_cache } from 'next/cache';
import { headers } from 'next/headers';
import { and, count, desc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { bannedUsers, contestEntries, contests, contestVotes, users } from '@/db/schema';
import { getServerAuthSession } from '@/lib/auth';
import { CONTESTS_TAG, toDate } from '@/lib/cache-tags';
import { CLOUD_FRONT_URL } from '@/lib/constant';
import { contestPhase, seededShuffle, STATEMENT_MAX, type ContestPhase } from '@/lib/contest';
import type { StoredStudioDesign, StudioDesign } from '@/lib/studio-design';
import { studioDesignSchema } from '@/lib/studio-design-schema';
import { deleteFileFromUrl, uploadFile } from './s3';

type ContestRow = typeof contests.$inferSelect;

export type ContestSummary = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  brief: string;
  rules: string[];
  prize: string;
  startsAt: Date;
  votingStartsAt: Date;
  endsAt: Date;
  votesPerVoter: number;
  phase: ContestPhase;
  entryCount: number;
};

export type ContestDesigner = { name: string; image: string | null; userNumber: string };

/** An entry as voters see it: no designer until the winner is announced. */
export type AnonymousEntry = { id: string; title: string; statement: string; image: string; mine: boolean };

export type NamedEntry = Omit<AnonymousEntry, 'mine'> & { designer: ContestDesigner; flagId: string | null };

export type MyEntry = { id: string; title: string; statement: string; image: string; design: StoredStudioDesign };

export type ContestView = {
  contest: ContestSummary;
  myEntry: MyEntry | null;
  signedIn: boolean;
  /** Voting and judging: everyone's entries without names, in this viewer's own order. */
  entries: AnonymousEntry[];
  /** Voting: the entries this viewer voted for. */
  myVotes: string[];
  /** Results only. Vote counts are never sent to the browser. */
  winner: NamedEntry | null;
  finalists: NamedEntry[];
};

function summarize(contest: ContestRow, entryCount: number): ContestSummary {
  return {
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    theme: contest.theme,
    brief: contest.brief,
    rules: contest.rules,
    prize: contest.prize,
    startsAt: contest.startsAt,
    votingStartsAt: contest.votingStartsAt,
    endsAt: contest.endsAt,
    votesPerVoter: contest.votesPerVoter,
    phase: contestPhase(contest),
    entryCount,
  };
}

async function activeEntryCount(contestId: string) {
  const [row] = await db
    .select({ count: count() })
    .from(contestEntries)
    .where(and(eq(contestEntries.contestId, contestId), eq(contestEntries.status, 'active')));
  return row?.count ?? 0;
}

/** A salted hash of the caller's network address, so admins can spot sock puppets without storing IPs. */
async function networkHash() {
  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip');
  if (!ip) return null;
  return createHash('sha256')
    .update(`${process.env.NEXTAUTH_SECRET ?? 'vexilo'}:${ip}`)
    .digest('hex');
}

/** Signed in with a real (not guest) account that isn't banned. */
async function participant() {
  const session = await getServerAuthSession();
  if (!session?.user) return { ok: false as const, message: 'Sign in to take part.' };
  const [user] = await db
    .select({ id: users.id, isAnonymous: users.isAnonymous })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user || user.isAnonymous) return { ok: false as const, message: 'Sign in with an account to take part.' };
  const [ban] = await db.select({ id: bannedUsers.id }).from(bannedUsers).where(eq(bannedUsers.userId, user.id)).limit(1);
  if (ban) return { ok: false as const, message: 'Your account can’t take part in contests.' };
  return { ok: true as const, userId: user.id };
}

async function contestBySlug(slug: string) {
  const [contest] = await db.select().from(contests).where(eq(contests.slug, slug)).limit(1);
  return contest;
}

/**
 * The contest to promote right now: one that's running, else the next one coming up,
 * else the latest finished one.
 */
type CurrentContest = ContestSummary & { winnerImage: string | null; announcedAt: Date | null };

export async function getCurrentContest(): Promise<CurrentContest | null> {
  const contest = await getCachedCurrentContest();
  return (
    contest && {
      ...contest,
      startsAt: toDate(contest.startsAt),
      votingStartsAt: toDate(contest.votingStartsAt),
      endsAt: toDate(contest.endsAt),
      announcedAt: toDate(contest.announcedAt),
    }
  );
}

// Shown on Browse for everyone, so it's cached briefly; contest admin actions expire it.
const getCachedCurrentContest = unstable_cache(readCurrentContest, ['current-contest-v1'], {
  revalidate: 60 * 5,
  tags: [CONTESTS_TAG],
});

async function readCurrentContest(): Promise<CurrentContest | null> {
  const rows = await db.select().from(contests).where(eq(contests.published, true)).orderBy(desc(contests.startsAt)).limit(12);
  if (!rows.length) return null;
  const withPhase = rows.map((row) => ({ row, phase: contestPhase(row) }));
  const pick =
    withPhase.find(({ phase }) => phase === 'open' || phase === 'voting' || phase === 'judging') ??
    withPhase.filter(({ phase }) => phase === 'upcoming').at(-1) ??
    withPhase.find(({ phase }) => phase === 'results');
  if (!pick) return null;
  const { row } = pick;
  const [entryCount, winner] = await Promise.all([
    activeEntryCount(row.id),
    pick.phase === 'results' && row.winnerEntryId
      ? db
          .select({ image: contestEntries.image })
          .from(contestEntries)
          .where(eq(contestEntries.id, row.winnerEntryId))
          .then((res) => res[0])
      : undefined,
  ]);
  return { ...summarize(row, entryCount), winnerImage: winner?.image ?? null, announcedAt: row.announcedAt };
}

export type ArchivedContest = ContestSummary & { winner: { title: string; image: string; designer: string } | null };

/** Every published contest, newest first, with winners for the finished ones. */
export async function getContestArchive(): Promise<ArchivedContest[]> {
  const rows = await db.select().from(contests).where(eq(contests.published, true)).orderBy(desc(contests.startsAt));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [counts, winners] = await Promise.all([
    db
      .select({ contestId: contestEntries.contestId, count: count() })
      .from(contestEntries)
      .where(and(inArray(contestEntries.contestId, ids), eq(contestEntries.status, 'active')))
      .groupBy(contestEntries.contestId),
    db
      .select({ id: contestEntries.id, title: contestEntries.title, image: contestEntries.image, designer: users.name })
      .from(contestEntries)
      .innerJoin(users, eq(users.id, contestEntries.userId))
      .where(
        inArray(
          contestEntries.id,
          rows.flatMap((row) => (row.winnerEntryId && row.announcedAt ? [row.winnerEntryId] : [])).concat(['00000000-0000-0000-0000-000000000000']),
        ),
      ),
  ]);
  return rows.map((row) => {
    const summary = summarize(row, counts.find((c) => c.contestId === row.id)?.count ?? 0);
    const winner = summary.phase === 'results' ? winners.find((w) => w.id === row.winnerEntryId) : undefined;
    return { ...summary, winner: winner ? { title: winner.title, image: winner.image, designer: winner.designer ?? 'Someone' } : null };
  });
}

/** Everything the contest page needs for whichever phase the contest is in. */
export async function getContestView(slug: string): Promise<ContestView | null> {
  const session = await getServerAuthSession();
  const contest = await contestBySlug(slug);
  if (!contest) return null;
  const phase = contestPhase(contest);
  if (phase === 'draft' && !session?.user?.isAdmin) return null;
  const userId = session?.user?.id ?? null;

  const [entryCount, mine] = await Promise.all([
    activeEntryCount(contest.id),
    userId
      ? db
          .select({
            id: contestEntries.id,
            title: contestEntries.title,
            statement: contestEntries.statement,
            image: contestEntries.image,
            design: contestEntries.design,
          })
          .from(contestEntries)
          .where(and(eq(contestEntries.contestId, contest.id), eq(contestEntries.userId, userId)))
          .limit(1)
          .then((res) => res[0] ?? null)
      : null,
  ]);

  const view: ContestView = {
    contest: summarize(contest, entryCount),
    myEntry: mine,
    signedIn: Boolean(userId),
    entries: [],
    myVotes: [],
    winner: null,
    finalists: [],
  };

  if (phase === 'voting' || phase === 'judging') {
    const rows = await db
      .select({
        id: contestEntries.id,
        title: contestEntries.title,
        statement: contestEntries.statement,
        image: contestEntries.image,
        userId: contestEntries.userId,
      })
      .from(contestEntries)
      .where(and(eq(contestEntries.contestId, contest.id), eq(contestEntries.status, 'active')))
      .orderBy(contestEntries.createdAt);
    // Each voter gets their own stable order, so no entry wins by sitting at the top.
    view.entries = seededShuffle(rows, `${contest.id}:${userId ?? 'guest'}`).map(({ userId: owner, ...entry }) => ({
      ...entry,
      mine: owner === userId,
    }));
    if (userId && phase === 'voting') {
      view.myVotes = await db
        .select({ entryId: contestVotes.entryId })
        .from(contestVotes)
        .where(and(eq(contestVotes.contestId, contest.id), eq(contestVotes.userId, userId), isNull(contestVotes.voidedAt)))
        .then((res) => res.map((row) => row.entryId));
    }
  }

  if (phase === 'results') {
    const rows = await db
      .select({
        id: contestEntries.id,
        title: contestEntries.title,
        statement: contestEntries.statement,
        image: contestEntries.image,
        flagId: contestEntries.flagId,
        name: users.name,
        avatar: users.image,
        userNumber: users.userNumber,
      })
      .from(contestEntries)
      .innerJoin(users, eq(users.id, contestEntries.userId))
      .where(and(eq(contestEntries.contestId, contest.id), eq(contestEntries.status, 'active')));
    const named = rows.map(({ name, avatar, userNumber, ...entry }) => ({
      ...entry,
      designer: { name: name ?? 'Someone', image: avatar, userNumber },
    }));
    view.winner = named.find((entry) => entry.id === contest.winnerEntryId) ?? null;
    // A fixed order that has nothing to do with votes, so nobody reads a ranking into it.
    view.finalists = seededShuffle(
      named.filter((entry) => entry.id !== contest.winnerEntryId),
      contest.id,
    );
  }

  return view;
}

const entrySchema = z.object({
  contestId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  statement: z.string().trim().max(STATEMENT_MAX),
  image: z.string().startsWith('data:image/png;base64,').max(12_000_000),
  design: studioDesignSchema,
});

/** Submits (or replaces) the caller's one entry while the contest is open. */
export async function submitContestEntry(input: {
  contestId: string;
  title: string;
  statement: string;
  image: string;
  design: StudioDesign;
}) {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: 'Something about this entry is invalid. Try again.' };
  const who = await participant();
  if (!who.ok) return { success: false as const, message: who.message };

  const [contest] = await db.select().from(contests).where(eq(contests.id, parsed.data.contestId)).limit(1);
  if (!contest || contestPhase(contest) !== 'open') {
    return { success: false as const, message: 'This contest isn’t taking entries right now.' };
  }

  const [existing] = await db
    .select({ id: contestEntries.id, image: contestEntries.image, status: contestEntries.status })
    .from(contestEntries)
    .where(and(eq(contestEntries.contestId, contest.id), eq(contestEntries.userId, who.userId)))
    .limit(1);
  if (existing?.status === 'disqualified') {
    return { success: false as const, message: 'Your entry was removed from this contest, so it can’t be changed.' };
  }

  const key = `contests/${contest.slug}/${who.userId}-${Date.now()}.png`;
  try {
    await uploadFile(Buffer.from(parsed.data.image.split(',')[1], 'base64'), process.env.S3_BUCKET_NAME!, key, 'image/png');
  } catch {
    return { success: false as const, message: 'Couldn’t upload your flag. Try again.' };
  }
  const image = `${CLOUD_FRONT_URL}/${key}`;
  const values = {
    title: parsed.data.title,
    statement: parsed.data.statement,
    image,
    design: parsed.data.design as StudioDesign,
    ipHash: await networkHash(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(contestEntries).set(values).where(eq(contestEntries.id, existing.id));
    deleteFileFromUrl(existing.image).catch(() => {});
  } else {
    await db.insert(contestEntries).values({ ...values, contestId: contest.id, userId: who.userId });
  }
  return { success: true as const, replaced: Boolean(existing), slug: contest.slug };
}

/** Takes the caller's entry out while entries are still open. */
export async function withdrawContestEntry(contestId: string) {
  const who = await participant();
  if (!who.ok) return { success: false as const, message: who.message };
  const [contest] = await db.select().from(contests).where(eq(contests.id, contestId)).limit(1);
  if (!contest || contestPhase(contest) !== 'open') {
    return { success: false as const, message: 'Entries can only be withdrawn while the contest is open.' };
  }
  const [entry] = await db
    .delete(contestEntries)
    .where(and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, who.userId), ne(contestEntries.status, 'disqualified')))
    .returning({ image: contestEntries.image });
  if (entry) deleteFileFromUrl(entry.image).catch(() => {});
  return { success: true as const };
}

/** Votes for an entry, or takes the vote back. Returns the caller's votes afterwards. */
export async function toggleContestVote(entryId: string) {
  if (!z.string().uuid().safeParse(entryId).success) return { success: false as const, message: 'That entry doesn’t exist.' };
  const who = await participant();
  if (!who.ok) return { success: false as const, message: who.message };

  const [entry] = await db
    .select({ id: contestEntries.id, contestId: contestEntries.contestId, userId: contestEntries.userId, status: contestEntries.status })
    .from(contestEntries)
    .where(eq(contestEntries.id, entryId))
    .limit(1);
  if (!entry || entry.status !== 'active') return { success: false as const, message: 'That entry isn’t in the running.' };
  const [contest] = await db.select().from(contests).where(eq(contests.id, entry.contestId)).limit(1);
  if (!contest || contestPhase(contest) !== 'voting') return { success: false as const, message: 'Voting isn’t open.' };
  if (entry.userId === who.userId) return { success: false as const, message: 'You can’t vote for your own entry.' };

  const myVotes = () =>
    db
      .select({ entryId: contestVotes.entryId })
      .from(contestVotes)
      .where(and(eq(contestVotes.contestId, contest.id), eq(contestVotes.userId, who.userId), isNull(contestVotes.voidedAt)))
      .then((res) => res.map((row) => row.entryId));

  const [existing] = await db
    .select({ id: contestVotes.id, voidedAt: contestVotes.voidedAt })
    .from(contestVotes)
    .where(and(eq(contestVotes.entryId, entryId), eq(contestVotes.userId, who.userId)))
    .limit(1);

  if (existing?.voidedAt) {
    // A voided vote stays put so it can't be cast again; it just quietly doesn't count.
    return { success: false as const, message: 'You can’t vote for this entry.' };
  }
  if (existing) {
    await db.delete(contestVotes).where(eq(contestVotes.id, existing.id));
    return { success: true as const, votes: await myVotes() };
  }

  const current = await myVotes();
  if (current.length >= contest.votesPerVoter) {
    return {
      success: false as const,
      message: `You’ve used all ${contest.votesPerVoter} votes. Take one back to change your mind.`,
    };
  }
  await db
    .insert(contestVotes)
    .values({ contestId: contest.id, entryId, userId: who.userId, ipHash: await networkHash() })
    .onConflictDoNothing();
  return { success: true as const, votes: [...current, entryId] };
}

export type StudioContest = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  votingStartsAt: Date;
  entry: { title: string; statement: string; design: StoredStudioDesign } | null;
};

/** The contest the flag maker is entering, with the caller's entry so they can keep editing it. */
export async function getStudioContest(slug: string): Promise<StudioContest | null> {
  const contest = await contestBySlug(slug);
  if (!contest || contestPhase(contest) !== 'open') return null;
  const session = await getServerAuthSession();
  const entry = session?.user
    ? await db
        .select({ title: contestEntries.title, statement: contestEntries.statement, design: contestEntries.design })
        .from(contestEntries)
        .where(and(eq(contestEntries.contestId, contest.id), eq(contestEntries.userId, session.user.id)))
        .limit(1)
        .then((res) => res[0] ?? null)
    : null;
  return { id: contest.id, slug: contest.slug, title: contest.title, theme: contest.theme, votingStartsAt: contest.votingStartsAt, entry };
}

/** Contests someone has won, for the badge on their profile. */
export async function getContestWins(userNumber: string) {
  return db
    .select({ slug: contests.slug, title: contests.title, theme: contests.theme })
    .from(contests)
    .innerJoin(contestEntries, eq(contestEntries.id, contests.winnerEntryId))
    .innerJoin(users, eq(users.id, contestEntries.userId))
    .where(and(eq(users.userNumber, userNumber), eq(contests.published, true), isNotNull(contests.announcedAt)))
    .orderBy(desc(contests.announcedAt));
}
