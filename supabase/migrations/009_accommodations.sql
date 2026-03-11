-- ============================================================
-- Migration 009: accommodations table
-- Run this in the Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS accommodations (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              UUID           NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name                 TEXT           NOT NULL,
  address              TEXT,
  phone                TEXT,
  website_url          TEXT,
  check_in_date        DATE           NOT NULL,
  check_out_date       DATE           NOT NULL,
  check_in_time        TIME           DEFAULT '15:00',
  check_out_time       TIME           DEFAULT '11:00',
  confirmation_number  TEXT,
  num_rooms            INTEGER,
  cost_per_night       NUMERIC(10,2),
  total_cost           NUMERIC(10,2),
  notes                TEXT,
  added_by             UUID           REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS accommodations_trip_idx
  ON accommodations(trip_id, check_in_date);

ALTER TABLE accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view accommodations"
  ON accommodations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = accommodations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add accommodations"
  ON accommodations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = accommodations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip organizer can update accommodations"
  ON accommodations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = accommodations.trip_id
        AND trips.created_by = auth.uid()
    )
  );

CREATE POLICY "Trip organizer can delete accommodations"
  ON accommodations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = accommodations.trip_id
        AND trips.created_by = auth.uid()
    )
  );
