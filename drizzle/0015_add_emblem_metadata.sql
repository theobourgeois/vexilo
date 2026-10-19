-- Searchable, reviewed emblem library. Older designs can still reference retired drawings.
ALTER TABLE "vexilo_flag_emblem"
  ADD COLUMN IF NOT EXISTS "name" varchar(160) DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}' NOT NULL,
  ADD COLUMN IF NOT EXISTS "category" varchar(32) DEFAULT 'unsorted' NOT NULL,
  ADD COLUMN IF NOT EXISTS "rank" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
