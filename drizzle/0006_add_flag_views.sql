-- Flag page views: a lifetime total on each flag plus a per-day breakdown
ALTER TABLE "vexilo_flag" ADD COLUMN "views" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "vexilo_flag_view_daily" (
	"flag_id" uuid NOT NULL REFERENCES "vexilo_flag"("id") ON DELETE CASCADE,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vexilo_flag_view_daily_flag_id_day_pk" PRIMARY KEY("flag_id","day")
);

CREATE INDEX IF NOT EXISTS "flag_view_daily_day_idx" ON "vexilo_flag_view_daily" ("day");
