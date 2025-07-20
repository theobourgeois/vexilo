-- Performance optimization indexes
-- Add indexes for frequently queried columns

-- Flags table indexes
CREATE INDEX IF NOT EXISTS "vexilo_flag_name_idx" ON "vexilo_flag" USING gin (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS "vexilo_flag_name_lower_idx" ON "vexilo_flag" USING btree (lower(name));
CREATE INDEX IF NOT EXISTS "vexilo_flag_updated_at_idx" ON "vexilo_flag" USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS "vexilo_flag_favorites_idx" ON "vexilo_flag" USING btree (favorites DESC);
CREATE INDEX IF NOT EXISTS "vexilo_flag_created_at_idx" ON "vexilo_flag" USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS "vexilo_flag_tags_gin_idx" ON "vexilo_flag" USING gin (tags);

-- Favorites table indexes
CREATE INDEX IF NOT EXISTS "vexilo_favorite_user_id_idx" ON "vexilo_favorite" USING btree (user_id);
CREATE INDEX IF NOT EXISTS "vexilo_favorite_flag_id_idx" ON "vexilo_favorite" USING btree (flag_id);
CREATE UNIQUE INDEX IF NOT EXISTS "vexilo_favorite_user_flag_unique" ON "vexilo_favorite" (user_id, flag_id);

-- Flag requests table indexes
CREATE INDEX IF NOT EXISTS "vexilo_flag_request_user_id_idx" ON "vexilo_flag_request" USING btree (user_id);
CREATE INDEX IF NOT EXISTS "vexilo_flag_request_approved_idx" ON "vexilo_flag_request" USING btree (approved);
CREATE INDEX IF NOT EXISTS "vexilo_flag_request_created_at_idx" ON "vexilo_flag_request" USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS "vexilo_flag_request_flag_id_idx" ON "vexilo_flag_request" USING btree (flag_id);

-- Leaderboard table indexes
CREATE INDEX IF NOT EXISTS "vexilo_leaderboard_user_id_idx" ON "vexilo_leaderboard" USING btree (user_id);
CREATE INDEX IF NOT EXISTS "vexilo_leaderboard_contributions_idx" ON "vexilo_leaderboard" USING btree (contributions DESC);

-- Reports table indexes
CREATE INDEX IF NOT EXISTS "vexilo_report_flag_id_idx" ON "vexilo_report" USING btree (flag_id);
CREATE INDEX IF NOT EXISTS "vexilo_report_user_id_idx" ON "vexilo_report" USING btree (user_id);
CREATE INDEX IF NOT EXISTS "vexilo_report_resolved_idx" ON "vexilo_report" USING btree (resolved);
CREATE INDEX IF NOT EXISTS "vexilo_report_created_at_idx" ON "vexilo_report" USING btree (created_at DESC);

-- Flag tags table indexes
CREATE INDEX IF NOT EXISTS "vexilo_flag_tag_tag_idx" ON "vexilo_flag_tag" USING btree (tag);
CREATE INDEX IF NOT EXISTS "vexilo_flag_tag_count_idx" ON "vexilo_flag_tag" USING btree (count DESC);

-- Users table indexes
CREATE INDEX IF NOT EXISTS "vexilo_user_user_number_idx" ON "vexilo_user" USING btree (user_number);
CREATE INDEX IF NOT EXISTS "vexilo_user_email_idx" ON "vexilo_user" USING btree (email);

-- Flag of the day table indexes
CREATE INDEX IF NOT EXISTS "vexilo_flag_of_the_day_created_at_idx" ON "vexilo_flag_of_the_day" USING btree (created_at DESC); 