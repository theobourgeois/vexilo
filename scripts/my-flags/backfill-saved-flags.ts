import 'dotenv/config';

import { sql } from 'drizzle-orm';
import { db } from '../../src/db';

/**
 * Fills My Flags with the flags people made in the flag maker before it existed:
 *   - every posted flag that has a design, for whoever posted it (its first approved new-flag request)
 *   - every new flag still waiting for review that has a design
 *
 * Safe to run again: a flag or request already in someone's flags is skipped.
 *   npm run my-flags:backfill -- --dry-run   # count what would be added, write nothing
 *   npm run my-flags:backfill
 *
 * Declined requests are left out: their pictures are deleted when they're declined.
 * Contest entries that were never published are left out too; they live on the contest.
 */

const dryRun = process.argv.includes('--dry-run');
for (const arg of process.argv.slice(2)) if (arg !== '--dry-run') throw new Error(`Unknown argument: ${arg}`);

// The first approved new-flag request for each flag that has a design: who made it.
const posted = sql`
  SELECT DISTINCT ON (f.id)
    fr.user_id,
    LEFT(f.name, 120) AS name,
    f.design,
    f.image,
    f.remix_of,
    f.id AS flag_id,
    fr.id AS request_id,
    fr.created_at,
    GREATEST(f.updated_at, fr.created_at) AS updated_at
  FROM vexilo_flag f
  JOIN vexilo_flag_request fr ON fr.flag_id = f.id::text AND fr.approved AND fr.old_flag IS NULL
  WHERE f.design IS NOT NULL AND length(f.image) <= 1000
  ORDER BY f.id, fr.created_at ASC
`;

// New flags with a design, waiting for a moderator.
const pending = sql`
  SELECT
    fr.user_id,
    LEFT(COALESCE(NULLIF(fr.flag->>'flagName', ''), 'Untitled flag'), 120) AS name,
    fr.flag->'design' AS design,
    fr.flag->>'flagImage' AS image,
    remix.id AS remix_of,
    NULL::uuid AS flag_id,
    fr.id AS request_id,
    fr.created_at,
    fr.updated_at
  FROM vexilo_flag_request fr
  LEFT JOIN vexilo_flag remix ON remix.id::text = fr.flag->>'remixOf'
  WHERE NOT fr.approved AND NOT fr.deleted AND fr.flag_id IS NULL AND fr.old_flag IS NULL
    AND jsonb_typeof(fr.flag->'design') = 'object'
    AND COALESCE(fr.flag->>'flagImage', '') <> '' AND length(fr.flag->>'flagImage') <= 1000
`;

const notYetSaved = (source: ReturnType<typeof sql>) => sql`
  SELECT s.* FROM (${source}) s
  WHERE NOT EXISTS (
    SELECT 1 FROM vexilo_saved_flag sf
    WHERE sf.request_id = s.request_id OR (s.flag_id IS NOT NULL AND sf.flag_id = s.flag_id)
  )
`;

async function count(query: ReturnType<typeof sql>) {
  const result = await db.execute(sql`SELECT count(*)::int AS n FROM (${query}) q`);
  return Number((result.rows[0] as { n: number }).n);
}

async function insert(query: ReturnType<typeof sql>) {
  const result = await db.execute(sql`
    INSERT INTO vexilo_saved_flag (user_id, name, design, image, remix_of, flag_id, request_id, created_at, updated_at)
    SELECT user_id, name, design, image, remix_of, flag_id, request_id, created_at, updated_at FROM (${notYetSaved(query)}) s
    ON CONFLICT DO NOTHING
  `);
  return result.rowCount ?? 0;
}

async function main() {
  const orphans = await count(sql`
    SELECT f.id FROM vexilo_flag f
    WHERE f.design IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM vexilo_flag_request fr WHERE fr.flag_id = f.id::text AND fr.approved AND fr.old_flag IS NULL
    )
  `);
  const postedNew = await count(notYetSaved(posted));
  const pendingNew = await count(notYetSaved(pending));
  console.log(`Posted flags with a design, not yet in My Flags:   ${postedNew}`);
  console.log(`Pending new flags with a design, not yet in My Flags: ${pendingNew}`);
  if (orphans) console.log(`Flags with a design but no approved request to name an owner (skipped): ${orphans}`);

  if (dryRun) {
    console.log('Dry run: nothing written.');
    return;
  }
  const addedPosted = await insert(posted);
  const addedPending = await insert(pending);
  const total = await db.execute(sql`SELECT count(*)::int AS n, count(DISTINCT user_id)::int AS users FROM vexilo_saved_flag`);
  const { n, users } = total.rows[0] as { n: number; users: number };
  console.log(`Added ${addedPosted} posted and ${addedPending} pending flags. My Flags now holds ${n} flags for ${users} ${users === 1 ? 'person' : 'people'}.`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
