-- Migration: Add display_name and position preferences to members
-- Run this in the Supabase SQL Editor

-- Add display_name column
ALTER TABLE members ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add position preference columns
ALTER TABLE members ADD COLUMN IF NOT EXISTS primary_position TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS secondary_position TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS third_position TEXT;

-- Update Will Honan's existing member record
UPDATE members
SET display_name = 'Will Honan'
WHERE user_id = 'e53a98fc-af5a-4d3d-a17f-34f5ac6935be';

-- Backfill display_name for any other members from auth metadata
UPDATE members m
SET display_name = COALESCE(
  (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = m.user_id),
  (SELECT email FROM auth.users WHERE id = m.user_id)
)
WHERE m.display_name IS NULL AND m.is_guest = FALSE;

-- Set display_name for guest players from guest_name
UPDATE members
SET display_name = guest_name
WHERE is_guest = TRUE AND display_name IS NULL AND guest_name IS NOT NULL;
