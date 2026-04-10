-- AI Team Manager - Initial Schema
-- Created: 2026-04-09

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE sport_type AS ENUM ('afl', 'soccer', 'rugby_league', 'rugby_union');
CREATE TYPE member_role AS ENUM ('admin', 'coach', 'player');
CREATE TYPE member_status AS ENUM ('active', 'inactive');
CREATE TYPE availability_status AS ENUM ('available', 'unavailable', 'maybe');
CREATE TYPE round_status AS ENUM ('upcoming', 'team_selected', 'completed');
CREATE TYPE selection_status AS ENUM ('draft', 'finalised', 'sent');
CREATE TYPE selection_type AS ENUM ('on_field', 'bench', 'emergency', 'omitted');
CREATE TYPE notification_type AS ENUM ('team_announced', 'availability_reminder', 'role_assigned', 'game_reminder');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Clubs
CREATE TABLE clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  primary_colour text DEFAULT '#1e40af',
  secondary_colour text DEFAULT '#ffffff',
  location text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_clubs_created_by ON clubs(created_by);

-- Teams
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sport_type sport_type DEFAULT 'afl',
  on_field_count int DEFAULT 18,
  bench_count int DEFAULT 6,
  emergency_count int DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_teams_club_id ON teams(club_id);
CREATE INDEX idx_teams_sport_type ON teams(sport_type);

-- Positions
CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  abbreviation text,
  category text,
  sort_order int
);

CREATE INDEX idx_positions_team_id ON positions(team_id);
CREATE INDEX idx_positions_sort_order ON positions(team_id, sort_order);

-- Seasons
CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true
);

CREATE INDEX idx_seasons_team_id ON seasons(team_id);
CREATE INDEX idx_seasons_is_active ON seasons(team_id, is_active);

-- Rounds
CREATE TABLE rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  opposition text,
  venue text,
  date_time timestamptz,
  is_bye boolean DEFAULT false,
  availability_deadline timestamptz,
  status round_status DEFAULT 'upcoming'
);

CREATE INDEX idx_rounds_season_id ON rounds(season_id);
CREATE INDEX idx_rounds_date_time ON rounds(date_time);
CREATE INDEX idx_rounds_status ON rounds(status);

-- Members
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role member_role DEFAULT 'player',
  jersey_number text,
  status member_status DEFAULT 'active',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id)
);

CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_team_id ON members(team_id);
CREATE INDEX idx_members_role ON members(team_id, role);
CREATE INDEX idx_members_status ON members(team_id, status);

-- Player Availability
CREATE TABLE player_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  status availability_status DEFAULT 'maybe',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, round_id)
);

CREATE INDEX idx_player_availability_member_id ON player_availability(member_id);
CREATE INDEX idx_player_availability_round_id ON player_availability(round_id);
CREATE INDEX idx_player_availability_status ON player_availability(round_id, status);

-- Position Preferences
CREATE TABLE position_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  preference_rank int,
  UNIQUE(member_id, position_id)
);

CREATE INDEX idx_position_preferences_member_id ON position_preferences(member_id);
CREATE INDEX idx_position_preferences_position_id ON position_preferences(position_id);

-- Player Ratings
CREATE TABLE player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  round_id uuid REFERENCES rounds(id) ON DELETE SET NULL,
  overall int CHECK (overall >= 1 AND overall <= 10),
  fitness int CHECK (fitness >= 1 AND fitness <= 10),
  form int CHECK (form >= 1 AND form <= 10),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_player_ratings_member_id ON player_ratings(member_id);
CREATE INDEX idx_player_ratings_rated_by ON player_ratings(rated_by);
CREATE INDEX idx_player_ratings_round_id ON player_ratings(round_id);

-- Position Ratings
CREATE TABLE position_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_rating_id uuid NOT NULL REFERENCES player_ratings(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  rating int CHECK (rating >= 1 AND rating <= 10)
);

CREATE INDEX idx_position_ratings_player_rating_id ON position_ratings(player_rating_id);
CREATE INDEX idx_position_ratings_position_id ON position_ratings(position_id);

-- Team Selections
CREATE TABLE team_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  status selection_status DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  finalised_at timestamptz,
  notes text
);

CREATE INDEX idx_team_selections_round_id ON team_selections(round_id);
CREATE INDEX idx_team_selections_status ON team_selections(status);
CREATE INDEX idx_team_selections_created_by ON team_selections(created_by);

-- Selection Players
CREATE TABLE selection_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_selection_id uuid NOT NULL REFERENCES team_selections(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  selection_type selection_type NOT NULL,
  is_locked boolean DEFAULT false,
  sort_order int DEFAULT 0
);

CREATE INDEX idx_selection_players_team_selection_id ON selection_players(team_selection_id);
CREATE INDEX idx_selection_players_member_id ON selection_players(member_id);
CREATE INDEX idx_selection_players_position_id ON selection_players(position_id);
CREATE INDEX idx_selection_players_selection_type ON selection_players(team_selection_id, selection_type);

-- Rotation Plans
CREATE TABLE rotation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_selection_id uuid NOT NULL REFERENCES team_selections(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  quarter int CHECK (quarter >= 1 AND quarter <= 4),
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  notes text
);

CREATE INDEX idx_rotation_plans_team_selection_id ON rotation_plans(team_selection_id);
CREATE INDEX idx_rotation_plans_member_id ON rotation_plans(member_id);
CREATE INDEX idx_rotation_plans_quarter ON rotation_plans(quarter);

-- Game Day Roles
CREATE TABLE game_day_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true
);

CREATE INDEX idx_game_day_roles_team_id ON game_day_roles(team_id);

-- Role Assignments
CREATE TABLE role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES game_day_roles(id) ON DELETE CASCADE,
  assigned_to text NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  notes text
);

CREATE INDEX idx_role_assignments_round_id ON role_assignments(round_id);
CREATE INDEX idx_role_assignments_role_id ON role_assignments(role_id);
CREATE INDEX idx_role_assignments_member_id ON role_assignments(member_id);

-- Notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type,
  title text,
  body text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Invite Codes
CREATE TABLE invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  max_uses int,
  use_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_invite_codes_team_id ON invite_codes(team_id);
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_expires_at ON invite_codes(expires_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE selection_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_day_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Clubs: authenticated users can read clubs they belong to, admins can insert/update
CREATE POLICY "clubs_read_own" ON clubs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT DISTINCT c.id
      FROM clubs c
      INNER JOIN teams t ON t.club_id = c.id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "clubs_insert_admin" ON clubs FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
  );

CREATE POLICY "clubs_update_admin" ON clubs FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Teams: members can read their teams, admins can insert/update
CREATE POLICY "teams_read_member" ON teams FOR SELECT
  USING (
    auth.uid() IN (
      SELECT m.user_id FROM members m WHERE m.team_id = teams.id
    )
  );

CREATE POLICY "teams_insert_admin" ON teams FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT created_by FROM clubs WHERE id = club_id
    )
  );

CREATE POLICY "teams_update_admin" ON teams FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT m.user_id FROM members m
      WHERE m.team_id = teams.id AND m.role = 'admin'
    )
  );

-- Positions: users can read positions for their teams
CREATE POLICY "positions_read" ON positions FOR SELECT
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Seasons: users can read seasons for their teams
CREATE POLICY "seasons_read" ON seasons FOR SELECT
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Rounds: users can read rounds for their teams
CREATE POLICY "rounds_read" ON rounds FOR SELECT
  USING (
    season_id IN (
      SELECT s.id FROM seasons s
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Members: users can read members of teams they belong to
CREATE POLICY "members_read" ON members FOR SELECT
  USING (
    team_id IN (
      SELECT m2.team_id FROM members m2 WHERE m2.user_id = auth.uid()
    )
  );

CREATE POLICY "members_insert_admin_coach" ON members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.team_id = members.team_id
      AND m.user_id = auth.uid()
      AND m.role IN ('admin', 'coach')
    )
  );

CREATE POLICY "members_update_admin_coach" ON members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.team_id = members.team_id
      AND m.user_id = auth.uid()
      AND m.role IN ('admin', 'coach')
    )
  );

-- Player Availability: players can read/update their own, coaches can read all for their team
CREATE POLICY "player_availability_read_own" ON player_availability FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "player_availability_read_coach" ON player_availability FOR SELECT
  USING (
    member_id IN (
      SELECT m2.id FROM members m2
      INNER JOIN teams t ON t.id = m2.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid() AND m.role = 'coach'
    )
  );

CREATE POLICY "player_availability_update_own" ON player_availability FOR UPDATE
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Position Preferences: players can read/update their own
CREATE POLICY "position_preferences_read_own" ON position_preferences FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "position_preferences_update_own" ON position_preferences FOR UPDATE
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Player Ratings: only coaches can read/write
CREATE POLICY "player_ratings_read_coach" ON player_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      INNER JOIN members rated_member ON rated_member.id = player_ratings.member_id
      WHERE m.team_id = rated_member.team_id
      AND m.user_id = auth.uid()
      AND m.role = 'coach'
    )
  );

CREATE POLICY "player_ratings_insert_coach" ON player_ratings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      INNER JOIN members rated_member ON rated_member.id = member_id
      WHERE m.team_id = rated_member.team_id
      AND m.user_id = auth.uid()
      AND m.role = 'coach'
    )
  );

CREATE POLICY "player_ratings_update_coach" ON player_ratings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      INNER JOIN members rated_member ON rated_member.id = member_id
      WHERE m.team_id = rated_member.team_id
      AND m.user_id = auth.uid()
      AND m.role = 'coach'
    )
  );

-- Position Ratings: only coaches can read/write (via player_ratings)
CREATE POLICY "position_ratings_read_coach" ON position_ratings FOR SELECT
  USING (
    player_rating_id IN (
      SELECT id FROM player_ratings WHERE player_rating_id IN (
        SELECT id FROM player_ratings pr
        INNER JOIN members m ON m.id = pr.member_id
        INNER JOIN members coach ON coach.team_id = m.team_id
        WHERE coach.user_id = auth.uid() AND coach.role = 'coach'
      )
    )
  );

-- Team Selections: coaches can CRUD, players can read finalised/sent
CREATE POLICY "team_selections_read_coach" ON team_selections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      INNER JOIN team_selections ts ON ts.created_by = m.id
      WHERE ts.id = team_selections.id
      AND m.user_id = auth.uid()
      AND m.role = 'coach'
    )
  );

CREATE POLICY "team_selections_read_player" ON team_selections FOR SELECT
  USING (
    status IN ('finalised', 'sent')
    AND EXISTS (
      SELECT 1 FROM rounds r
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE r.id = team_selections.round_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "team_selections_insert_coach" ON team_selections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = created_by
      AND m.user_id = auth.uid()
      AND m.role = 'coach'
    )
  );

CREATE POLICY "team_selections_update_coach" ON team_selections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = created_by
      AND m.user_id = auth.uid()
      AND m.role = 'coach'
    )
  );

CREATE POLICY "team_selections_delete_coach" ON team_selections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = created_by
      AND m.user_id = auth.uid()
      AND m.role = 'coach'
    )
  );

-- Selection Players: inherit from team_selections
CREATE POLICY "selection_players_read" ON selection_players FOR SELECT
  USING (
    team_selection_id IN (
      SELECT id FROM team_selections
      WHERE EXISTS (
        SELECT 1 FROM members m
        WHERE m.id = created_by
        AND m.user_id = auth.uid()
        AND m.role = 'coach'
      )
      OR status IN ('finalised', 'sent')
    )
  );

-- Rotation Plans: inherit from team_selections
CREATE POLICY "rotation_plans_read" ON rotation_plans FOR SELECT
  USING (
    team_selection_id IN (
      SELECT id FROM team_selections
      WHERE EXISTS (
        SELECT 1 FROM members m
        WHERE m.id = created_by
        AND m.user_id = auth.uid()
        AND m.role = 'coach'
      )
    )
  );

-- Game Day Roles: team members can read
CREATE POLICY "game_day_roles_read" ON game_day_roles FOR SELECT
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Role Assignments: team members can read
CREATE POLICY "role_assignments_read" ON role_assignments FOR SELECT
  USING (
    round_id IN (
      SELECT r.id FROM rounds r
      INNER JOIN seasons s ON s.id = r.season_id
      INNER JOIN teams t ON t.id = s.team_id
      INNER JOIN members m ON m.team_id = t.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Notifications: users can only read their own
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Invite Codes: admins can CRUD, anyone authenticated can read
CREATE POLICY "invite_codes_read_authenticated" ON invite_codes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "invite_codes_insert_admin" ON invite_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.team_id = invite_codes.team_id
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
    )
  );

CREATE POLICY "invite_codes_update_admin" ON invite_codes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.team_id = invite_codes.team_id
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
    )
  );

CREATE POLICY "invite_codes_delete_admin" ON invite_codes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.team_id = invite_codes.team_id
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
    )
  );

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to seed default AFL positions when a new team is created
CREATE OR REPLACE FUNCTION seed_afl_positions()
RETURNS TRIGGER AS $$
DECLARE
  position_data record;
BEGIN
  IF NEW.sport_type = 'afl' THEN
    -- Insert default AFL positions with sort order
    INSERT INTO positions (team_id, name, abbreviation, category, sort_order)
    VALUES
      (NEW.id, 'Full Back', 'FB', 'Defence', 1),
      (NEW.id, 'Back Pocket', 'BP', 'Defence', 2),
      (NEW.id, 'Back Pocket', 'BP', 'Defence', 3),
      (NEW.id, 'Centre Half Back', 'CHB', 'Defence', 4),
      (NEW.id, 'Half Back Flank', 'HBF', 'Defence', 5),
      (NEW.id, 'Half Back Flank', 'HBF', 'Defence', 6),
      (NEW.id, 'Wing', 'W', 'Midfield', 7),
      (NEW.id, 'Wing', 'W', 'Midfield', 8),
      (NEW.id, 'Centre', 'C', 'Midfield', 9),
      (NEW.id, 'Ruck', 'R', 'Ruck', 10),
      (NEW.id, 'Ruck Rover', 'RR', 'Midfield', 11),
      (NEW.id, 'Rover', 'ROV', 'Midfield', 12),
      (NEW.id, 'Half Forward Flank', 'HFF', 'Forward', 13),
      (NEW.id, 'Half Forward Flank', 'HFF', 'Forward', 14),
      (NEW.id, 'Centre Half Forward', 'CHF', 'Forward', 15),
      (NEW.id, 'Forward Pocket', 'FP', 'Forward', 16),
      (NEW.id, 'Forward Pocket', 'FP', 'Forward', 17),
      (NEW.id, 'Full Forward', 'FF', 'Forward', 18),
      (NEW.id, 'Interchange 1', 'INT', 'Bench', 19),
      (NEW.id, 'Interchange 2', 'INT', 'Bench', 20),
      (NEW.id, 'Interchange 3', 'INT', 'Bench', 21),
      (NEW.id, 'Interchange 4', 'INT', 'Bench', 22),
      (NEW.id, 'Interchange 5', 'INT', 'Bench', 23),
      (NEW.id, 'Interchange 6', 'INT', 'Bench', 24);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER seed_afl_positions_trigger
AFTER INSERT ON teams
FOR EACH ROW
EXECUTE FUNCTION seed_afl_positions();

-- Function to seed default game day roles when a new team is created
CREATE OR REPLACE FUNCTION seed_game_day_roles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO game_day_roles (team_id, name, description, is_active)
  VALUES
    (NEW.id, 'Goal Umpire', 'Officiates goal and point scoring', true),
    (NEW.id, 'Boundary Umpire', 'Officiates boundary play', true),
    (NEW.id, 'Runner', 'Delivers messages between coaches and players', true),
    (NEW.id, 'Water Carrier', 'Provides hydration and support', true),
    (NEW.id, 'Timekeeper', 'Manages game timing', true),
    (NEW.id, 'First Aid', 'Provides medical assistance', true),
    (NEW.id, 'Team Manager', 'Manages team logistics', true),
    (NEW.id, 'Scorer', 'Records match statistics', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER seed_game_day_roles_trigger
AFTER INSERT ON teams
FOR EACH ROW
EXECUTE FUNCTION seed_game_day_roles();

-- ============================================================================
-- INDEXES (additional compound indexes)
-- ============================================================================

-- Team membership queries
CREATE INDEX idx_members_active ON members(team_id, status) WHERE status = 'active';

-- Availability queries
CREATE INDEX idx_player_availability_round_status ON player_availability(round_id) WHERE status != 'maybe';

-- Selection queries
CREATE INDEX idx_selection_players_type_locked ON selection_players(team_selection_id, selection_type, is_locked);

-- Notification queries
CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, read, created_at DESC);

-- Round queries by season and date
CREATE INDEX idx_rounds_season_date ON rounds(season_id, date_time);

-- Invite code active queries
CREATE INDEX idx_invite_codes_active ON invite_codes(team_id) WHERE expires_at > now() OR expires_at IS NULL;
