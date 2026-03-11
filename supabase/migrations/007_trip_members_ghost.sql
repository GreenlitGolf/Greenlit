-- 007_trip_members_ghost.sql
-- Adds ghost member support to trip_members table
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/kafotvkzzkdqmxdkbsmz/sql

ALTER TABLE trip_members
  ADD COLUMN IF NOT EXISTS display_name   text,
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS handicap       integer,
  ADD COLUMN IF NOT EXISTS role           text    default 'member'
    check (role in ('organizer', 'member')),
  ADD COLUMN IF NOT EXISTS member_type    text    default 'registered'
    check (member_type in ('registered', 'ghost')),
  ADD COLUMN IF NOT EXISTS invite_token   text    unique default gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS invite_status  text    default 'pending'
    check (invite_status in ('pending', 'accepted', 'declined'));

-- Backfill existing members: organizer is the user who created the trip
-- (trip_members rows where user_id matches trips.created_by)
UPDATE trip_members tm
SET role = 'organizer'
FROM trips t
WHERE tm.trip_id = t.id
  AND tm.user_id = t.user_id;
