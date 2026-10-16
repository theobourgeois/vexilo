-- Trusted creators get their flag requests and edits approved automatically
ALTER TABLE "vexilo_user" ADD COLUMN "is_trusted" boolean DEFAULT false NOT NULL;
