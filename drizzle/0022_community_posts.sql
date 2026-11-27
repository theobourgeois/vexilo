-- Community: flags people design become posts on their profile (vexilo.org/@username/slug),
-- separate from the encyclopedia of real flags.
--
-- Additive only: no column or row is dropped, so the previous code keeps working against this
-- schema. Moving existing flags is a separate, reversible step: `npm run community:move` (see
-- scripts/community/move-custom-flags.ts). Moved flags stay in vexilo_flag, marked with
-- moved_to_post_id; clearing the marker puts them back.

-- Saved flags are the posts table: a post is a saved flag with published_at set.
ALTER TABLE "vexilo_saved_flag" ALTER COLUMN "design" DROP NOT NULL; -- uploaded designs have no maker design
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "slug" varchar(80);
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "likes" integer NOT NULL DEFAULT 0;
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "views" integer NOT NULL DEFAULT 0;
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "remix_of_post_id" uuid REFERENCES "vexilo_saved_flag"("id") ON DELETE SET NULL;
-- The post's colours (for its page header), and the image they were read from: a new image reads them again.
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "palette" jsonb;
ALTER TABLE "vexilo_saved_flag" ADD COLUMN IF NOT EXISTS "palette_image" varchar(1000);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_flag_slug_idx" ON "vexilo_saved_flag" ("user_id", "slug");
CREATE INDEX IF NOT EXISTS "saved_flag_published_idx" ON "vexilo_saved_flag" ("published_at" DESC) WHERE "published_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "saved_flag_likes_idx" ON "vexilo_saved_flag" ("likes" DESC, "published_at" DESC) WHERE "published_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "saved_flag_remix_of_idx" ON "vexilo_saved_flag" ("remix_of") WHERE "published_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "saved_flag_remix_of_post_idx" ON "vexilo_saved_flag" ("remix_of_post_id") WHERE "published_at" IS NOT NULL;

-- A flag that moved to the community. Every encyclopedia list skips these. No foreign key on
-- purpose: when its maker deletes the post the flag must stay out of the encyclopedia, not
-- quietly come back.
ALTER TABLE "vexilo_flag" ADD COLUMN IF NOT EXISTS "moved_to_post_id" uuid;
CREATE INDEX IF NOT EXISTS "flag_moved_idx" ON "vexilo_flag" ("moved_to_post_id") WHERE "moved_to_post_id" IS NOT NULL;

-- Profiles.
ALTER TABLE "vexilo_user" ADD COLUMN IF NOT EXISTS "bio" varchar(160) NOT NULL DEFAULT '';
ALTER TABLE "vexilo_user" ADD COLUMN IF NOT EXISTS "link" varchar(200) NOT NULL DEFAULT '';
ALTER TABLE "vexilo_user" ADD COLUMN IF NOT EXISTS "location" varchar(60) NOT NULL DEFAULT '';
ALTER TABLE "vexilo_user" ADD COLUMN IF NOT EXISTS "pinned_post_ids" uuid[] NOT NULL DEFAULT '{}';
-- A profile flag that's one of their own designs (favorite_flag_id stays for real flags).
ALTER TABLE "vexilo_user" ADD COLUMN IF NOT EXISTS "profile_post_id" uuid REFERENCES "vexilo_saved_flag"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "vexilo_post_like" (
  "user_id" uuid NOT NULL REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "post_id" uuid NOT NULL REFERENCES "vexilo_saved_flag"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "post_id")
);
CREATE INDEX IF NOT EXISTS "post_like_post_idx" ON "vexilo_post_like" ("post_id");
CREATE INDEX IF NOT EXISTS "post_like_user_idx" ON "vexilo_post_like" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "vexilo_follow" (
  "follower_id" uuid NOT NULL REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "following_id" uuid NOT NULL REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("follower_id", "following_id"),
  CONSTRAINT "follow_not_self" CHECK ("follower_id" <> "following_id")
);
CREATE INDEX IF NOT EXISTS "follow_following_idx" ON "vexilo_follow" ("following_id");

-- Likes, follows and remixes, for the bell. Grouped when they're shown.
CREATE TABLE IF NOT EXISTS "vexilo_notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "actor_id" uuid NOT NULL REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "type" varchar(16) NOT NULL,
  "post_id" uuid REFERENCES "vexilo_saved_flag"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "read_at" timestamp
);
CREATE INDEX IF NOT EXISTS "notification_user_idx" ON "vexilo_notification" ("user_id", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_once_idx" ON "vexilo_notification" ("user_id", "actor_id", "type", "post_id") NULLS NOT DISTINCT;

-- What the move script changed, so it can be undone and old /flag/ links keep redirecting.
-- No foreign keys: it outlives the rows it describes.
CREATE TABLE IF NOT EXISTS "vexilo_post_move" (
  "id" serial PRIMARY KEY,
  "batch_id" uuid NOT NULL,
  "flag_id" uuid, -- null for a saved flag that was waiting for review, published without one
  "flag_name" varchar(255) NOT NULL,
  "post_id" uuid NOT NULL,
  "created_post" boolean NOT NULL,
  -- The post's columns before the move (null when it made the post), and the users whose
  -- profile flag it changed.
  "previous" jsonb,
  "profile_user_ids" uuid[] NOT NULL DEFAULT '{}',
  -- Requests waiting for review that it closed (they'd have put the flag back in the encyclopedia).
  "closed_request_ids" uuid[] NOT NULL DEFAULT '{}',
  "reverted_at" timestamp,
  "moved_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "post_move_flag_idx" ON "vexilo_post_move" ("flag_id");
CREATE INDEX IF NOT EXISTS "post_move_name_idx" ON "vexilo_post_move" ("flag_name");
CREATE INDEX IF NOT EXISTS "post_move_batch_idx" ON "vexilo_post_move" ("batch_id");
