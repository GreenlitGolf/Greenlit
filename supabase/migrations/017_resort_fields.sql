-- ============================================================
-- Migration 017: Resort name/slug fields on courses
-- Enables grouping individual courses by parent resort property
-- Run this in the Supabase SQL editor
-- ============================================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS resort_name TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS resort_slug TEXT;

-- Index for resort grouping queries
CREATE INDEX IF NOT EXISTS idx_courses_resort_slug ON courses (resort_slug);
