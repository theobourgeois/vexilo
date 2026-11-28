-- Undoes 0023_community_posts.sql. Run it only after the previous code is deployed again and the
-- move is reverted (`npm run community:revert`), because it drops likes, follows, notifications,
-- profile fields and the move log. Back the database up first.
--
--   psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f drizzle/0023_community_posts.down.sql

DROP TABLE IF EXISTS "vexilo_post_move";
DROP TABLE IF EXISTS "vexilo_notification";
DROP TABLE IF EXISTS "vexilo_follow";
DROP TABLE IF EXISTS "vexilo_post_like";

ALTER TABLE "vexilo_user" DROP COLUMN IF EXISTS "profile_post_id";
ALTER TABLE "vexilo_user" DROP COLUMN IF EXISTS "pinned_post_ids";
ALTER TABLE "vexilo_user" DROP COLUMN IF EXISTS "location";
ALTER TABLE "vexilo_user" DROP COLUMN IF EXISTS "link";
ALTER TABLE "vexilo_user" DROP COLUMN IF EXISTS "bio";

DROP INDEX IF EXISTS "flag_moved_idx";
ALTER TABLE "vexilo_flag" DROP COLUMN IF EXISTS "moved_to_post_id";

DROP INDEX IF EXISTS "saved_flag_remix_of_post_idx";
DROP INDEX IF EXISTS "saved_flag_remix_of_idx";
DROP INDEX IF EXISTS "saved_flag_likes_idx";
DROP INDEX IF EXISTS "saved_flag_published_idx";
DROP INDEX IF EXISTS "saved_flag_slug_idx";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "palette_image";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "palette";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "remix_of_post_id";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "views";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "likes";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "published_at";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "description";
ALTER TABLE "vexilo_saved_flag" DROP COLUMN IF EXISTS "slug";
-- Saved flags created from uploads have no design; the old schema can't hold them.
DELETE FROM "vexilo_saved_flag" WHERE "design" IS NULL;
ALTER TABLE "vexilo_saved_flag" ALTER COLUMN "design" SET NOT NULL;
