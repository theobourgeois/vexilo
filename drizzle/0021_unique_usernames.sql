-- Names become unique usernames: no spaces, 3–24 letters/numbers/underscores, unique ignoring case.
-- Order: deploy the code first, then `npm run usernames:backfill`, then apply this file.
-- (Old code writes free-form names, which this would reject.)
ALTER TABLE "vexilo_user" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "vexilo_user" ADD CONSTRAINT "user_name_format" CHECK ("name" ~ '^[A-Za-z0-9_]{3,24}$');
CREATE UNIQUE INDEX IF NOT EXISTS "user_name_unique" ON "vexilo_user" (lower("name"));
