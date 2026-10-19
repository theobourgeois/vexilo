'use server';

import { db } from '@/db';
import { type FlagTimelineEvent, flagTimelines, flags } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

type LinkedFlag = { id: string; name: string; image: string };

export type FlagTimelineView = {
  /** The flag the timeline belongs to (its current flag). */
  owner: LinkedFlag;
  /** Set when the page is one of the owner's older versions, so the timeline can point it out. */
  viewingVersionId: string | null;
  events: (FlagTimelineEvent & { version: LinkedFlag | null })[];
};

/**
 * The timeline for a flag page. A flag shows its own timeline; an older version (e.g. "Libya (1972–1977)")
 * shows the timeline of the flag it belongs to. Version links are resolved here, so renamed flags still link.
 */
export async function getFlagTimeline(flagId: string): Promise<FlagTimelineView | null> {
  const columns = { flagId: flagTimelines.flagId, events: flagTimelines.events };
  const ok = eq(flagTimelines.status, 'ok');

  let viewingVersionId: string | null = null;
  let [row] = await db
    .select(columns)
    .from(flagTimelines)
    .where(and(eq(flagTimelines.flagId, flagId), ok))
    .limit(1);
  if (!row) {
    [row] = await db
      .select(columns)
      .from(flagTimelines)
      .where(and(ok, sql`${flagTimelines.events} @> ${JSON.stringify([{ versionFlagId: flagId }])}::jsonb`))
      .limit(1);
    if (!row) return null;
    viewingVersionId = flagId;
  }

  const versionIds = row.events.flatMap((event) => (event.versionFlagId ? [event.versionFlagId] : []));
  const linked = await db
    .select({ id: flags.id, name: flags.name, image: flags.image })
    .from(flags)
    .where(inArray(flags.id, [row.flagId, ...versionIds]));
  const byId = new Map(linked.map((flag) => [flag.id, flag]));
  const owner = byId.get(row.flagId);
  if (!owner) return null;

  return {
    owner,
    viewingVersionId,
    events: row.events.map((event) => ({
      ...event,
      version: event.versionFlagId ? (byId.get(event.versionFlagId) ?? null) : null,
    })),
  };
}
