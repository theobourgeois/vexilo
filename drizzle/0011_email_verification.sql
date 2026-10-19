CREATE TABLE IF NOT EXISTS "vexilo_email_challenge" (
  "email" varchar(255) PRIMARY KEY,
  "id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "hashed_password" text NOT NULL,
  "user_id" uuid REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "code_hash" varchar(64) NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp NOT NULL,
  "sent_at" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "email_challenge_expires_idx" ON "vexilo_email_challenge" ("expires_at");
