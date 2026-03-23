-- ─── Extend trip_report_customizations with settings & accommodation fields ──

-- Organizer note (single block, replaces per-day notes)
ALTER TABLE trip_report_customizations
  ADD COLUMN IF NOT EXISTS organizer_note TEXT;

-- Accommodation info
ALTER TABLE trip_report_customizations
  ADD COLUMN IF NOT EXISTS accommodation_name TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_url TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_address TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_photos JSONB NOT NULL DEFAULT '[]';

-- Section visibility toggles (all default to true)
ALTER TABLE trip_report_customizations
  ADD COLUMN IF NOT EXISTS show_itinerary BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_tee_sheet BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_budget BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_cup BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_accommodation BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_courses BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_organizer_note BOOLEAN NOT NULL DEFAULT TRUE;
