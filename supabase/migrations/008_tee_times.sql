-- ============================================================
-- Migration 008: tee_times + budget_items tables
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── 1. tee_times ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tee_times (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  course_id            UUID           REFERENCES courses(id) ON DELETE SET NULL,
  course_name          TEXT           NOT NULL,
  tee_date             DATE           NOT NULL,
  tee_time             TIME           NOT NULL,
  num_players          INTEGER,
  confirmation_number  TEXT,
  booking_url          TEXT,
  green_fee_per_player NUMERIC(10,2),
  cart_fee_per_player  NUMERIC(10,2),
  notes                TEXT,
  added_by             UUID           REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tee_times_trip_date_idx
  ON tee_times(trip_id, tee_date, tee_time);

ALTER TABLE tee_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view tee times"
  ON tee_times FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = tee_times.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add tee times"
  ON tee_times FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = tee_times.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip organizer can update tee times"
  ON tee_times FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = tee_times.trip_id
        AND trips.created_by = auth.uid()
    )
  );

CREATE POLICY "Trip organizer can delete tee times"
  ON tee_times FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = tee_times.trip_id
        AND trips.created_by = auth.uid()
    )
  );

-- ── 2. budget_items ──────────────────────────────────────────
-- Lightweight line-items used by the Budget Tracker section.
-- Tee times auto-populate green fee entries here.

CREATE TABLE IF NOT EXISTS budget_items (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category    TEXT           NOT NULL DEFAULT 'other',
  label       TEXT           NOT NULL,
  amount      NUMERIC(10,2)  NOT NULL,
  source_type TEXT,          -- e.g. 'tee_time'
  source_id   UUID,          -- references the originating row
  added_by    UUID           REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ    DEFAULT NOW()
);

-- Unique constraint so tee_time upserts don't duplicate
CREATE UNIQUE INDEX IF NOT EXISTS budget_items_source_idx
  ON budget_items(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS budget_items_trip_idx
  ON budget_items(trip_id);

ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view budget items"
  ON budget_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = budget_items.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add budget items"
  ON budget_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = budget_items.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update budget items"
  ON budget_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = budget_items.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete budget items"
  ON budget_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = budget_items.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );
