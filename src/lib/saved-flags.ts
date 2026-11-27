import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { flagRequests, flags, savedFlags } from '@/db/schema';

/**
 * The saved flag a post is for, and what's already posted from it. Not a server action: it trusts
 * `userId`, so callers pass the signed-in user's.
 */
export async function loadSavedFlagForPost(userId: string, id: string) {
  const [row] = await db
    .select({
      id: savedFlags.id,
      image: savedFlags.image,
      flagId: savedFlags.flagId,
      requestId: savedFlags.requestId,
    })
    .from(savedFlags)
    .where(and(eq(savedFlags.id, id), eq(savedFlags.userId, userId)))
    .limit(1);
  if (!row) return null;
  const [request] = row.requestId
    ? await db.select().from(flagRequests).where(eq(flagRequests.id, row.requestId)).limit(1)
    : [];
  const [flag] = row.flagId ? await db.select().from(flags).where(eq(flags.id, row.flagId)).limit(1) : [];
  const relatedFlags = flag?.relatedFlags.length
    ? await db
        .select({ id: flags.id, name: flags.name, image: flags.image })
        .from(flags)
        .where(inArray(flags.id, flag.relatedFlags))
    : [];
  return {
    saved: row,
    pendingRequest: request && !request.approved && !request.deleted && request.userId === userId ? request : null,
    flag: flag ? { ...flag, relatedFlagRows: relatedFlags } : null,
  };
}
