-- ============================================================
-- Migration 011: Golf Games tables
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── 0. Profile & trip handicaps ────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS handicap INTEGER;

ALTER TABLE trip_members ADD COLUMN IF NOT EXISTS trip_handicap INTEGER;

-- ── 1. trip_games ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_games (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  round_number INTEGER        NOT NULL DEFAULT 1,
  course_id    UUID           REFERENCES courses(id) ON DELETE SET NULL,
  game_type    TEXT           NOT NULL,
  game_config  JSONB          DEFAULT '{}',
  stakes_per_unit NUMERIC(10,2) DEFAULT 0,
  status       TEXT           DEFAULT 'setup'
                              CHECK (status IN ('setup', 'active', 'complete')),
  created_by   UUID           REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trip_games_trip_idx
  ON trip_games(trip_id, round_number);

ALTER TABLE trip_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view games"
  ON trip_games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_games.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add games"
  ON trip_games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_games.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update games"
  ON trip_games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_games.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete games"
  ON trip_games FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_games.trip_id
        AND trips.created_by = auth.uid()
    )
  );

-- ── 2. game_pairings ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_pairings (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID           NOT NULL REFERENCES trip_games(id) ON DELETE CASCADE,
  team_number INTEGER        NOT NULL,
  team_name   TEXT,
  player_ids  UUID[]         NOT NULL
);

CREATE INDEX IF NOT EXISTS game_pairings_game_idx
  ON game_pairings(game_id);

ALTER TABLE game_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view pairings"
  ON game_pairings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_games
      JOIN trip_members ON trip_members.trip_id = trip_games.trip_id
      WHERE trip_games.id = game_pairings.game_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add pairings"
  ON game_pairings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_games
      JOIN trip_members ON trip_members.trip_id = trip_games.trip_id
      WHERE trip_games.id = game_pairings.game_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update pairings"
  ON game_pairings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_games
      JOIN trip_members ON trip_members.trip_id = trip_games.trip_id
      WHERE trip_games.id = game_pairings.game_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete pairings"
  ON game_pairings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_games
      JOIN trip_members ON trip_members.trip_id = trip_games.trip_id
      WHERE trip_games.id = game_pairings.game_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- ── 3. game_scores ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_scores (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID           NOT NULL REFERENCES trip_games(id) ON DELETE CASCADE,
  player_id   UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hole_number INTEGER,
  gross_score INTEGER,
  net_score   INTEGER,
  points      NUMERIC(10,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_scores_game_idx
  ON game_scores(game_id, player_id);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view scores"
  ON game_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_games
      JOIN trip_members ON trip_members.trip_id = trip_games.trip_id
      WHERE trip_games.id = game_scores.game_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add scores"
  ON game_scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_games
      JOIN trip_members ON trip_members.trip_id = trip_games.trip_id
      WHERE trip_games.id = game_scores.game_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update scores"
  ON game_scores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_games
      JOIN trip_members ON trip_members.trip_id = trip_games.trip_id
      WHERE trip_games.id = game_scores.game_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete scores"
  ON game_scores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_games
      JOIN trip_members ON trip_members.trip_id = trip_games.trip_id
      WHERE trip_games.id = game_scores.game_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- ── 4. game_payouts ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_payouts (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  game_id        UUID           REFERENCES trip_games(id) ON DELETE SET NULL,
  from_player_id UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_player_id   UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2)  NOT NULL,
  description    TEXT,
  status         TEXT           DEFAULT 'pending'
                                CHECK (status IN ('pending', 'settled')),
  created_at     TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_payouts_trip_idx
  ON game_payouts(trip_id);

ALTER TABLE game_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view payouts"
  ON game_payouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = game_payouts.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add payouts"
  ON game_payouts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = game_payouts.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update payouts"
  ON game_payouts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = game_payouts.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete payouts"
  ON game_payouts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = game_payouts.trip_id
        AND trips.created_by = auth.uid()
    )
  );
