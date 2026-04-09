import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Team, Club, Member } from '../types'

interface TeamContextType {
  currentTeam: Team | null
  currentClub: Club | null
  teams: Team[]
  members: Member[]
  currentMember: Member | null
  loading: boolean
  setCurrentTeam: (team: Team | null) => void
  refreshTeams: () => Promise<void>
}

const TeamContext = createContext<TeamContextType | undefined>(undefined)

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)
  const [currentClub, setCurrentClub] = useState<Club | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [currentMember, setCurrentMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTeams = useCallback(async () => {
    if (!user) {
      setTeams([])
      setCurrentTeam(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Get all member records for this user, joining the team data
      const { data, error } = await supabase
        .from('members')
        .select('*, teams(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) throw error

      // Each member row has a single `teams` object (not an array)
      const teamsList: Team[] = []
      if (data) {
        for (const row of data) {
          if (row.teams) {
            teamsList.push(row.teams as unknown as Team)
          }
        }
      }
      setTeams(teamsList)

      // Set first team as default if we don't have one selected
      if (teamsList.length > 0 && !currentTeam) {
        setCurrentTeam(teamsList[0])
      }
    } catch (err) {
      console.error('Error fetching teams:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Fetch user's teams when user changes
  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  // Fetch club and members when team changes
  useEffect(() => {
    if (!currentTeam || !user) return

    const fetchTeamData = async () => {
      // Fetch club and members independently so one failure doesn't block the other
      try {
        const { data: clubData } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', currentTeam.club_id)
          .single()

        if (clubData) {
          setCurrentClub(clubData as Club)
        }
      } catch (err) {
        console.error('Error fetching club:', err)
      }

      try {
        // Get all members of the team
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('*')
          .eq('team_id', currentTeam.id)
          .eq('status', 'active')

        if (membersError) throw membersError
        setMembers(membersData || [])

        // Get current user's member record
        const currentMemberRecord = membersData?.find(m => m.user_id === user.id)
        setCurrentMember(currentMemberRecord || null)
      } catch (err) {
        console.error('Error fetching members:', err)
      }
    }

    fetchTeamData()
  }, [currentTeam, user])

  const value: TeamContextType = {
    currentTeam,
    currentClub,
    teams,
    members,
    currentMember,
    loading,
    setCurrentTeam,
    refreshTeams: fetchTeams,
  }

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

export function useTeam() {
  const context = useContext(TeamContext)
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider')
  }
  return context
}
