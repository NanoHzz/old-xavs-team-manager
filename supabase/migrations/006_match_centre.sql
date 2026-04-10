-- ============================================================================
-- MATCH CENTRE: Game stats, voting, and RLS fixes
-- ============================================================================

-- 1. Fix: Allow players to update their OWN member record (jersey, positions)
CREATE POLICY "members_update_self" ON members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Add Interchange 5 & 6 for existing teams
INSERT INTO positions (team_id, name, abbreviation, category, sort_order)
SELECT t.id, 'Interchange 5', 'INT', 'Bench', 23
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM positions p WHERE p.team_id = t.id AND p.name = 'Interchange 5'
);

INSERT INTO positions (team_id, name, abbreviation, category, sort_order)
SELECT t.id, 'Interchange 6', 'INT', 'Bench', 24
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM positions p WHERE p.team_id = t.id AND p.name = 'Interchange 6'
);

-- 3. Player game stats (goals/behinds per player per round)
CREATE TABLE IF NOT EXISTS player_game_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  goals int DEFAULT 0,
  behinds int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(round_id, member_id)
);

ALTER TABLE player_game_stats ENABLE ROW LEVEL SECURITY;

-- Team members can view all stats for their team's rounds
CREATE POLICY "game_stats_read" ON player_game_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN rounds r ON r.season_id IN (
        SELECT s.id FROM seasons s WHERE s.team_id = m.team_id
      )
      WHERE m.user_id = auth.uid()
      AND r.id = player_game_stats.round_id
    )
  );

-- Players can insert their own stats
CREATE POLICY "game_stats_insert" ON player_game_stats FOR INSERT
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Players can update their own stats
CREATE POLICY "game_stats_update" ON player_game_stats FOR UPDATE
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- 4. Player votes (best & fairest voting)
CREATE TABLE IF NOT EXISTS player_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  voter_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  voted_for_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  votes int NOT NULL CHECK (votes BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE(round_id, voter_member_id, votes)
);

ALTER TABLE player_votes ENABLE ROW LEVEL SECURITY;

-- Everyone in the team can read votes (visibility controlled in app for coaches only)
CREATE POLICY "votes_read" ON player_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN rounds r ON r.season_id IN (
        SELECT s.id FROM seasons s WHERE s.team_id = m.team_id
      )
      WHERE m.user_id = auth.uid()
      AND r.id = player_votes.round_id
    )
  );

-- Players can insert their own votes
CREATE POLICY "votes_insert" ON player_votes FOR INSERT
  WITH CHECK (
    voter_member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Players can update their own votes
CREATE POLICY "votes_update" ON player_votes FOR UPDATE
  USING (
    voter_member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Players can delete their own votes (to re-vote)
CREATE POLICY "votes_delete" ON player_votes FOR DELETE
  USING (
    voter_member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_stats_round ON player_game_stats(round_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_member ON player_game_stats(member_id);
CREATE INDEX IF NOT EXISTS idx_votes_round ON player_votes(round_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON player_votes(voter_member_id);
