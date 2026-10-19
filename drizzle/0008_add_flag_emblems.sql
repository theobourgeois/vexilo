-- Emblems cut out of flag images, the parts library for the flag editor
CREATE TABLE IF NOT EXISTS "vexilo_flag_emblem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" varchar(64) NOT NULL,
	"flag_id" uuid NOT NULL REFERENCES "vexilo_flag"("id") ON DELETE CASCADE,
	"image" varchar(1000) NOT NULL,
	"svg" varchar(1000),
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"colors" text[] DEFAULT '{}' NOT NULL,
	"copies" integer DEFAULT 1 NOT NULL,
	"share" real NOT NULL,
	"box" jsonb NOT NULL,
	"collection" varchar(40) NOT NULL,
	"appears_on" uuid[] DEFAULT '{}' NOT NULL,
	"fingerprint" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "flag_emblem_source_key_idx" ON "vexilo_flag_emblem" ("source_key");
CREATE INDEX IF NOT EXISTS "flag_emblem_flag_idx" ON "vexilo_flag_emblem" ("flag_id");
