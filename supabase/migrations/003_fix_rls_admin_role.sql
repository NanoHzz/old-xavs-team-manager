-- Fix RLS policies to include admin role alongside coach
-- Admin should have all coach permissions

-- ============================================================================
-- Player Availability: allow admin to read all team availability
-- ============================================================================

DROP POLICY IF EXISTS "player_availability_read_coach" ON player_availability;
CREATE POLICY "player_availability_read_coach_admin" ON player_availability FOR SELECT
  USING (
    member_id IN (
      SELECT m2.id FROM members m2
      INNER JOIN teams t ON t.id = m2.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

-- Allow players to insert their own availability
DROP POLICY IF EXISTS "player_availability_insert_own" ON player_availability;
CREATE POLICY "player_availability_insert_own" ON player_availability FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Allow players to update their own availability
DROP POLICY IF EXISTS "player_availability_update_own" ON player_availability;
CREATE POLICY "player_availability_update_own" ON player_availability FOR UPDATE
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Player Ratings: allow admin to read/write
-- ============================================================================

DROP POLICY IF EXISTS "player_ratings_read_coach" ON player_ratings;
CREATE POLICY "player_ratings_read_coach_admin" ON player_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      INNER JOIN members rated_member ON rated_member.id = player_ratings.member_id
      WHERE m.team_id = rated_member.team_id
      AND m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "player_ratings_insert_coach" ON player_ratings;
CREATE POLICY "player_ratings_insert_coach_admin" ON player_ratings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      INNER JOIN members rated_member ON rated_member.id = member_id
      WHERE m.team_id = rated_member.team_id
      AND m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "player_ratings_update_coach" ON player_ratings;
CREATE POLICY "player_ratings_update_coach_admin" ON player_ratings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      INNER JOIN members rated_member ON rated_member.id = member_id
      WHERE m.team_id = rated_member.team_id
      AND m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Position Ratings: allow admin to read/write
-- ============================================================================

DROP POLICY IF EXISTS "position_ratings_read_coach" ON position_ratings;
CREATE POLICY "position_ratings_read_coach_admin" ON position_ratings FOR SELECT
  USING (
    player_rating_id IN (
      SELECT pr.id FROM player_ratings pr
      INNER JOIN members m ON m.id = pr.member_id
      INNER JOIN members coach ON coach.team_id = m.team_id
      WHERE coach.user_id = auth.uid() AND coach.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Team Selections: allow admin to CRUD
-- ============================================================================

DROP POLICY IF EXISTS "team_selections_read_coach" ON team_selections;
CREATE POLICY "team_selections_read_coach_admin" ON team_selections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds r
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE r.id = team_selections.round_id
      AND m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "team_selections_insert_coach" ON team_selections;
CREATE POLICY "team_selections_insert_coach_admin" ON team_selections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = created_by
      AND m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "team_selections_update_coach" ON team_selections;
CREATE POLICY "team_selections_update_coach_admin" ON team_selections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = created_by
      AND m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "team_selections_delete_coach" ON team_selections;
CREATE POLICY "team_selections_delete_coach_admin" ON team_selections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = created_by
      AND m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Selection Players: allow admin to CRUD
-- ============================================================================

DROP POLICY IF EXISTS "selection_players_read" ON selection_players;
CREATE POLICY "selection_players_read" ON selection_players FOR SELECT
  USING (
    team_selection_id IN (
      SELECT ts.id FROM team_selections ts
      INNER JOIN rounds r ON r.id = ts.round_id
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
      AND (m.role IN ('coach', 'admin') OR ts.status IN ('finalised', 'sent'))
    )
  );

DROP POLICY IF EXISTS "selection_players_insert" ON selection_players;
CREATE POLICY "selection_players_insert_coach_admin" ON selection_players FOR INSERT
  WITH CHECK (
    team_selection_id IN (
      SELECT ts.id FROM team_selections ts
      INNER JOIN rounds r ON r.id = ts.round_id
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "selection_players_update" ON selection_players;
CREATE POLICY "selection_players_update_coach_admin" ON selection_players FOR UPDATE
  USING (
    team_selection_id IN (
      SELECT ts.id FROM team_selections ts
      INNER JOIN rounds r ON r.id = ts.round_id
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "selection_players_delete" ON selection_players;
CREATE POLICY "selection_players_delete_coach_admin" ON selection_players FOR DELETE
  USING (
    team_selection_id IN (
      SELECT ts.id FROM team_selections ts
      INNER JOIN rounds r ON r.id = ts.round_id
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Rotation Plans: allow admin
-- ============================================================================

DROP POLICY IF EXISTS "rotation_plans_read" ON rotation_plans;
CREATE POLICY "rotation_plans_read_coach_admin" ON rotation_plans FOR SELECT
  USING (
    team_selection_id IN (
      SELECT id FROM team_selections
      WHERE EXISTS (
        SELECT 1 FROM members m
        WHERE m.id = created_by
        AND m.user_id = auth.uid()
        AND m.role IN ('coach', 'admin')
      )
    )
  );

-- ============================================================================
-- Positions: allow admin/coach to insert and update
-- ============================================================================

DROP POLICY IF EXISTS "positions_insert_coach_admin" ON positions;
CREATE POLICY "positions_insert_coach_admin" ON positions FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "positions_update_coach_admin" ON positions;
CREATE POLICY "positions_update_coach_admin" ON positions FOR UPDATE
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Seasons: allow admin/coach to insert and update
-- ============================================================================

DROP POLICY IF EXISTS "seasons_insert_coach_admin" ON seasons;
CREATE POLICY "seasons_insert_coach_admin" ON seasons FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "seasons_update_coach_admin" ON seasons;
CREATE POLICY "seasons_update_coach_admin" ON seasons FOR UPDATE
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Rounds: allow admin/coach to insert and update
-- ============================================================================

DROP POLICY IF EXISTS "rounds_insert_coach_admin" ON rounds;
CREATE POLICY "rounds_insert_coach_admin" ON rounds FOR INSERT
  WITH CHECK (
    season_id IN (
      SELECT s.id FROM seasons s
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "rounds_update_coach_admin" ON rounds;
CREATE POLICY "rounds_update_coach_admin" ON rounds FOR UPDATE
  USING (
    season_id IN (
      SELECT s.id FROM seasons s
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Game Day Roles: allow admin/coach to insert, update, delete
-- ============================================================================

DROP POLICY IF EXISTS "game_day_roles_insert_coach_admin" ON game_day_roles;
CREATE POLICY "game_day_roles_insert_coach_admin" ON game_day_roles FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "game_day_roles_update_coach_admin" ON game_day_roles;
CREATE POLICY "game_day_roles_update_coach_admin" ON game_day_roles FOR UPDATE
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Role Assignments: allow admin/coach to insert, update, delete
-- ============================================================================

DROP POLICY IF EXISTS "role_assignments_insert_coach_admin" ON role_assignments;
CREATE POLICY "role_assignments_insert_coach_admin" ON role_assignments FOR INSERT
  WITH CHECK (
    round_id IN (
      SELECT r.id FROM rounds r
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

DROP POLICY IF EXISTS "role_assignments_update_coach_admin" ON role_assignments;
CREATE POLICY "role_assignments_update_coach_admin" ON role_assignments FOR UPDATE
  USING (
    round_id IN (
      SELECT r.id FROM rounds r
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Notifications: allow coach/admin to insert for any user in their team
-- ============================================================================

DROP POLICY IF EXISTS "notifications_insert_coach_admin" ON notifications;
CREATE POLICY "notifications_insert_coach_admin" ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.role IN ('coach', 'admin')
    )
  );

-- ============================================================================
-- Position Preferences: allow coach/admin to read all for their team
-- ============================================================================

DROP POLICY IF EXISTS "position_preferences_read_coach_admin" ON position_preferences;
CREATE POLICY "position_preferences_read_coach_admin" ON position_preferences FOR SELECT
  USING (
    member_id IN (
      SELECT m2.id FROM members m2
      INNER JOIN teams t ON t.id = m2.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role IN ('coach', 'admin')
    )
  );

-- Allow insert/upsert on position preferences
DROP POLICY IF EXISTS "position_preferences_insert_own" ON position_preferences;
CREATE POLICY "position_preferences_insert_own" ON position_preferences FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "position_preferences_delete_own" ON position_preferences;
CREATE POLICY "position_preferences_delete_own" ON position_preferences FOR DELETE
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Members: allow self-insert (for joining teams)
-- ============================================================================

DROP POLICY IF EXISTS "members_insert_self" ON members;
CREATE POLICY "members_insert_self" ON members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM members m
      WHERE m.team_id = members.team_id
      AND m.user_id = auth.uid()
      AND m.role IN ('admin', 'coach')
    )
  );

-- Allow members to update their own record (jersey, display_name, positions)
DROP POLICY IF EXISTS "members_update_own" ON members;
CREATE POLICY "members_update_own" ON members FOR UPDATE
  USING (user_id = auth.uid());
