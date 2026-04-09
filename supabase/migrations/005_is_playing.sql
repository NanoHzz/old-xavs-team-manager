-- Add is_playing column to members table
-- Allows admins/coaches to also be active players (e.g. playing coaches)
-- Defaults to true since most members at a local club are players
ALTER TABLE members ADD COLUMN is_playing BOOLEAN NOT NULL DEFAULT true;
