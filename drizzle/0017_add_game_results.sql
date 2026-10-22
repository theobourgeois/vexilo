-- Finished Unfurl and Vexigrid games, one per player per day, for comparing results across players.
CREATE TABLE IF NOT EXISTS "vexilo_game_result" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game" varchar(16) NOT NULL,
  "date" date NOT NULL,
  "player" varchar(64) NOT NULL,
  "user_id" uuid REFERENCES "vexilo_user"("id") ON DELETE SET NULL,
  "solved" boolean NOT NULL,
  "guesses" integer NOT NULL,
  "score" integer NOT NULL,
  "picks" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "game_result_player_idx" ON "vexilo_game_result" ("game", "date", "player");
CREATE INDEX IF NOT EXISTS "game_result_user_idx" ON "vexilo_game_result" ("user_id");
