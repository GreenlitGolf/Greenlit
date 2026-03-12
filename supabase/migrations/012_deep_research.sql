-- New enrichment columns on courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS advance_booking_required TEXT,
  ADD COLUMN IF NOT EXISTS caddie_notes TEXT,
  ADD COLUMN IF NOT EXISTS pace_of_play TEXT,
  ADD COLUMN IF NOT EXISTS pricing_notes TEXT,
  ADD COLUMN IF NOT EXISTS insider_tips JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS common_questions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS trip_combinations TEXT;

-- Fix missing priority column on course_queue (code already uses it)
ALTER TABLE course_queue ADD COLUMN IF NOT EXISTS priority BOOLEAN DEFAULT false;
