-- Colours read from each flag's image, used for colour search and the Colours card
CREATE TABLE IF NOT EXISTS "vexilo_flag_color" (
	"flag_id" uuid PRIMARY KEY NOT NULL REFERENCES "vexilo_flag"("id") ON DELETE CASCADE,
	"image" varchar(1000) NOT NULL,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"families" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "flag_color_families_idx" ON "vexilo_flag_color" USING gin ("families");
