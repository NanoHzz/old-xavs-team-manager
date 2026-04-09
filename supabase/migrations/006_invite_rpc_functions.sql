-- Create a SECURITY DEFINER function to let any authenticated user
-- look up invite info (bypasses RLS on teams/clubs)
CREATE OR REPLACE FUNCTION get_invite_info(invite_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'invite_id', ic.id,
    'team_id', t.id,
    'team_name', t.name,
    'club_name', c.name,
    'expires_at', ic.expires_at,
    'max_uses', ic.max_uses,
    'use_count', ic.use_count
  ) INTO result
  FROM invite_codes ic
  JOIN teams t ON t.id = ic.team_id
  JOIN clubs c ON c.id = t.club_id
  WHERE ic.code = invite_code;

  RETURN result;
END;
$$;

-- Create a function to check if user is already a member of a team
CREATE OR REPLACE FUNCTION check_team_membership(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_member BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND status = 'active'
  ) INTO is_member;

  RETURN is_member;
END;
$$;
