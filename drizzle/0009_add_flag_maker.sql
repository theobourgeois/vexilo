-- Flag maker: remixes link to the flag they came from and keep their editable design
ALTER TABLE "vexilo_flag" ADD COLUMN IF NOT EXISTS "remix_of" uuid REFERENCES "vexilo_flag"("id") ON DELETE SET NULL;
ALTER TABLE "vexilo_flag" ADD COLUMN IF NOT EXISTS "design" jsonb;

-- Where each emblem sits on every flag it was found on, so remixes can be rebuilt as layers
ALTER TABLE "vexilo_flag_emblem" ADD COLUMN IF NOT EXISTS "placements" jsonb DEFAULT '[]'::jsonb NOT NULL;
