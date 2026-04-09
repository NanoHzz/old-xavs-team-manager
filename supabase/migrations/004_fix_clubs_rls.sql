-- Fix clubs_read_own RLS policy
-- The original policy compared auth.uid() (user UUID) against club IDs (always false)
-- This corrects it to check if the user is a member of a team belonging to the club

DROP POLICY IF EXISTS "clubs_read_own" ON clubs;
CREATE POLICY "clubs_read_own" ON clubs FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT c.id
      FROM clubs c
      INNER JOIN teams t ON t.club_id = c.id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
    )
  );
