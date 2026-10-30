-- Indexes for the lookups every page makes. 0003 described most of these but never reached production.

-- Flag pages look flags up by exact name; Browse sorts by favorites, recent edits, views and name.
CREATE INDEX IF NOT EXISTS "flag_name_idx" ON "vexilo_flag" ("name");
CREATE INDEX IF NOT EXISTS "flag_favorites_idx" ON "vexilo_flag" ("favorites" DESC);
CREATE INDEX IF NOT EXISTS "flag_updated_at_idx" ON "vexilo_flag" ("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "flag_views_idx" ON "vexilo_flag" ("views" DESC, "favorites" DESC);
-- Tag filters (tags @> ARRAY[...]) and related flags (tags && ..., related_flags @> ...).
CREATE INDEX IF NOT EXISTS "flag_tags_idx" ON "vexilo_flag" USING gin ("tags");
CREATE INDEX IF NOT EXISTS "flag_related_flags_idx" ON "vexilo_flag" USING gin ("related_flags" jsonb_path_ops);

-- "Has this user favorited this flag?" runs on every list a signed-in user sees.
CREATE UNIQUE INDEX IF NOT EXISTS "favorite_user_flag_idx" ON "vexilo_favorite" ("user_id", "flag_id");
CREATE INDEX IF NOT EXISTS "favorite_flag_idx" ON "vexilo_favorite" ("flag_id");

-- A flag's edit history and a user's requests.
CREATE INDEX IF NOT EXISTS "flag_request_flag_idx" ON "vexilo_flag_request" ("flag_id");
CREATE INDEX IF NOT EXISTS "flag_request_user_idx" ON "vexilo_flag_request" ("user_id");

CREATE INDEX IF NOT EXISTS "flag_tag_tag_idx" ON "vexilo_flag_tag" ("tag");
CREATE INDEX IF NOT EXISTS "flag_tag_count_idx" ON "vexilo_flag_tag" ("count" DESC);

CREATE INDEX IF NOT EXISTS "leaderboard_user_idx" ON "vexilo_leaderboard" ("user_id");
CREATE INDEX IF NOT EXISTS "leaderboard_contributions_idx" ON "vexilo_leaderboard" ("contributions" DESC);

CREATE INDEX IF NOT EXISTS "flag_of_the_day_created_at_idx" ON "vexilo_flag_of_the_day" ("created_at" DESC);

-- Type and symbol searches (search_tokens && ARRAY[...]).
CREATE INDEX IF NOT EXISTS "flag_ai_metadata_search_tokens_idx" ON "vexilo_flag_ai_metadata" USING gin ("search_tokens");
