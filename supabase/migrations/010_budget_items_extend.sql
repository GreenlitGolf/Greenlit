-- ============================================================
-- Migration 010: Extend budget_items with per_person + notes
-- Run this in the Supabase SQL editor after 008_tee_times.sql
-- ============================================================

-- Add per_person flag: true = amount is per person, false = amount is trip total
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS per_person BOOLEAN DEFAULT false;

-- Add free-text notes field
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS notes TEXT;
