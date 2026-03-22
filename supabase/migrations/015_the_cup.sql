-- ============================================================
-- Migration 015: The Cup — Ryder Cup-style team competition
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── 1. trip_cups ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_cups (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name          TEXT           NOT NULL,
  team_a_name   TEXT           NOT NULL DEFAULT 'Team A',
  team_b_name   TEXT           NOT NULL DEFAULT 'Team B',
  team_a_color  TEXT           NOT NULL DEFAULT '#1a2e1a',
  team_b_color  TEXT           NOT NULL DEFAULT '#c4a84f',
  status        TEXT           NOT NULL DEFAULT 'setup'
                               CHECK (status IN ('setup', 'active', 'complete')),
  created_at    TIMESTAMPTZ    DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trip_cups_trip_idx ON trip_cups(trip_id);

ALTER TABLE trip_cups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view cups"
  ON trip_cups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_cups.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add cups"
  ON trip_cups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_cups.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update cups"
  ON trip_cups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_cups.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip organizer can delete cups"
  ON trip_cups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_cups.trip_id
        AND trips.created_by = auth.uid()
    )
  );

-- ── 2. cup_teams ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cup_teams (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  cup_id        UUID           NOT NULL REFERENCES trip_cups(id) ON DELETE CASCADE,
  member_id     UUID           NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  team          TEXT           NOT NULL CHECK (team IN ('a', 'b')),
  is_captain    BOOLEAN        DEFAULT FALSE,
  UNIQUE(cup_id, member_id)
);

CREATE INDEX IF NOT EXISTS cup_teams_cup_idx ON cup_teams(cup_id);

ALTER TABLE cup_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view cup teams"
  ON cup_teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_cups
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE trip_cups.id = cup_teams.cup_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add cup teams"
  ON cup_teams FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_cups
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE trip_cups.id = cup_teams.cup_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update cup teams"
  ON cup_teams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_cups
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE trip_cups.id = cup_teams.cup_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip organizer can delete cup teams"
  ON cup_teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_cups
      JOIN trips ON trips.id = trip_cups.trip_id
      WHERE trip_cups.id = cup_teams.cup_id
        AND trips.created_by = auth.uid()
    )
  );

-- ── 3. cup_sessions ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cup_sessions (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  cup_id        UUID           NOT NULL REFERENCES trip_cups(id) ON DELETE CASCADE,
  tee_time_id   UUID           REFERENCES tee_times(id) ON DELETE SET NULL,
  format        TEXT           NOT NULL
                               CHECK (format IN ('four_ball', 'foursomes', 'singles', 'scramble')),
  session_order INTEGER        NOT NULL,
  status        TEXT           NOT NULL DEFAULT 'upcoming'
                               CHECK (status IN ('upcoming', 'in_progress', 'complete')),
  created_at    TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cup_sessions_cup_idx ON cup_sessions(cup_id);

ALTER TABLE cup_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view cup sessions"
  ON cup_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_cups
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE trip_cups.id = cup_sessions.cup_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add cup sessions"
  ON cup_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_cups
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE trip_cups.id = cup_sessions.cup_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update cup sessions"
  ON cup_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_cups
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE trip_cups.id = cup_sessions.cup_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip organizer can delete cup sessions"
  ON cup_sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_cups
      JOIN trips ON trips.id = trip_cups.trip_id
      WHERE trip_cups.id = cup_sessions.cup_id
        AND trips.created_by = auth.uid()
    )
  );

-- ── 4. cup_matches ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cup_matches (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID           NOT NULL REFERENCES cup_sessions(id) ON DELETE CASCADE,
  team_a_player1_id  UUID           REFERENCES trip_members(id) ON DELETE SET NULL,
  team_a_player2_id  UUID           REFERENCES trip_members(id) ON DELETE SET NULL,
  team_b_player1_id  UUID           REFERENCES trip_members(id) ON DELETE SET NULL,
  team_b_player2_id  UUID           REFERENCES trip_members(id) ON DELETE SET NULL,
  result             TEXT           CHECK (result IN ('team_a', 'team_b', 'halved')),
  score_display      TEXT,
  team_a_points      DECIMAL(2,1)   DEFAULT 0,
  team_b_points      DECIMAL(2,1)   DEFAULT 0,
  match_order        INTEGER        NOT NULL,
  created_at         TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cup_matches_session_idx ON cup_matches(session_id);

ALTER TABLE cup_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view cup matches"
  ON cup_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cup_sessions
      JOIN trip_cups ON trip_cups.id = cup_sessions.cup_id
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE cup_sessions.id = cup_matches.session_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add cup matches"
  ON cup_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cup_sessions
      JOIN trip_cups ON trip_cups.id = cup_sessions.cup_id
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE cup_sessions.id = cup_matches.session_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update cup matches"
  ON cup_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cup_sessions
      JOIN trip_cups ON trip_cups.id = cup_sessions.cup_id
      JOIN trip_members ON trip_members.trip_id = trip_cups.trip_id
      WHERE cup_sessions.id = cup_matches.session_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip organizer can delete cup matches"
  ON cup_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cup_sessions
      JOIN trip_cups ON trip_cups.id = cup_sessions.cup_id
      JOIN trips ON trips.id = trip_cups.trip_id
      WHERE cup_sessions.id = cup_matches.session_id
        AND trips.created_by = auth.uid()
    )
  );
