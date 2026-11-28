import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { firstFreeSlug, slugBase } from '../../src/lib/post-slug';

/**
 * Moves flags people designed out of the encyclopedia and onto their makers' profiles as posts.
 * Needs drizzle/0023_community_posts.sql applied first.
 *
 * What moves:
 *   - every flag made in the flag maker (it has a `design`)
 *   - uploads tagged custom, fictional or remix, except hoi4 ones (game flags stay)
 * Each is credited to whoever posted it: the saved flag it came from, else the approved request
 * that created it. Flags nobody posted (imports) stay in the encyclopedia.
 *
 * Saved flags waiting for review (posted from the maker, not yet approved) are published as posts
 * too, and their requests closed: approving one now would put it in the encyclopedia. Pending
 * edits to moved flags are closed as well; the post is already the latest version.
 *
 * For each flag it:
 *   - makes it a post: publishes the saved flag it came from, or creates one for an upload
 *   - marks the flag `moved_to_post_id` (the row stays; every list skips it, /flag/ redirects)
 *   - turns its favorites into likes, and points profile flags at the post
 *   - logs what it changed in vexilo_post_move, with the post's columns from before
 *
 * It all runs in one transaction. --dry-run does the whole move, prints what happened and rolls
 * it back. Undo with `npm run community:revert` (the latest batch, or --batch=<id>).
 *
 *   npm run community:move -- --dry-run
 *   npm run community:move
 */

const MOVE_TAGS = ['custom', 'fictional', 'remix'];
const KEEP_TAGS = ['hoi4'];
/** Tags that only said "not a real flag"; a post doesn't need them. */
const DROP_TAGS = new Set(['custom', 'remix']);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
for (const arg of args) if (arg !== '--dry-run' && arg !== '--verbose') throw new Error(`Unknown argument: ${arg}`);

type Candidate = {
  id: string;
  name: string;
  image: string;
  description: string;
  tags: string[];
  views: number;
  remix_of: string | null;
  design: unknown;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  requester: string | null;
  saved_id: string | null;
  saved_user_id: string | null;
  saved_slug: string | null;
  saved_description: string;
  saved_tags: string[];
  saved_published_at: Date | null;
  saved_likes: number;
  saved_views: number;
  saved_remix_of_post_id: string | null;
};

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const batchId = randomUUID();
  try {
    await client.query('BEGIN');
    // Don't wait behind a long lock on a live database; fail and try again later instead.
    await client.query(`SET LOCAL lock_timeout = '5s'`);
    // Nothing else posts, reviews or favorites these flags halfway through.
    await client.query(
      'LOCK TABLE vexilo_flag, vexilo_saved_flag, vexilo_favorite, vexilo_flag_request IN SHARE ROW EXCLUSIVE MODE',
    );

    const { rows: candidates } = await client.query<Candidate>(
      `SELECT f.id, f.name, f.image, f.description, f.tags, f.views, f.remix_of, f.design,
              f.created_at, f.updated_at,
              first_request.approved_at AS published_at,
              first_request.user_id AS requester,
              s.id AS saved_id, s.user_id AS saved_user_id, s.slug AS saved_slug,
              s.description AS saved_description, s.tags AS saved_tags,
              s.published_at AS saved_published_at, s.likes AS saved_likes, s.views AS saved_views,
              s.remix_of_post_id AS saved_remix_of_post_id
         FROM vexilo_flag f
         LEFT JOIN vexilo_saved_flag s ON s.flag_id = f.id
         LEFT JOIN LATERAL (
           SELECT r.user_id, r.approved_at
             FROM vexilo_flag_request r
            WHERE r.flag_id = f.id::text AND r.approved AND NOT r.is_edit
            ORDER BY r.created_at ASC
            LIMIT 1
         ) first_request ON true
        WHERE f.moved_to_post_id IS NULL
          AND (f.design IS NOT NULL OR (f.tags && $1::text[] AND NOT f.tags && $2::text[]))
        ORDER BY f.created_at ASC, f.id ASC`,
      [MOVE_TAGS, KEEP_TAGS],
    );

    const owned = candidates.filter((flag) => flag.saved_user_id ?? flag.requester);
    const unowned = candidates.length - owned.length;

    // Slugs already taken by the people these posts go to.
    const owners = [...new Set(owned.map((flag) => (flag.saved_user_id ?? flag.requester)!))];
    const { rows: takenRows } = await client.query<{ user_id: string; slug: string }>(
      `SELECT user_id, slug FROM vexilo_saved_flag WHERE slug IS NOT NULL AND user_id = ANY($1::uuid[])`,
      [owners],
    );
    const taken = new Map<string, Set<string>>();
    for (const { user_id, slug } of takenRows) {
      if (!taken.has(user_id)) taken.set(user_id, new Set());
      taken.get(user_id)!.add(slug);
    }

    let created = 0;
    let published = 0;
    for (const flag of owned) {
      const userId = (flag.saved_user_id ?? flag.requester)!;
      const slugs = taken.get(userId) ?? new Set<string>();
      taken.set(userId, slugs);
      const tags = flag.tags.filter((tag) => !DROP_TAGS.has(tag.toLowerCase()));
      const publishedAt = flag.published_at ?? flag.created_at;

      let postId: string;
      if (flag.saved_id) {
        // Their saved flag becomes the post. Its picture is their latest save, which is what
        // posting an update would have sent anyway.
        const slug = flag.saved_slug ?? firstFreeSlug(slugBase(flag.name), slugs);
        slugs.add(slug);
        await client.query(
          `UPDATE vexilo_saved_flag
              SET slug = $2, description = $3, tags = $4, published_at = COALESCE(published_at, $5),
                  views = views + $6
            WHERE id = $1`,
          [flag.saved_id, slug, flag.description, tags, publishedAt, flag.views],
        );
        postId = flag.saved_id;
        published++;
      } else {
        const slug = firstFreeSlug(slugBase(flag.name), slugs);
        slugs.add(slug);
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO vexilo_saved_flag
             (user_id, name, design, image, remix_of, flag_id, slug, description, tags, published_at, views, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`,
          [
            userId,
            flag.name.slice(0, 120),
            flag.design === null ? null : JSON.stringify(flag.design),
            flag.image,
            flag.remix_of,
            flag.id,
            slug,
            flag.description,
            tags,
            publishedAt,
            flag.views,
            flag.created_at,
            flag.updated_at,
          ],
        );
        postId = rows[0].id;
        created++;
      }

      const previous = flag.saved_id
        ? {
            slug: flag.saved_slug,
            description: flag.saved_description,
            tags: flag.saved_tags,
            published_at: flag.saved_published_at,
            likes: flag.saved_likes,
            views: flag.saved_views,
            remix_of_post_id: flag.saved_remix_of_post_id,
          }
        : null;
      await client.query(`UPDATE vexilo_flag SET moved_to_post_id = $2 WHERE id = $1`, [flag.id, postId]);
      await client.query(
        `INSERT INTO vexilo_post_move (batch_id, flag_id, flag_name, post_id, created_post, previous)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [batchId, flag.id, flag.name, postId, !flag.saved_id, previous === null ? null : JSON.stringify(previous)],
      );
      if (verbose) console.log(`${flag.saved_id ? 'publish' : 'create '} ${flag.name}`);
    }

    // Saved flags waiting for review: publish them, and close the request.
    const { rows: waiting } = await client.query<{
      id: string; user_id: string; name: string; request_id: string; created_at: Date;
      slug: string | null; description: string; tags: string[]; published_at: Date | null;
      likes: number; views: number; remix_of_post_id: string | null;
      request_description: string | null; request_tags: string[] | null;
    }>(
      `SELECT s.id, s.user_id, s.name, s.request_id, r.created_at, s.slug, s.description, s.tags,
              s.published_at, s.likes, s.views, s.remix_of_post_id,
              r.flag->>'description' AS request_description,
              ARRAY(SELECT jsonb_array_elements_text(COALESCE(r.flag->'tags', '[]'::jsonb))) AS request_tags
         FROM vexilo_saved_flag s
         JOIN vexilo_flag_request r ON r.id = s.request_id
        WHERE NOT r.approved AND NOT r.deleted AND NOT r.is_edit AND s.published_at IS NULL
        ORDER BY r.created_at ASC`,
    );
    for (const saved of waiting) {
      if (!taken.has(saved.user_id)) {
        const { rows } = await client.query<{ slug: string }>(
          `SELECT slug FROM vexilo_saved_flag WHERE user_id = $1 AND slug IS NOT NULL`,
          [saved.user_id],
        );
        taken.set(saved.user_id, new Set(rows.map((row) => row.slug)));
      }
      const slugs = taken.get(saved.user_id)!;
      const slug = saved.slug ?? firstFreeSlug(slugBase(saved.name), slugs);
      slugs.add(slug);
      const tags = (saved.request_tags ?? []).filter((tag) => !DROP_TAGS.has(tag.toLowerCase()));
      await client.query(
        `UPDATE vexilo_saved_flag SET slug = $2, description = $3, tags = $4, published_at = $5 WHERE id = $1`,
        [saved.id, slug, saved.request_description ?? '', tags, saved.created_at],
      );
      await client.query(`UPDATE vexilo_flag_request SET deleted = true, updated_at = now() WHERE id = $1`, [saved.request_id]);
      await client.query(
        `INSERT INTO vexilo_post_move (batch_id, flag_id, flag_name, post_id, created_post, previous, closed_request_ids)
         VALUES ($1, NULL, $2, $3, false, $4, ARRAY[$5]::uuid[])`,
        [
          batchId,
          saved.name,
          saved.id,
          JSON.stringify({
            slug: saved.slug, description: saved.description, tags: saved.tags, published_at: saved.published_at,
            likes: saved.likes, views: saved.views, remix_of_post_id: saved.remix_of_post_id,
          }),
          saved.request_id,
        ],
      );
      if (verbose) console.log(`publish ${saved.name} (was waiting for review)`);
    }

    // Edits waiting for review on flags that moved: close them.
    const { rows: closedEdits } = await client.query<{ id: string; flag_id: string }>(
      `WITH closed AS (
         UPDATE vexilo_flag_request r SET deleted = true, updated_at = now()
           FROM vexilo_post_move m
          WHERE m.batch_id = $1 AND r.flag_id = m.flag_id::text AND r.is_edit AND NOT r.approved AND NOT r.deleted
          RETURNING r.id, m.flag_id
       )
       SELECT * FROM closed`,
      [batchId],
    );
    for (const edit of closedEdits) {
      await client.query(
        `UPDATE vexilo_post_move SET closed_request_ids = array_append(closed_request_ids, $3::uuid)
          WHERE batch_id = $1 AND flag_id = $2`,
        [batchId, edit.flag_id, edit.id],
      );
    }

    // Favorites become likes, and each post's count is what it now has.
    const likes = await client.query(
      `INSERT INTO vexilo_post_like (user_id, post_id, created_at)
       SELECT fa.user_id, m.post_id, fa.created_at
         FROM vexilo_favorite fa
         JOIN vexilo_post_move m ON m.flag_id = fa.flag_id AND m.batch_id = $1
       ON CONFLICT DO NOTHING`,
      [batchId],
    );
    await client.query(
      `UPDATE vexilo_saved_flag s
          SET likes = (SELECT count(*) FROM vexilo_post_like l WHERE l.post_id = s.id)
        WHERE s.id IN (SELECT post_id FROM vexilo_post_move WHERE batch_id = $1)`,
      [batchId],
    );

    // Remixes of moved flags now remix the post (remix_of still names the old flag).
    const remixes = await client.query(
      `UPDATE vexilo_saved_flag s
          SET remix_of_post_id = m.post_id
         FROM vexilo_post_move m
        WHERE m.batch_id = $1 AND s.remix_of = m.flag_id AND s.remix_of_post_id IS NULL AND s.id <> m.post_id`,
      [batchId],
    );

    // A moved profile flag: show the post instead (favorite_flag_id is left as it was).
    const { rows: profiles } = await client.query<{ user_id: string; flag_id: string }>(
      `WITH changed AS (
         UPDATE vexilo_user u
            SET profile_post_id = m.post_id
           FROM vexilo_post_move m
          WHERE m.batch_id = $1 AND u.favorite_flag_id = m.flag_id AND u.profile_post_id IS NULL
          RETURNING u.id AS user_id, m.flag_id
       )
       SELECT * FROM changed`,
      [batchId],
    );
    for (const { user_id, flag_id } of profiles) {
      await client.query(
        `UPDATE vexilo_post_move SET profile_user_ids = array_append(profile_user_ids, $3::uuid)
          WHERE batch_id = $1 AND flag_id = $2`,
        [batchId, flag_id, user_id],
      );
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

    // Sanity checks before committing: every moved flag points at a published post it owns.
    const { rows: [check] } = await client.query<{ moved: string; bad: string; encyclopedia: string }>(
      `SELECT
         (SELECT count(*) FROM vexilo_flag WHERE moved_to_post_id IS NOT NULL) AS moved,
         (SELECT count(*) FROM vexilo_post_move m
            LEFT JOIN vexilo_saved_flag s ON s.id = m.post_id
           WHERE m.batch_id = $1 AND (s.id IS NULL OR s.published_at IS NULL OR s.slug IS NULL)) AS bad,
         (SELECT count(*) FROM vexilo_flag WHERE moved_to_post_id IS NULL) AS encyclopedia`,
      [batchId],
    );
    if (Number(check.bad) > 0) throw new Error(`${check.bad} moved flags have no published post; rolling back.`);

    console.log(`
Batch ${batchId}
  ${candidates.length} candidate flags, ${unowned} with no known poster (left in the encyclopedia)
  ${owned.length} moved: ${published} saved flags published, ${created} posts created for uploads
  ${waiting.length} saved flags waiting for review published, ${closedEdits.length} pending edits closed
  ${likes.rowCount} favorites became likes
  ${remixes.rowCount} saved flags now remix a post
  ${profiles.length} profile flags now show the post
  ${check.encyclopedia} flags left in the encyclopedia, ${check.moved} moved in all
`);

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('Dry run: rolled back, nothing written.');
    } else {
      await client.query('COMMIT');
      console.log(`Committed. Undo with: npm run community:revert -- --batch=${batchId}`);
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
