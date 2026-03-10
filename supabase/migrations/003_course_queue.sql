-- ============================================================
-- Migration 003: course_queue table + courses schema additions
-- Run this in the Supabase SQL editor
-- ============================================================

-- ── 1. Add state_region to courses ───────────────────────────
-- courses already has `state TEXT` and `country TEXT`; add `state_region` to match the queue/agent output

ALTER TABLE courses ADD COLUMN IF NOT EXISTS state_region TEXT;

-- ── 2. Unique constraint on (name, location) for upsert support
-- Required for ON CONFLICT (name, location) DO UPDATE in the enrichment route
-- PostgreSQL doesn't support IF NOT EXISTS on ADD CONSTRAINT, so we use a DO block

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_course_name_location'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT unique_course_name_location UNIQUE (name, location);
  END IF;
END $$;

-- ── 3. course_queue table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  location     TEXT        NOT NULL,
  country      TEXT,
  state_region TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'processing', 'complete', 'failed', 'private')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,

  UNIQUE (name, location)
);

-- ── 4. RLS on course_queue ────────────────────────────────────

ALTER TABLE course_queue ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view the queue (needed for admin page)
CREATE POLICY "Authenticated users can view queue"
  ON course_queue FOR SELECT
  TO authenticated
  USING (true);

-- All mutations are performed by the service role key only;
-- no INSERT/UPDATE/DELETE policies for anon or authenticated users.
