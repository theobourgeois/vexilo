-- How far a flag rebuilt from its parts is from the original (share of pixels that differ)
ALTER TABLE "vexilo_flag_parts" ADD COLUMN IF NOT EXISTS "mismatch" real;
