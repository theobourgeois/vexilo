-- Add favorite flag field to users table
ALTER TABLE "vexilo_user" ADD COLUMN "favorite_flag_id" uuid REFERENCES "vexilo_flag"("id") ON DELETE SET NULL;
