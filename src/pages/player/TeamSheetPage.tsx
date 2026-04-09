import { useEffect, useState } from 'react'
import { formatDateTime } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Card } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { AflOval } from '../../components/ui/AflOval'
import { Users, LayoutGrid, Map } from 'lucide-react'
import type { Round, TeamSelection, SelectionPlayer, GameDayRole } from '../../types'

interface TeamSheetPlayer extends SelectionPlayer {
  memberName?: string
  jerseyNumber?: string | null
  positionName?: string
  primaryPosition?: string | null
}

interface RoleWithAssignment extends GameDayRole {
  assignedTo?: string
}

interface TeamSheetData {
  round: Round
  teamSelection: TeamSelection
  players: TeamSheetPlayer[]
  roles: RoleWithAssignment[]
  currentPlayerPosition?: string
}

type ViewMode = 'oval' | 'list'

export default function TeamSheetPage() {
  const { currentTeam, currentMember, members } = useTeam()

  const [rounds, setRounds] = useState<Round[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [teamSheet, setTeamSheet] = useState<TeamSheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('oval')

  // Fetch all rounds
  useEffect(() => {
    if (!currentTeam) {
      setLoading(false)
      return
    }

    const fetchRounds = async () => {
      // Get active seasons for team
      const { data: seasonsData } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', currentTeam.id)
        .eq('is_active', true)

      const seasonIds = seasonsData?.map(s => s.id) || []

      const { data, error } = seasonIds.length > 0
        ? await supabase
            .from('rounds')
            .select('*')
            .in('season_id', seasonIds)
            .order('round_number', { ascending: true })
        : { data: [], error: null }

      if (error) {
        console.error('Error fetching rounds:', error)
        setRounds([])
      } else {
        const allRounds = data || []
        setRounds(allRounds)
        // Default to nearest upcoming round
        if (allRounds.length > 0 && !selectedRoundId) {
          // 1. Try to find first round with status 'upcoming' or 'team_selected'
          const activeRound = allRounds.find(r => r.status === 'upcoming' || r.status === 'team_selected')
          if (activeRound) {
            setSelectedRoundId(activeRound.id)
          } else {
            // 2. Try date-based: first round with a future date_time
            const now = new Date().getTime()
            const upcoming = allRounds.find(r => r.date_time && new Date(r.date_time).getTime() >= now)
            if (upcoming) {
              setSelectedRoundId(upcoming.id)
            } else {
              // 3. Fallback: most recent completed round, or first round
              const completed = [...allRounds].reverse().find(r => r.status === 'completed')
              setSelectedRoundId(completed ? completed.id : allRounds[0].id)
            }
          }
        }
      }
    }

    fetchRounds()
  }, [currentTeam])

  // Fetch team sheet for selected round
  useEffect(() => {
    if (!currentTeam || !currentMember || !selectedRoundId) {
      setTeamSheet(null)
      setLoading(false)
      return
    }

    const fetchTeamSheet = async () => {
      setLoading(true)
      try {
        const selectedRound = rounds.find(r => r.id === selectedRoundId)
        if (!selectedRound) return

        // Fetch team selection
        const { data: teamSelectionData, error: tsError } = await supabase
          .from('team_selections')
          .select('*')
          .eq('round_id', selectedRoundId)
          .single()

        if (tsError || !teamSelectionData) {
          setTeamSheet(null)
          return
        }

        // Fetch selection players with positions
        const { data: selectionPlayersData, error: spError } = await supabase
          .from('selection_players')
          .select(`
            *,
            positions(name),
            members(jersey_number, user_id)
          `)
          .eq('team_selection_id', teamSelectionData.id)

        if (spError) throw spError

        // Build player info
        const playersWithInfo = (selectionPlayersData || []).map(player => {
          const member = members.find(m => m.id === player.member_id)
          return {
            ...player,
            memberName: member?.display_name || member?.guest_name || 'Unknown',
            jerseyNumber: member?.jersey_number,
            positionName: (player.positions as unknown as { name: string } | null)?.name,
            primaryPosition: member?.primary_position,
          }
        })

        // Fetch game day roles
        const { data: rolesData } = await supabase
          .from('game_day_roles')
          .select('*')
          .eq('team_id', currentTeam.id)

        const roleIds = rolesData?.map(r => r.id) || []
        let rolesWithAssignments: RoleWithAssignment[] = rolesData || []

        if (roleIds.length > 0) {
          const { data: assignmentsData } = await supabase
            .from('role_assignments')
            .select(`
              *,
              members(user_id)
            `)
            .in('role_id', roleIds)

          rolesWithAssignments = (rolesData || []).map(role => {
            const assignment = assignmentsData?.find(a => a.role_id === role.id)
            const assignedMember = assignment ? members.find(m => m.id === assignment.member_id) : null
            return {
              ...role,
              assignedTo: assignedMember ? (assignedMember.display_name || assignedMember.guest_name || 'Unknown') : undefined,
            }
          })
        }

        // Find current player's position
        const currentPlayerSelection = playersWithInfo.find(p => p.member_id === currentMember.id)

        setTeamSheet({
          round: selectedRound,
          teamSelection: teamSelectionData,
          players: playersWithInfo,
          roles: rolesWithAssignments,
          currentPlayerPosition: currentPlayerSelection?.positionName,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTeamSheet()
  }, [currentTeam, currentMember, selectedRoundId, rounds, members])

  const getFieldPlayers = () => teamSheet?.players.filter(p => p.selection_type === 'on_field') || []
  const getBenchPlayers = () => teamSheet?.players.filter(p => p.selection_type !== 'on_field') || []

  const groupPlayersByPosition = (players: TeamSheetPlayer[]) => {
    return players.reduce(
      (acc, player) => {
        const pos = player.positionName || 'Unknown'
        if (!acc[pos]) acc[pos] = []
        acc[pos].push(player)
        return acc
      },
      {} as Record<string, TeamSheetPlayer[]>
    )
  }

  if (loading) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Team Sheet</h1>
        <LoadingSpinner />
      </div>
    )
  }

  if (rounds.length === 0) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Team Sheet</h1>
        <Card>
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title="No rounds available"
            description="There are no rounds scheduled."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Sheet</h1>
          <p className="text-gray-500 text-sm mt-1">View the selected team for your match</p>
        </div>
        {/* View toggle */}
        {rounds.length > 0 && (
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('oval')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'oval' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
              title="Oval view"
            >
              <Map className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
              title="List view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Round Selector */}
      <Card>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Select Round</label>
          <select
            value={selectedRoundId || ''}
            onChange={e => setSelectedRoundId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {rounds.map(round => (
              <option key={round.id} value={round.id}>
                Round {round.round_number} - {round.opposition || 'TBA'}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {!teamSheet ? (
        <div className="space-y-4">
          {viewMode === 'oval' && (
            <Card title="Team Positions" padding={false}>
              <div className="p-2">
                <AflOval players={[]} />
              </div>
              <div className="p-4 pt-0 text-center">
                <p className="text-gray-500 text-sm">Team not yet announced for this round</p>
              </div>
            </Card>
          )}
          {viewMode === 'list' && (
            <Card>
              <EmptyState
                icon={<Users className="w-12 h-12" />}
                title="Team not yet announced"
                description="The coach has not announced the team selection for this round."
              />
            </Card>
          )}
        </div>
      ) : (
        <>
          {/* Game Info */}
          <Card title="Match Info">
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Match</p>
                <p className="font-semibold">Round {teamSheet.round.round_number} vs {teamSheet.round.opposition || 'TBA'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date & Time</p>
                <p className="font-semibold">{teamSheet.round.date_time ? formatDateTime(teamSheet.round.date_time) : 'TBA'}</p>
              </div>
              {teamSheet.round.venue && (
                <div className="text-sm">
                  <p className="text-gray-600">Venue</p>
                  <p className="font-medium">{teamSheet.round.venue}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Oval View */}
          {viewMode === 'oval' && (
            <Card title="Team Positions" padding={false}>
              <div className="p-2">
                <AflOval
                  players={teamSheet.players.map(p => ({
                    name: p.memberName || 'Unknown',
                    jerseyNumber: p.jerseyNumber,
                    positionName: p.positionName,
                    primaryPosition: p.primaryPosition,
                    isCurrentUser: p.member_id === currentMember?.id,
                    selectionType: p.selection_type,
                  }))}
                />
              </div>
            </Card>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <>
              {/* Field Players */}
              <Card title="On Field">
                <div className="space-y-3">
                  {getFieldPlayers().length > 0 ? (
                    Object.entries(groupPlayersByPosition(getFieldPlayers())).map(([position, players]) => (
                      <div key={position}>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">{position}</h4>
                        <div className="space-y-1 ml-2">
                          {players.map(player => (
                            <div
                              key={player.id}
                              className={`p-2 rounded ${
                                player.member_id === currentMember?.id ? 'bg-blue-50 border border-blue-300' : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm">{player.memberName}</span>
                                {player.jerseyNumber && (
                                  <span className="text-xs bg-gray-300 text-gray-900 px-2 py-1 rounded font-bold">
                                    #{player.jerseyNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No field players selected</p>
                  )}
                </div>
              </Card>

              {/* Bench Players */}
              {getBenchPlayers().length > 0 && (
                <Card title="Bench">
                  <div className="space-y-2">
                    {getBenchPlayers().map(player => (
                      <div
                        key={player.id}
                        className={`p-2 rounded flex items-center justify-between ${
                          player.member_id === currentMember?.id ? 'bg-blue-50 border border-blue-300' : 'bg-gray-50'
                        }`}
                      >
                        <span className="text-sm">{player.memberName}</span>
                        {player.jerseyNumber && (
                          <span className="text-xs bg-gray-300 text-gray-900 px-2 py-1 rounded font-bold">
                            #{player.jerseyNumber}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Game Day Roles */}
          {teamSheet.roles.length > 0 && (
            <Card title="Game Day Roles">
              <div className="space-y-2">
                {teamSheet.roles.map(role => (
                  <div key={role.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                    <span className="text-sm font-medium">{role.name}</span>
                    <span className="text-xs text-gray-600">{role.assignedTo || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
