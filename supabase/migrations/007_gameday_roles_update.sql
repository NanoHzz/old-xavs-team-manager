-- ============================================================================
-- GAMEDAY ROLES: Add missing roles + delete policy
-- ============================================================================

-- 1. Add "Umpire" and "Scoreboard" roles for existing teams (if not already present)
INSERT INTO game_day_roles (team_id, name, description, is_active)
SELECT t.id, 'Umpire', 'Field umpire duties', true
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM game_day_roles g WHERE g.team_id = t.id AND g.name = 'Umpire'
);

INSERT INTO game_day_roles (team_id, name, description, is_active)
SELECT t.id, 'Scoreboard', 'Operates the scoreboard', true
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM game_day_roles g WHERE g.team_id = t.id AND g.name = 'Scoreboard'
);

-- 2. Add delete policy for role_assignments (coach/admin only)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'role_assignments_delete_coach_admin' AND tablename = 'role_assignments'
  ) THEN
    CREATE POLICY "role_assignments_delete_coach_admin" ON role_assignments FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM members m
          WHERE m.user_id = auth.uid()
          AND m.team_id = (
            SELECT g.team_id FROM game_day_roles g WHERE g.id = role_assignments.role_id
          )
          AND m.role IN ('coach', 'admin')
        )
      );
  END IF;
END $$;

-- 3. Update seed function to include Umpire and Scoreboard for new teams
CREATE OR REPLACE FUNCTION seed_game_day_roles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO game_day_roles (team_id, name, description, is_active)
  VALUES
    (NEW.id, 'Umpire', 'Field umpire duties', true),
    (NEW.id, 'Goal Umpire', 'Officiates goal and point scoring', true),
    (NEW.id, 'Runner', 'Delivers messages between coaches and players', true),
    (NEW.id, 'Scoreboard', 'Operates the scoreboard', true),
    (NEW.id, 'Water Carrier', 'Provides hydration and support', true),
    (NEW.id, 'Timekeeper', 'Manages game timing', true),
    (NEW.id, 'First Aid', 'Provides medical assistance', true),
    (NEW.id, 'Team Manager', 'Manages team logistics', true),
    (NEW.id, 'Scorer', 'Records match statistics', true),
    (NEW.id, 'Boundary Umpire', 'Officiates boundary play', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
