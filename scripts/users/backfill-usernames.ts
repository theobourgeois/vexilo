import 'dotenv/config';

import { sql } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  FALLBACK_USERNAME,
  USERNAME_PATTERN,
  firstFreeUsername,
  isReservedUsername,
  usernameBase,
} from '../../src/lib/username';

/**
 * Turns every user's free-form name into a unique username, so that
 * drizzle/0021_unique_usernames.sql can be applied:
 *   - names that are already valid usernames are kept (oldest account wins a tie)
 *   - others are rewritten: "Théo Bourgeois" -> "Theo_Bourgeois", then "_2", "_3"… on a clash
 *   - names with nothing usable (e.g. only non-Latin letters) become "vexillologist_N"
 *
 * Original names are copied to vexilo_user_name_backup before anything changes.
 * Safe to run again: valid, unique names are left alone.
 *   npm run usernames:backfill -- --dry-run   # print the renames, write nothing
 *   npm run usernames:backfill
 */

const dryRun = process.argv.includes('--dry-run');
for (const arg of process.argv.slice(2)) if (arg !== '--dry-run') throw new Error(`Unknown argument: ${arg}`);

async function main() {
  type Row = { id: string; name: string | null; is_admin: boolean };
  const { rows } = await db.execute<Row>(sql`
    SELECT id, name, is_admin FROM vexilo_user ORDER BY created_at ASC, id ASC
  `);

  const taken = new Set<string>();
  const keep = new Set<string>();
  // Pass 1: existing valid usernames claim their name, oldest account first.
  for (const row of rows) {
    const name = row.name?.trim() ?? '';
    const lower = name.toLowerCase();
    const valid = USERNAME_PATTERN.test(name) && (row.is_admin || !isReservedUsername(name));
    if (valid && !taken.has(lower)) {
      taken.add(lower);
      keep.add(row.id);
    }
  }
  // Pass 2: everyone else gets one derived from their name.
  const renames: { id: string; from: string | null; to: string }[] = [];
  for (const row of rows) {
    if (keep.has(row.id)) {
      if (row.name !== row.name?.trim()) renames.push({ id: row.id, from: row.name, to: row.name!.trim() });
      continue;
    }
    const to = firstFreeUsername(usernameBase(row.name) || FALLBACK_USERNAME, taken);
    taken.add(to.toLowerCase());
    renames.push({ id: row.id, from: row.name, to });
  }

  for (const { from, to } of renames) console.log(`${JSON.stringify(from)} -> ${to}`);
  console.log(`\n${rows.length} users, ${renames.length} to rename${dryRun ? ' (dry run, nothing written)' : ''}.`);
  if (dryRun || renames.length === 0) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vexilo_user_name_backup (
      user_id uuid PRIMARY KEY,
      name varchar(255),
      backed_up_at timestamp NOT NULL DEFAULT now()
    )
  `);
  const values = sql.join(
    renames.map(({ id, from, to }) => sql`(${id}::uuid, ${from}::varchar, ${to}::varchar)`),
    sql`, `,
  );
  // Keep the first original if the script runs more than once.
  await db.execute(sql`
    INSERT INTO vexilo_user_name_backup (user_id, name)
    SELECT id, original FROM (VALUES ${values}) AS v(id, original, username)
    ON CONFLICT (user_id) DO NOTHING
  `);
  // One statement, so the renames land together.
  await db.execute(sql`
    UPDATE vexilo_user u SET name = v.username
    FROM (VALUES ${values}) AS v(id, original, username)
    WHERE u.id = v.id
  `);
  // Pending signups started with a free-form name are fixed up when they're verified.
  console.log(`Renamed ${renames.length}. Now apply drizzle/0021_unique_usernames.sql.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
