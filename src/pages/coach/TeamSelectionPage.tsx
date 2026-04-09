import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type {
  Round,
  PlayerAvailability,
  TeamSelection,
  SelectionPlayer,
  Position,
  PositionPreference,
  PlayerRating,
} from '../../types'
import { format } from 'date-fns'
import { ChevronDown, Lock, Trash2, Users } from 'lucide-react'

export default function TeamSelectionPage() {
  const { currentTeam, members, currentMember } = useTeam()
  const [rounds, setRounds] = useState<Round[]>([])
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [playerAvailability, setPlayerAvailability] = useState<
    Record<string, PlayerAvailability>
  >({})
  const [teamSelection, setTeamSelection] = useState<TeamSelection | null>(null)
  const [selectionPlayers, setSelectionPlayers] = useState<SelectionPlayer[]>([])
  const [positionPreferences, setPositionPreferences] = useState<
    PositionPreference[]
  >([])
  const [playerRatings, setPlayerRatings] = useState<Record<string, PlayerRating>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPlayerPicker, setShowPlayerPicker] = useState<string | null>(null)
  const [lockedPositions, setLockedPositions] = useState<Set<string>>(new Set())

  // Fetch initial data — re-run when members loads from context
  useEffect(() => {
    if (!currentTeam || members.length === 0) return
    fetchData()
  }, [currentTeam, members])

  const fetchData = async () => {
    if (!currentTeam) return
    setLoading(true)
    setError(null)

    try {
      // Fetch active seasons for team
      const { data: seasonsData } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', currentTeam.id)
        .eq('is_active', true)

      const seasonIds = seasonsData?.map(s => s.id) || []

      // Fetch rounds
      const { data: roundsData, error: roundsError } = seasonIds.length > 0
        ? await supabase
            .from('rounds')
            .select('*')
            .in('season_id', seasonIds)
            .order('date_time', { ascending: true })
        : { data: [] as any[], error: null }

      if (roundsError) throw roundsError
      setRounds(roundsData || [])

      // Set first upcoming round as default
      const now = new Date()
      const upcomingRound = roundsData?.find(r => r.date_time && new Date(r.date_time) > now)
      if (upcomingRound) {
        setSelectedRound(upcomingRound)
      } else if (roundsData && roundsData.length > 0) {
        setSelectedRound(roundsData[roundsData.length - 1])
      }

      // Fetch positions
      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('sort_order', { ascending: true })

      if (positionsError) throw positionsError
      setPositions(positionsData || [])

      // Fetch position preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from('position_preferences')
        .select('*')
        .in(
          'member_id',
          members.map(m => m.id)
        )

      if (prefsError) throw prefsError
      setPositionPreferences(prefsData || [])

      // Fetch player ratings
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('player_ratings')
        .select('*')
        .in(
          'member_id',
          members.map(m => m.id)
        )

      if (ratingsError) throw ratingsError
      const ratingsMap = (ratingsData || []).reduce(
        (acc, r) => {
          acc[r.member_id] = r
          return acc
        },
        {} as Record<string, PlayerRating>
      )
      setPlayerRatings(ratingsMap)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  // Fetch availability and team selection when round changes
  useEffect(() => {
    if (!selectedRound || !currentTeam) return
    fetchRoundData()
  }, [selectedRound, currentTeam])

  const fetchRoundData = async () => {
    if (!selectedRound || !currentTeam) return

    try {
      // Fetch player availability
      const { data: availData, error: availError } = await supabase
        .from('player_availability')
        .select('*')
        .eq('round_id', selectedRound.id)

      if (availError) throw availError
      const availMap = (availData || []).reduce(
        (acc, a) => {
          acc[a.member_id] = a
          return acc
        },
        {} as Record<string, PlayerAvailability>
      )
      setPlayerAvailability(availMap)

      // Fetch team selection for this round
      const { data: selectionData, error: selectionError } = await supabase
        .from('team_selections')
        .select('*')
        .eq('round_id', selectedRound.id)
        .single()

      if (selectionError && selectionError.code !== 'PGRST116') throw selectionError
      setTeamSelection(selectionData || null)

      // Fetch selection players if selection exists
      if (selectionData) {
        const { data: playersData, error: playersError } = await supabase
          .from('selection_players')
          .select('*')
          .eq('team_selection_id', selectionData.id)

        if (playersError) throw playersError
        setSelectionPlayers(playersData || [])
      } else {
        setSelectionPlayers([])
      }
    } catch (err) {
      console.error('Error fetching round data:', err)
      setError('Failed to load round data')
    }
  }

  const availableStatus = useMemo(() => {
    const available = members.filter(
      m => playerAvailability[m.id]?.status === 'available'
    ).length
    const unavailable = members.filter(
      m => playerAvailability[m.id]?.status === 'unavailable'
    ).length
    const pending = members.filter(m => !playerAvailability[m.id]).length

    return { available, unavailable, pending }
  }, [members, playerAvailability])

  const assignedMemberIds = useMemo(() => {
    return new Set(selectionPlayers.map(sp => sp.member_id))
  }, [selectionPlayers])

  const availablePlayers = useMemo(() => {
    // Show all active players not yet assigned, sorted by availability status
    return members
      .filter(m => m.status === 'active' && !assignedMemberIds.has(m.id))
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { available: 0, maybe: 1, unavailable: 2 }
        const aStatus = playerAvailability[a.id]?.status
        const bStatus = playerAvailability[b.id]?.status
        const aOrder = aStatus ? (statusOrder[aStatus] ?? 1) : 1
        const bOrder = bStatus ? (statusOrder[bStatus] ?? 1) : 1
        return aOrder - bOrder
      })
  }, [members, playerAvailability, assignedMemberIds])

  const assignedPlayersByPosition = useMemo(() => {
    const map: Record<string, SelectionPlayer> = {}
    selectionPlayers.forEach(sp => {
      if (sp.position_id !== null) {
        map[sp.position_id] = sp
      }
    })
    return map
  }, [selectionPlayers])

  const handleAssignPlayer = async (positionId: string, memberId: string) => {
    if (!selectedRound || !currentTeam || !currentMember) return

    setSaving(true)
    try {
      // Create or update team selection
      let selection = teamSelection
      if (!selection) {
        const { data, error } = await supabase
          .from('team_selections')
          .insert({
            round_id: selectedRound.id,
            created_by: currentMember.id,
          })
          .select()
          .single()

        if (error) throw error
        selection = data
        setTeamSelection(selection)
      }

      // Add selection player
      const { error } = await supabase
        .from('selection_players')
        .insert({
          team_selection_id: selection.id,
          member_id: memberId,
          position_id: positionId,
          selection_type: 'on_field',
        })

      if (error) throw error

      await fetchRoundData()
      setShowPlayerPicker(null)
    } catch (err) {
      console.error('Error assigning player:', err)
      setError('Failed to assign player')
    } finally {
      setSaving(false)
    }
  }

  const handleRemovePlayer = async (selectionPlayerId: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('selection_players')
        .delete()
        .eq('id', selectionPlayerId)

      if (error) throw error
      await fetchRoundData()
    } catch (err) {
      console.error('Error removing player:', err)
      setError('Failed to remove player')
    } finally {
      setSaving(false)
    }
  }

  const handleAutoFill = async () => {
    if (!selectedRound || !currentTeam || !currentMember) return

    setSaving(true)
    try {
      // Create selection if needed
      let selection = teamSelection
      if (!selection) {
        const { data, error } = await supabase
          .from('team_selections')
          .insert({
            round_id: selectedRound.id,
            created_by: currentMember.id,
          })
          .select()
          .single()

        if (error) throw error
        selection = data
        setTeamSelection(selection)
      }

      // Get unassigned positions
      const assignedPosIds = new Set(selectionPlayers.map(sp => sp.position_id))
      const unassignedPositions = positions.filter(p => !assignedPosIds.has(p.id))

      // Get unassigned active players, prioritizing available ones
      const unassignedPlayers = members
        .filter(m => m.status === 'active' && !assignedMemberIds.has(m.id))
        .sort((a, b) => {
          const statusOrder: Record<string, number> = { available: 0, maybe: 1, unavailable: 2 }
          const aStatus = playerAvailability[a.id]?.status
          const bStatus = playerAvailability[b.id]?.status
          const aOrder = aStatus ? (statusOrder[aStatus] ?? 1) : 1
          const bOrder = bStatus ? (statusOrder[bStatus] ?? 1) : 1
          return aOrder - bOrder
        })

      // For each unassigned position, find best matching player
      const newAssignments: Array<{
        team_selection_id: string
        member_id: string
        position_id: string
        selection_type: 'on_field' | 'bench' | 'emergency' | 'omitted'
      }> = []
      for (const position of unassignedPositions) {
        // Get players who prefer this position, sorted by rating
        const matchingPlayers = unassignedPlayers
          .filter(p => {
            const prefs = positionPreferences.filter(pr => pr.member_id === p.id)
            return prefs.some(pr => pr.position_id === position.id)
          })
          .sort(
            (a, b) =>
              (playerRatings[b.id]?.overall || 0) - (playerRatings[a.id]?.overall || 0)
          )

        // If no preference match, try highest rated available player
        let playerToAssign = matchingPlayers[0]
        if (!playerToAssign && unassignedPlayers.length > 0) {
          playerToAssign = unassignedPlayers.sort(
            (a, b) =>
              (playerRatings[b.id]?.overall || 0) - (playerRatings[a.id]?.overall || 0)
          )[0]
        }

        if (playerToAssign) {
          newAssignments.push({
            team_selection_id: selection.id,
            member_id: playerToAssign.id,
            position_id: position.id,
            selection_type: 'on_field' as const,
          })

          // Remove from unassigned list
          unassignedPlayers.splice(unassignedPlayers.indexOf(playerToAssign), 1)
        }
      }

      // Insert all new assignments
      if (newAssignments.length > 0) {
        const { error } = await supabase
          .from('selection_players')
          .insert(newAssignments)

        if (error) throw error
      }

      await fetchRoundData()
    } catch (err) {
      console.error('Error auto-filling:', err)
      setError('Failed to auto-fill team')
    } finally {
      setSaving(false)
    }
  }

  const handleClearAll = async () => {
    if (!teamSelection) return
    if (!confirm('Clear all player assignments?')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('selection_players')
        .delete()
        .eq('team_selection_id', teamSelection.id)

      if (error) throw error
      await fetchRoundData()
    } catch (err) {
      console.error('Error clearing assignments:', err)
      setError('Failed to clear assignments')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    // Draft is saved automatically as assignments are made
    alert('Team selection saved as draft')
  }

  const handleFinalize = async () => {
    if (!selectedRound || !currentTeam) return

    const unassignedPositions = positions.filter(
      p => !selectionPlayers.some(sp => sp.position_id === p.id)
    )

    if (unassignedPositions.length > 0) {
      alert(
        `Cannot finalize: ${unassignedPositions.length} positions still unassigned`
      )
      return
    }

    if (!confirm('Finalize and send team selection to players?')) return

    setSaving(true)
    try {
      // Create notifications for all players in selection
      const players = selectionPlayers
        .map(sp => members.find(m => m.id === sp.member_id))
        .filter(Boolean)

      const notifications = players.map(p => ({
        user_id: p!.user_id,
        type: 'team_selection',
        title: 'Team Selection',
        body: `You have been selected for ${selectedRound.opposition || 'the upcoming match'}`,
        read: false,
      }))

      const { error } = await supabase
        .from('notifications')
        .insert(notifications)

      if (error) throw error

      alert('Team selection finalized and notifications sent!')
    } catch (err) {
      console.error('Error finalizing:', err)
      setError('Failed to finalize selection')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!selectedRound) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Team Selection</h1>
        <Card>
          <div className="text-center py-8 text-gray-500">
            <p>No rounds available</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Team Selection</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Round Selector */}
      <div className="mb-6">
        <div className="relative inline-block w-full max-w-xs">
          <select
            value={selectedRound.id}
            onChange={e => {
              const round = rounds.find(r => r.id === e.target.value)
              if (round) setSelectedRound(round)
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg appearance-none bg-white cursor-pointer"
          >
            {rounds.map(r => (
              <option key={r.id} value={r.id}>
                Round {r.round_number}: {r.opposition || 'TBD'} -{' '}
                {r.date_time ? format(new Date(r.date_time), 'MMM d') : 'TBA'}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Availability Summary */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {availableStatus.available}
            </div>
            <p className="text-sm text-gray-600">Available</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">
              {availableStatus.unavailable}
            </div>
            <p className="text-sm text-gray-600">Unavailable</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {availableStatus.pending}
            </div>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Available Players */}
        <Card title="Available Players" className="lg:col-span-1">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No available players
              </p>
            ) : (
              availablePlayers.map(p => {
                const avail = playerAvailability[p.id]?.status
                const statusVariant = avail === 'available' ? 'success' : avail === 'unavailable' ? 'danger' : 'warning'
                const statusLabel = avail === 'available' ? 'Available' : avail === 'unavailable' ? 'Unavailable' : 'Pending'
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-sm">
                        {p.display_name || p.guest_name || 'Unknown'}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant={statusVariant} className="text-xs">{statusLabel}</Badge>
                        {positionPreferences
                          .filter(pr => pr.member_id === p.id)
                          .sort((a, b) => (a.preference_rank ?? 999) - (b.preference_rank ?? 999))
                          .slice(0, 2)
                          .map(pr => {
                            const pos = positions.find(pos => pos.id === pr.position_id)
                            return (
                              <Badge key={pr.id} variant="info" className="text-xs">
                                {pos?.abbreviation}
                              </Badge>
                            )
                          })}
                      </div>
                    </div>
                    <Badge variant="success">
                      {playerRatings[p.id]?.overall || '-'}
                    </Badge>
                  </div>
                )
              })

            )}
          </div>
        </Card>

        {/* Position Assignment Grid */}
        <Card title="Positions" className="lg:col-span-2">
          <div className="space-y-3">
            {positions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No positions defined
              </p>
            ) : (
              positions.map(pos => {
                const assigned = assignedPlayersByPosition[pos.id]
                const assignedMember = assigned
                  ? members.find(m => m.id === assigned.member_id)
                  : null

                return (
                  <div key={pos.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{pos.name}</p>
                      <p className="text-xs text-gray-500">{pos.abbreviation}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignedMember ? (
                        <div className="text-right">
                          <p className="font-medium text-sm">
                            {assignedMember.display_name || assignedMember.guest_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            #{assignedMember.jersey_number}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowPlayerPicker(pos.id)}
                          className="text-blue-600 text-sm font-medium hover:underline"
                        >
                          Assign
                        </button>
                      )}
                      {assigned && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePlayer(assigned.id)}
                          disabled={saving || lockedPositions.has(pos.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <button
                        onClick={() => {
                          const newLocked = new Set(lockedPositions)
                          if (newLocked.has(pos.id)) {
                            newLocked.delete(pos.id)
                          } else {
                            newLocked.add(pos.id)
                          }
                          setLockedPositions(newLocked)
                        }}
                        className={`p-1 rounded ${
                          lockedPositions.has(pos.id)
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-gray-400'
                        }`}
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Player Picker Modal */}
                    {showPlayerPicker === pos.id && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <Card className="w-96">
                          <div className="p-4">
                            <h3 className="font-bold mb-4">Select Player</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {availablePlayers.map(p => {
                                const avail = playerAvailability[p.id]?.status
                                const statusColor = avail === 'available' ? 'text-green-600' : avail === 'unavailable' ? 'text-red-600' : 'text-yellow-600'
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() =>
                                      handleAssignPlayer(pos.id, p.id)
                                    }
                                    disabled={saving}
                                    className="w-full text-left p-2 hover:bg-gray-100 rounded"
                                  >
                                    <div className="font-medium text-sm">
                                      {p.display_name || p.guest_name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-gray-500 flex gap-2">
                                      <span className={statusColor}>{avail || 'pending'}</span>
                                      <span>Rating: {playerRatings[p.id]?.overall || '-'}</span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                            <Button
                              variant="ghost"
                              fullWidth
                              className="mt-4"
                              onClick={() => setShowPlayerPicker(null)}
                            >
                              Close
                            </Button>
                          </div>
                        </Card>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="secondary"
          onClick={handleClearAll}
          disabled={saving || selectionPlayers.length === 0}
        >
          Clear All
        </Button>
        <Button
          variant="secondary"
          onClick={handleAutoFill}
          disabled={saving}
          loading={saving}
        >
          <Users className="w-4 h-4" />
          Auto-fill
        </Button>
        <Button
          variant="secondary"
          onClick={handleSaveDraft}
          disabled={saving || selectionPlayers.length === 0}
        >
          Save Draft
        </Button>
        <Button
          variant="primary"
          onClick={handleFinalize}
          disabled={saving || selectionPlayers.length === 0}
          loading={saving}
        >
          Finalize & Send
        </Button>
      </div>
    </div>
  )
}
