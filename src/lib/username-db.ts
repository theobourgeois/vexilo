import { and, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  FALLBACK_USERNAME,
  USERNAME_MAX,
  firstFreeUsername,
  usernameBase,
} from '@/lib/username';

export const USERNAME_INDEX = 'user_name_unique';

export async function isUsernameTaken(username: string, exceptUserId?: string | null) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`lower(${users.name}) = lower(${username})`,
        exceptUserId ? ne(users.id, exceptUserId) : undefined,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** A free username built from a free-form name, e.g. a Google profile name. */
export async function availableUsername(source: string | null | undefined) {
  const base = usernameBase(source) || FALLBACK_USERNAME;
  // `_` is a LIKE wildcard, so this over-matches a little, which is harmless.
  const prefix = base.slice(0, USERNAME_MAX - 6).toLowerCase();
  const rows = await db
    .select({ name: sql<string>`lower(${users.name})` })
    .from(users)
    .where(sql`lower(${users.name}) like ${`${prefix}%`}`);
  return firstFreeUsername(base, new Set(rows.map((row) => row.name)));
}

/** Postgres unique violation on the username index (lost a race for a name). */
export function isUsernameConflict(error: unknown) {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const { code, constraint } = (cause ?? {}) as { code?: string; constraint?: string };
  return code === '23505' && constraint === USERNAME_INDEX;
}
