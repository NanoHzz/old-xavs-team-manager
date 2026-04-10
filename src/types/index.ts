import type { Database } from './database'

// Table Row Types
export type Club = Database['public']['Tables']['clubs']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Position = Database['public']['Tables']['positions']['Row']
export type Season = Database['public']['Tables']['seasons']['Row']
export type Round = Database['public']['Tables']['rounds']['Row']
export type Member = Database['public']['Tables']['members']['Row']
export type PlayerAvailability = Database['public']['Tables']['player_availability']['Row']
export type PositionPreference = Database['public']['Tables']['position_preferences']['Row']
export type PlayerRating = Database['public']['Tables']['player_ratings']['Row']
export type PositionRating = Database['public']['Tables']['position_ratings']['Row']
export type TeamSelection = Database['public']['Tables']['team_selections']['Row']
export type SelectionPlayer = Database['public']['Tables']['selection_players']['Row']
export type RotationPlan = Database['public']['Tables']['rotation_plans']['Row']
export type GameDayRole = Database['public']['Tables']['game_day_roles']['Row']
export type RoleAssignment = Database['public']['Tables']['role_assignments']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type TeamAnnouncement = Database['public']['Tables']['team_announcements']['Row']
export type AnnouncementComment = Database['public']['Tables']['announcement_comments']['Row']
export type PlayerGameStats = Database['public']['Tables']['player_game_stats']['Row']
export type PlayerVotes = Database['public']['Tables']['player_votes']['Row']
export type InviteCode = Database['public']['Tables']['invite_codes']['Row']

// Insert Types
export type ClubInsert = Database['public']['Tables']['clubs']['Insert']
export type TeamInsert = Database['public']['Tables']['teams']['Insert']
export type PositionInsert = Database['public']['Tables']['positions']['Insert']
export type SeasonInsert = Database['public']['Tables']['seasons']['Insert']
export type RoundInsert = Database['public']['Tables']['rounds']['Insert']
export type MemberInsert = Database['public']['Tables']['members']['Insert']
export type PlayerAvailabilityInsert = Database['public']['Tables']['player_availability']['Insert']
export type PositionPreferenceInsert = Database['public']['Tables']['position_preferences']['Insert']
export type PlayerRatingInsert = Database['public']['Tables']['player_ratings']['Insert']
export type PositionRatingInsert = Database['public']['Tables']['position_ratings']['Insert']
export type TeamSelectionInsert = Database['public']['Tables']['team_selections']['Insert']
export type SelectionPlayerInsert = Database['public']['Tables']['selection_players']['Insert']
export type RotationPlanInsert = Database['public']['Tables']['rotation_plans']['Insert']
export type GameDayRoleInsert = Database['public']['Tables']['game_day_roles']['Insert']
export type RoleAssignmentInsert = Database['public']['Tables']['role_assignments']['Insert']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']
export type TeamAnnouncementInsert = Database['public']['Tables']['team_announcements']['Insert']
export type AnnouncementCommentInsert = Database['public']['Tables']['announcement_comments']['Insert']
export type PlayerGameStatsInsert = Database['public']['Tables']['player_game_stats']['Insert']
export type PlayerVotesInsert = Database['public']['Tables']['player_votes']['Insert']
export type InviteCodeInsert = Database['public']['Tables']['invite_codes']['Insert']

// Update Types
export type ClubUpdate = Database['public']['Tables']['clubs']['Update']
export type TeamUpdate = Database['public']['Tables']['teams']['Update']
export type PositionUpdate = Database['public']['Tables']['positions']['Update']
export type SeasonUpdate = Database['public']['Tables']['seasons']['Update']
export type RoundUpdate = Database['public']['Tables']['rounds']['Update']
export type MemberUpdate = Database['public']['Tables']['members']['Update']
export type PlayerAvailabilityUpdate = Database['public']['Tables']['player_availability']['Update']
export type PositionPreferenceUpdate = Database['public']['Tables']['position_preferences']['Update']
export type PlayerRatingUpdate = Database['public']['Tables']['player_ratings']['Update']
export type PositionRatingUpdate = Database['public']['Tables']['position_ratings']['Update']
export type TeamSelectionUpdate = Database['public']['Tables']['team_selections']['Update']
export type SelectionPlayerUpdate = Database['public']['Tables']['selection_players']['Update']
export type RotationPlanUpdate = Database['public']['Tables']['rotation_plans']['Update']
export type GameDayRoleUpdate = Database['public']['Tables']['game_day_roles']['Update']
export type RoleAssignmentUpdate = Database['public']['Tables']['role_assignments']['Update']
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update']
export type InviteCodeUpdate = Database['public']['Tables']['invite_codes']['Update']

// Derived Types
export interface MemberWithUser extends Member {
  user_email?: string
  user_name?: string
  full_name?: string
}
