-- When each flag request was published, for the weekly top contributors on the homepage.
ALTER TABLE "vexilo_flag_request" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;

-- A new flag's row is inserted when its request is approved, so the flag's created_at is the approval time.
UPDATE "vexilo_flag_request" AS r
SET "approved_at" = f."created_at"
FROM "vexilo_flag" AS f
WHERE r."approved"
  AND r."approved_at" IS NULL
  AND NOT r."is_edit"
  AND f."id"::text = r."flag_id"
  AND f."created_at" >= r."created_at";

-- Edits (and new flags deleted since) left no approval time, so use when they were submitted.
UPDATE "vexilo_flag_request"
SET "approved_at" = "created_at"
WHERE "approved" AND "approved_at" IS NULL;

CREATE INDEX IF NOT EXISTS "flag_request_approved_at_idx" ON "vexilo_flag_request" ("approved_at");
