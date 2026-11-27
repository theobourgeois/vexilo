-- Clip-art emblems (game-icons.net, PhyloPic) aren't cut from a flag, so they have no source flag,
-- and carry an artist credit instead. Additive: safe to apply before deploying the code that uses it.
ALTER TABLE "vexilo_flag_emblem" ALTER COLUMN "flag_id" DROP NOT NULL;
ALTER TABLE "vexilo_flag_emblem" ADD COLUMN IF NOT EXISTS "credit" varchar(160);
