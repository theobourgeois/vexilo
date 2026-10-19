-- Each SVG flag split into its field and objects for the flag maker, filled by scripts/parts/backfill-flag-parts.ts
CREATE TABLE IF NOT EXISTS "vexilo_flag_parts" (
	"flag_id" uuid PRIMARY KEY NOT NULL REFERENCES "vexilo_flag"("id") ON DELETE CASCADE,
	"image" varchar(1000) NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"error" text,
	"design" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
