-- ============================================================
-- Migration 018: Group voting / polls for trips
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── 1. trip_polls ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_polls (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                  UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_by               UUID        REFERENCES auth.users(id),
  question                 TEXT        NOT NULL,
  category                 TEXT        NOT NULL DEFAULT 'custom'
    CHECK (category IN ('courses', 'dates', 'accommodation', 'dining', 'activities', 'games', 'custom')),
  vote_type                TEXT        NOT NULL DEFAULT 'pick_one'
    CHECK (vote_type IN ('pick_one', 'pick_multiple', 'rank')),
  max_selections           INT         DEFAULT 1,
  show_results_before_close BOOLEAN    DEFAULT TRUE,
  allow_comments           BOOLEAN     DEFAULT TRUE,
  deadline                 TIMESTAMPTZ,
  status                   TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. poll_options ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_options (
  id           UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      UUID   NOT NULL REFERENCES trip_polls(id) ON DELETE CASCADE,
  label        TEXT   NOT NULL,
  description  TEXT,
  course_id    UUID   REFERENCES courses(id),
  option_order INT    NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. poll_votes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poll_votes (
  id         UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID   NOT NULL REFERENCES trip_polls(id)   ON DELETE CASCADE,
  option_id  UUID   NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  member_id  BIGINT NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  rank       INT,
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (poll_id, option_id, member_id)
);

-- ── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trip_polls_trip_id     ON trip_polls  (trip_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id   ON poll_options (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id     ON poll_votes   (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_member_id   ON poll_votes   (member_id);

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE trip_polls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes   ENABLE ROW LEVEL SECURITY;

-- trip_polls: trip members can view
CREATE POLICY "Trip members can view polls"
  ON trip_polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_polls.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- trip_polls: trip members can insert (for non-organizer polls) — organizer check happens in app
CREATE POLICY "Trip members can create polls"
  ON trip_polls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_polls.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- trip_polls: creator or organizer can update (close, etc.)
CREATE POLICY "Poll creator can update polls"
  ON trip_polls FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- trip_polls: creator can delete
CREATE POLICY "Poll creator can delete polls"
  ON trip_polls FOR DELETE
  USING (created_by = auth.uid());

-- poll_options: trip members can view
CREATE POLICY "Trip members can view poll options"
  ON poll_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_polls
      JOIN trip_members ON trip_members.trip_id = trip_polls.trip_id
      WHERE trip_polls.id = poll_options.poll_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- poll_options: poll creator can insert options
CREATE POLICY "Poll creator can insert options"
  ON poll_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_polls
      WHERE trip_polls.id = poll_options.poll_id
        AND trip_polls.created_by = auth.uid()
    )
  );

-- poll_votes: trip members can view
CREATE POLICY "Trip members can view poll votes"
  ON poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_polls
      JOIN trip_members ON trip_members.trip_id = trip_polls.trip_id
      WHERE trip_polls.id = poll_votes.poll_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- poll_votes: trip members can vote (member_id must be their own record)
CREATE POLICY "Members can vote"
  ON poll_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.id = poll_votes.member_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- poll_votes: members can delete their own vote (change vote)
CREATE POLICY "Members can delete own vote"
  ON poll_votes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.id = poll_votes.member_id
        AND trip_members.user_id = auth.uid()
    )
  );
