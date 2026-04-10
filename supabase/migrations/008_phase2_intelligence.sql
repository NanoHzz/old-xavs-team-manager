-- ============================================================================
-- PHASE 2: Intelligence — opposition ratings, position category ratings,
--          external/guest players
-- ============================================================================

-- 1. Add opposition rating to rounds (1-5 stars)
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS opposition_rating int
  CHECK (opposition_rating >= 1 AND opposition_rating <= 5);

-- 2. Position category ratings (Backs, Midfield, Forward, Ruck)
--    Separate from individual position_ratings table for simplicity
CREATE TABLE IF NOT EXISTS player_category_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Backs', 'Midfield', 'Forward', 'Ruck')),
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 10),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, category)
);

ALTER TABLE player_category_ratings ENABLE ROW LEVEL SECURITY;

-- Coaches/admin in same team can read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'category_ratings_read' AND tablename = 'player_category_ratings') THEN
    CREATE POLICY "category_ratings_read" ON player_category_ratings FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM members m
          WHERE m.user_id = auth.uid()
          AND m.role IN ('coach', 'admin')
          AND m.team_id = (SELECT team_id FROM members WHERE id = player_category_ratings.member_id)
        )
      );
  END IF;
END $$;

-- Coaches/admin can insert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'category_ratings_insert' AND tablename = 'player_category_ratings') THEN
    CREATE POLICY "category_ratings_insert" ON player_category_ratings FOR INSERT
      WITH CHECK (
        rated_by IN (
          SELECT id FROM members WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
        )
      );
  END IF;
END $$;

-- Coaches/admin can update
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'category_ratings_update' AND tablename = 'player_category_ratings') THEN
    CREATE POLICY "category_ratings_update" ON player_category_ratings FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM members m
          WHERE m.user_id = auth.uid()
          AND m.role IN ('coach', 'admin')
          AND m.team_id = (SELECT team_id FROM members WHERE id = player_category_ratings.member_id)
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_category_ratings_member ON player_category_ratings(member_id);
CREATE INDEX IF NOT EXISTS idx_category_ratings_category ON player_category_ratings(category);

-- 3. External player fields on members
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_external boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS external_rating int CHECK (external_rating >= 1 AND external_rating <= 10);
