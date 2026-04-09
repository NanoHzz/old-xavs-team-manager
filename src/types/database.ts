export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      clubs: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          primary_colour: string
          secondary_colour: string
          location: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          primary_colour?: string
          secondary_colour?: string
          location?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          primary_colour?: string
          secondary_colour?: string
          location?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          club_id: string
          name: string
          sport_type: 'afl' | 'soccer' | 'rugby_league' | 'rugby_union'
          on_field_count: number
          bench_count: number
          emergency_count: number
          created_at: string
          settings: Json
        }
        Insert: {
          id?: string
          club_id: string
          name: string
          sport_type?: 'afl' | 'soccer' | 'rugby_league' | 'rugby_union'
          on_field_count?: number
          bench_count?: number
          emergency_count?: number
          created_at?: string
          settings?: Json
        }
        Update: {
          id?: string
          club_id?: string
          name?: string
          sport_type?: 'afl' | 'soccer' | 'rugby_league' | 'rugby_union'
          on_field_count?: number
          bench_count?: number
          emergency_count?: number
          created_at?: string
          settings?: Json
        }
        Relationships: []
      }
      positions: {
        Row: {
          id: string
          team_id: string
          name: string
          abbreviation: string | null
          category: string | null
          sort_order: number | null
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          abbreviation?: string | null
          category?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          abbreviation?: string | null
          category?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          id: string
          team_id: string
          name: string
          start_date: string
          end_date: string
          is_active: boolean
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          start_date: string
          end_date: string
          is_active?: boolean
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          start_date?: string
          end_date?: string
          is_active?: boolean
        }
        Relationships: []
      }
      rounds: {
        Row: {
          id: string
          season_id: string
          round_number: number
          opposition: string | null
          venue: string | null
          date_time: string | null
          is_bye: boolean
          availability_deadline: string | null
          status: 'upcoming' | 'team_selected' | 'completed'
        }
        Insert: {
          id?: string
          season_id: string
          round_number: number
          opposition?: string | null
          venue?: string | null
          date_time?: string | null
          is_bye?: boolean
          availability_deadline?: string | null
          status?: 'upcoming' | 'team_selected' | 'completed'
        }
        Update: {
          id?: string
          season_id?: string
          round_number?: number
          opposition?: string | null
          venue?: string | null
          date_time?: string | null
          is_bye?: boolean
          availability_deadline?: string | null
          status?: 'upcoming' | 'team_selected' | 'completed'
        }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          user_id: string
          team_id: string
          role: 'admin' | 'coach' | 'player'
          jersey_number: string | null
          status: 'active' | 'inactive'
          is_guest: boolean
          guest_name: string | null
          display_name: string | null
          primary_position: string | null
          secondary_position: string | null
          third_position: string | null
          is_playing: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          user_id: string
          team_id: string
          role?: 'admin' | 'coach' | 'player'
          jersey_number?: string | null
          status?: 'active' | 'inactive'
          is_guest?: boolean
          guest_name?: string | null
          display_name?: string | null
          primary_position?: string | null
          secondary_position?: string | null
          third_position?: string | null
          is_playing?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string
          role?: 'admin' | 'coach' | 'player'
          jersey_number?: string | null
          status?: 'active' | 'inactive'
          is_guest?: boolean
          guest_name?: string | null
          display_name?: string | null
          primary_position?: string | null
          secondary_position?: string | null
          third_position?: string | null
          is_playing?: boolean
          joined_at?: string
        }
        Relationships: []
      }
      player_availability: {
        Row: {
          id: string
          member_id: string
          round_id: string
          status: 'available' | 'unavailable' | 'maybe'
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          round_id: string
          status?: 'available' | 'unavailable' | 'maybe'
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          round_id?: string
          status?: 'available' | 'unavailable' | 'maybe'
          updated_at?: string
        }
        Relationships: []
      }
      position_preferences: {
        Row: {
          id: string
          member_id: string
          position_id: string
          preference_rank: number | null
        }
        Insert: {
          id?: string
          member_id: string
          position_id: string
          preference_rank?: number | null
        }
        Update: {
          id?: string
          member_id?: string
          position_id?: string
          preference_rank?: number | null
        }
        Relationships: []
      }
      player_ratings: {
        Row: {
          id: string
          member_id: string
          rated_by: string
          round_id: string | null
          overall: number | null
          fitness: number | null
          form: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          rated_by: string
          round_id?: string | null
          overall?: number | null
          fitness?: number | null
          form?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          rated_by?: string
          round_id?: string | null
          overall?: number | null
          fitness?: number | null
          form?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      position_ratings: {
        Row: {
          id: string
          player_rating_id: string
          position_id: string
          rating: number | null
        }
        Insert: {
          id?: string
          player_rating_id: string
          position_id: string
          rating?: number | null
        }
        Update: {
          id?: string
          player_rating_id?: string
          position_id?: string
          rating?: number | null
        }
        Relationships: []
      }
      team_selections: {
        Row: {
          id: string
          round_id: string
          status: 'draft' | 'finalised' | 'sent'
          created_by: string
          finalised_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          round_id: string
          status?: 'draft' | 'finalised' | 'sent'
          created_by: string
          finalised_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          round_id?: string
          status?: 'draft' | 'finalised' | 'sent'
          created_by?: string
          finalised_at?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      selection_players: {
        Row: {
          id: string
          team_selection_id: string
          member_id: string
          position_id: string | null
          selection_type: 'on_field' | 'bench' | 'emergency' | 'omitted'
          is_locked: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          team_selection_id: string
          member_id: string
          position_id?: string | null
          selection_type: 'on_field' | 'bench' | 'emergency' | 'omitted'
          is_locked?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          team_selection_id?: string
          member_id?: string
          position_id?: string | null
          selection_type?: 'on_field' | 'bench' | 'emergency' | 'omitted'
          is_locked?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      rotation_plans: {
        Row: {
          id: string
          team_selection_id: string
          member_id: string
          quarter: number | null
          position_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          team_selection_id: string
          member_id: string
          quarter?: number | null
          position_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          team_selection_id?: string
          member_id?: string
          quarter?: number | null
          position_id?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      game_day_roles: {
        Row: {
          id: string
          team_id: string
          name: string
          description: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          description?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          description?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      role_assignments: {
        Row: {
          id: string
          round_id: string
          role_id: string
          assigned_to: string
          member_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          round_id: string
          role_id: string
          assigned_to: string
          member_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          round_id?: string
          role_id?: string
          assigned_to?: string
          member_id?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string | null
          title: string | null
          body: string | null
          read: boolean
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          type?: string | null
          title?: string | null
          body?: string | null
          read?: boolean
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          type?: string | null
          title?: string | null
          body?: string | null
          read?: boolean
          created_at?: string
          metadata?: Json
        }
        Relationships: []
      }
      team_announcements: {
        Row: {
          id: string
          team_id: string
          member_id: string
          title: string
          body: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          member_id: string
          title: string
          body?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          member_id?: string
          title?: string
          body?: string | null
          created_at?: string
        }
        Relationships: []
      }
      announcement_comments: {
        Row: {
          id: string
          announcement_id: string
          member_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          announcement_id: string
          member_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          announcement_id?: string
          member_id?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          id: string
          team_id: string
          code: string
          created_by: string
          expires_at: string | null
          max_uses: number | null
          use_count: number
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          code: string
          created_by: string
          expires_at?: string | null
          max_uses?: number | null
          use_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          code?: string
          created_by?: string
          expires_at?: string | null
          max_uses?: number | null
          use_count?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_invite_info: {
        Args: { invite_code: string }
        Returns: Json
      }
      check_team_membership: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      sport_type: 'afl' | 'soccer' | 'rugby_league' | 'rugby_union'
      member_role: 'admin' | 'coach' | 'player'
      member_status: 'active' | 'inactive'
      availability_status: 'available' | 'unavailable' | 'maybe'
      round_status: 'upcoming' | 'team_selected' | 'completed'
      selection_status: 'draft' | 'finalised' | 'sent'
      selection_type: 'on_field' | 'bench' | 'emergency' | 'omitted'
      notification_type: 'team_announced' | 'availability_reminder' | 'role_assigned' | 'game_reminder'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
