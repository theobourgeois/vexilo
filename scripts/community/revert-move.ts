import 'dotenv/config';

import { Client } from 'pg';

/**
 * Undoes one run of scripts/community/move-custom-flags.ts, in one transaction:
 *   - moved flags go back in the encyclopedia (moved_to_post_id cleared)
 *   - posts it created for uploads are deleted (with their likes); saved flags it published get
 *     back the columns they had before
 *   - likes it copied from favorites are removed (the favorites were never touched)
 *   - profile flags it pointed at posts go back to the real flag
 *   - requests it closed are waiting for review again
 *
 * Likes, follows and remixes people made on those posts since are lost with the posts; edits to
 * saved flags it published are kept.
 *
 *   npm run community:revert -- --dry-run            # the latest batch
 *   npm run community:revert -- --batch=<id>
 */

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchArg = args.find((arg) => arg.startsWith('--batch='))?.slice('--batch='.length);
for (const arg of args) if (arg !== '--dry-run' && !arg.startsWith('--batch=')) throw new Error(`Unknown argument: ${arg}`);

type Move = {
  id: number;
  flag_id: string | null;
  post_id: string;
  created_post: boolean;
  previous: {
    slug: string | null;
    description: string;
    tags: string[];
    published_at: string | null;
    likes: number;
    views: number;
    remix_of_post_id: string | null;
  } | null;
  profile_user_ids: string[];
  closed_request_ids: string[];
};

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL lock_timeout = '5s'`);

    const batchId =
      batchArg ??
      (
        await client.query<{ batch_id: string }>(
          `SELECT batch_id FROM vexilo_post_move WHERE reverted_at IS NULL ORDER BY moved_at DESC, id DESC LIMIT 1`,
        )
      ).rows[0]?.batch_id;
    if (!batchId) {
      console.log('Nothing to revert.');
      await client.query('ROLLBACK');
      return;
    }

    const { rows: moves } = await client.query<Move>(
      `SELECT id, flag_id, post_id, created_post, previous, profile_user_ids, closed_request_ids
         FROM vexilo_post_move WHERE batch_id = $1 AND reverted_at IS NULL`,
      [batchId],
    );
    if (moves.length === 0) throw new Error(`Batch ${batchId} has nothing left to revert.`);

    const postIds = moves.map((move) => move.post_id);
    const flagIds = moves.flatMap((move) => (move.flag_id ? [move.flag_id] : []));
    const requestIds = moves.flatMap((move) => move.closed_request_ids);

    // Back in the encyclopedia first, so nothing points at a post that's about to go.
    const flagsBack = await client.query(
      `UPDATE vexilo_flag SET moved_to_post_id = NULL WHERE id = ANY($1::uuid[]) AND moved_to_post_id IS NOT NULL`,
      [flagIds],
    );

    let profiles = 0;
    for (const move of moves) {
      if (move.profile_user_ids.length === 0) continue;
      const result = await client.query(
        `UPDATE vexilo_user SET profile_post_id = NULL WHERE id = ANY($1::uuid[]) AND profile_post_id = $2`,
        [move.profile_user_ids, move.post_id],
      );
      profiles += result.rowCount ?? 0;
    }

    // The likes it copied: one per favorite of the old flag, with the favorite's time. A like made
    // after the move (even by someone who'd favorited it) has a later time and stays.
    const likes = await client.query(
      `DELETE FROM vexilo_post_like l
        USING vexilo_post_move m, vexilo_favorite fa
        WHERE m.batch_id = $1 AND l.post_id = m.post_id AND fa.flag_id = m.flag_id AND fa.user_id = l.user_id
          AND l.created_at = fa.created_at`,
      [batchId],
    );

    // Remix links it added to posts of this batch.
    await client.query(
      `UPDATE vexilo_saved_flag SET remix_of_post_id = NULL
        WHERE remix_of_post_id = ANY($1::uuid[]) AND remix_of = ANY($2::uuid[])`,
      [postIds, flagIds],
    );

    const reopened = await client.query(
      `UPDATE vexilo_flag_request SET deleted = false, updated_at = now() WHERE id = ANY($1::uuid[]) AND deleted`,
      [requestIds],
    );

    let deleted = 0;
    let restored = 0;
    for (const move of moves) {
      if (move.created_post) {
        // Its image belongs to the flag, which is staying, so nothing to clean up in storage.
        const result = await client.query(`DELETE FROM vexilo_saved_flag WHERE id = $1`, [move.post_id]);
        deleted += result.rowCount ?? 0;
      } else if (move.previous) {
        const p = move.previous;
        const result = await client.query(
          `UPDATE vexilo_saved_flag
              SET slug = $2, description = $3, tags = $4, published_at = $5, views = $6, remix_of_post_id = $7,
                  -- What's left once the copied likes are gone, so the count matches the rows.
                  likes = (SELECT count(*) FROM vexilo_post_like l WHERE l.post_id = $1)
            WHERE id = $1`,
          [move.post_id, p.slug, p.description, p.tags, p.published_at, p.views, p.remix_of_post_id],
        );
        restored += result.rowCount ?? 0;
      }
    }

    // Tag counts are what the encyclopedia now holds: recount every tag these flags carry.
    await client.query(
      `UPDATE vexilo_flag_tag t
          SET count = (SELECT count(*) FROM vexilo_flag f WHERE f.moved_to_post_id IS NULL AND t.tag = ANY(f.tags)),
              updated_at = now()
        WHERE t.tag IN (SELECT DISTINCT unnest(f.tags) FROM vexilo_flag f
                         JOIN vexilo_post_move m ON m.flag_id = f.id WHERE m.batch_id = $1)`,
      [batchId],
    );

    await client.query(`UPDATE vexilo_post_move SET reverted_at = now() WHERE batch_id = $1`, [batchId]);

    console.log(`
Batch ${batchId}
  ${flagsBack.rowCount} flags back in the encyclopedia
  ${deleted} created posts deleted, ${restored} saved flags restored
  ${likes.rowCount} copied likes removed, ${profiles} profile flags restored
  ${reopened.rowCount} requests waiting for review again
`);
    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('Dry run: rolled back, nothing written.');
    } else {
      await client.query('COMMIT');
      console.log('Committed.');
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
