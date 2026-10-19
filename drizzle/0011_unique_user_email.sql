-- Prevent concurrent signups and case variants from creating duplicate accounts.
-- Existing duplicates must be resolved before applying this migration.
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "vexilo_user" (lower("email"));
