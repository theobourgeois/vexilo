-- My Flags: designs people keep from the flag maker, posted or not. Backfill with `npm run my-flags:backfill`.
CREATE TABLE IF NOT EXISTS "vexilo_saved_flag" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "design" jsonb NOT NULL,
  "image" varchar(1000) NOT NULL,
  "remix_of" uuid REFERENCES "vexilo_flag"("id") ON DELETE SET NULL,
  "flag_id" uuid REFERENCES "vexilo_flag"("id") ON DELETE SET NULL,
  "request_id" uuid REFERENCES "vexilo_flag_request"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "saved_flag_user_idx" ON "vexilo_saved_flag" ("user_id", "updated_at" DESC);
-- A posted flag, or a request, belongs to one saved flag. NULLs don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS "saved_flag_flag_idx" ON "vexilo_saved_flag" ("flag_id");
CREATE UNIQUE INDEX IF NOT EXISTS "saved_flag_request_idx" ON "vexilo_saved_flag" ("request_id");
-- Stored images are only deleted once nothing (flags or saved flags) uses them.
CREATE INDEX IF NOT EXISTS "saved_flag_image_idx" ON "vexilo_saved_flag" ("image");
