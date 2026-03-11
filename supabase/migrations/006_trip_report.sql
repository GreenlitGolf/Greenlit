-- ─── Trip Report: share token + customizations ───────────────────────────────

-- Add a unique share token to every trip so the report can be accessed publicly
ALTER TABLE trips ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE
  DEFAULT encode(gen_random_bytes(12), 'hex');

-- Backfill any existing trips that don't have a token yet
UPDATE trips SET share_token = encode(gen_random_bytes(12), 'hex')
  WHERE share_token IS NULL;

-- ─── Report customizations ────────────────────────────────────────────────────
-- Stores per-trip organizer overrides: tagline, day notes, cover photo.
-- day_notes is keyed by day number: { "1": "Meet at 7am", "2": "Breakfast on Jake" }

CREATE TABLE IF NOT EXISTS trip_report_customizations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  tagline         TEXT,
  cover_photo_url TEXT,
  day_notes       JSONB       NOT NULL DEFAULT '{}',
  custom_sections JSONB       NOT NULL DEFAULT '[]',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id)
);

ALTER TABLE trip_report_customizations ENABLE ROW LEVEL SECURITY;

-- Trip members can read customizations
CREATE POLICY "Trip members can view report customizations"
  ON trip_report_customizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_report_customizations.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- Only the trip organizer (created_by) can insert / update / delete
CREATE POLICY "Trip organizer can manage report customizations"
  ON trip_report_customizations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_report_customizations.trip_id
        AND trips.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_report_customizations.trip_id
        AND trips.created_by = auth.uid()
    )
  );

-- ─── Storage bucket note ──────────────────────────────────────────────────────
-- Create a storage bucket named "trip-photos" in the Supabase dashboard
-- (Storage → New bucket → Name: trip-photos → Public: true).
-- This stores cover photos uploaded by trip organizers.
