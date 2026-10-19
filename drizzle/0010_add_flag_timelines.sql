-- Each flag's dated design history, filled by scripts/timeline/fill-timelines.ts and shown on the flag page
CREATE TABLE IF NOT EXISTS "vexilo_flag_timeline" (
	"flag_id" uuid PRIMARY KEY NOT NULL REFERENCES "vexilo_flag"("id") ON DELETE CASCADE,
	"status" varchar(20) NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" varchar(100) NOT NULL,
	"pipeline_version" varchar(50) NOT NULL,
	"research" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "flag_timeline_events_idx" ON "vexilo_flag_timeline" USING gin ("events" jsonb_path_ops);
