-- Design contests: one row per contest, one entry per person per contest, one vote per voter per entry.
CREATE TABLE IF NOT EXISTS "vexilo_contest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(80) NOT NULL,
  "title" varchar(120) NOT NULL,
  "theme" varchar(160) NOT NULL,
  "brief" text DEFAULT '' NOT NULL,
  "rules" text[] DEFAULT '{}' NOT NULL,
  "prize" varchar(200) DEFAULT '' NOT NULL,
  "starts_at" timestamp NOT NULL,
  "voting_starts_at" timestamp NOT NULL,
  "ends_at" timestamp NOT NULL,
  "votes_per_voter" integer DEFAULT 3 NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "winner_entry_id" uuid,
  "announced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "contest_slug_idx" ON "vexilo_contest" ("slug");
CREATE INDEX IF NOT EXISTS "contest_starts_idx" ON "vexilo_contest" ("starts_at");

CREATE TABLE IF NOT EXISTS "vexilo_contest_entry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contest_id" uuid NOT NULL REFERENCES "vexilo_contest"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "title" varchar(120) NOT NULL,
  "statement" varchar(400) DEFAULT '' NOT NULL,
  "image" varchar(1000) NOT NULL,
  "design" jsonb NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "status_reason" varchar(200) DEFAULT '' NOT NULL,
  "ip_hash" varchar(64),
  "flag_id" uuid REFERENCES "vexilo_flag"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "contest_entry_user_idx" ON "vexilo_contest_entry" ("contest_id", "user_id");
CREATE INDEX IF NOT EXISTS "contest_entry_user_id_idx" ON "vexilo_contest_entry" ("user_id");

CREATE TABLE IF NOT EXISTS "vexilo_contest_vote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contest_id" uuid NOT NULL REFERENCES "vexilo_contest"("id") ON DELETE CASCADE,
  "entry_id" uuid NOT NULL REFERENCES "vexilo_contest_entry"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "vexilo_user"("id") ON DELETE CASCADE,
  "ip_hash" varchar(64),
  "voided_at" timestamp,
  "void_reason" varchar(200) DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "contest_vote_voter_idx" ON "vexilo_contest_vote" ("entry_id", "user_id");
CREATE INDEX IF NOT EXISTS "contest_vote_contest_user_idx" ON "vexilo_contest_vote" ("contest_id", "user_id");
