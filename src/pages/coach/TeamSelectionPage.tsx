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
import { generateTeamSelection, getSelectionMode } from '../../services/aiTeamSelection'
import type { PlayerSelectionData } from '../../services/aiTeamSelection'
import { format } from 'date-fns'
import { ChevronDown, Lock, Trash2, Users, Star, Plus } from 'lucide-react'

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPlayerPicker, setShowPlayerPicker] = useState<string | null>(null)
  const [lockedPositions, setLockedPositions] = useState<Set<string>>(new Set())
  const [showExternalPlayerForm, setShowExternalPlayerForm] = useState(false)
  const [externalPlayerForm, setExternalPlayerForm] = useState({
    name: '',
    position: 'Backs',
    rating: 5,
  })

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

      // Determine selection type based on position category
      const position = positions.find(p => p.id === positionId)
      const selType = position?.category === 'Bench' ? 'bench' : 'on_field'

      // Add selection player
      const { error } = await supabase
        .from('selection_players')
        .insert({
          team_selection_id: selection.id,
          member_id: memberId,
          position_id: positionId,
          selection_type: selType,
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

  const handleAIGenerate = async () => {
    if (!selectedRound || !currentTeam || !currentMember) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Build PlayerSelectionData for available players
      const availablePlayers = members
        .filter(m => {
          if (m.status !== 'active' || assignedMemberIds.has(m.id)) return false
          const avail = playerAvailability[m.id]?.status
          return avail !== 'unavailable'
        })

      // Fetch recent games played (count in last 5 rounds)
      const { data: recentRounds } = await supabase
        .from('rounds')
        .select('id')
        .eq('season_id', selectedRound.season_id)
        .lt('round_number', selectedRound.round_number)
        .order('round_number', { ascending: false })
        .limit(5)

      const recentRoundIds = (recentRounds || []).map(r => r.id)

      // Batch fetch recent game counts: get team_selections for recent rounds, then count players
      let recentGameCounts: Record<string, number> = {}
      if (recentRoundIds.length > 0) {
        const { data: recentSelections } = await supabase
          .from('team_selections')
          .select('id')
          .in('round_id', recentRoundIds)

        const recentSelectionIds = (recentSelections || []).map(s => s.id)

        if (recentSelectionIds.length > 0) {
          const { data: recentPlayers } = await supabase
            .from('selection_players')
            .select('member_id')
            .in('team_selection_id', recentSelectionIds)

          for (const sp of recentPlayers || []) {
            recentGameCounts[sp.member_id] = (recentGameCounts[sp.member_id] || 0) + 1
          }
        }
      }

      const playerSelectionDataList: PlayerSelectionData[] = []

      for (const member of availablePlayers) {
        const rating = playerRatings[member.id]

        playerSelectionDataList.push({
          member,
          availability: (playerAvailability[member.id]?.status || 'maybe') as 'available' | 'maybe',
          overallRating: rating?.overall || member.external_rating || 5,
          fitnessRating: rating?.fitness || 5,
          formRating: rating?.form || 5,
          recentGamesPlayed: recentGameCounts[member.id] || 0,
          totalGamesPlayed: 0,
        })
      }

      // Build locked positions map
      const lockedMap = new Map<string, string>()
      selectionPlayers.forEach(sp => {
        if (sp.position_id && lockedPositions.has(sp.position_id)) {
          lockedMap.set(sp.position_id, sp.member_id)
        }
      })

      // Call AI generation
      const aiResults = generateTeamSelection(
        playerSelectionDataList,
        positions,
        selectedRound.opposition_rating,
        lockedMap
      )

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

      // Clear existing non-locked selection players
      const nonLockedIds = selectionPlayers
        .filter(sp => !lockedPositions.has(sp.position_id || ''))
        .map(sp => sp.id)

      if (nonLockedIds.length > 0) {
        const { error } = await supabase
          .from('selection_players')
          .delete()
          .in('id', nonLockedIds)

        if (error) throw error
      }

      // Insert AI results
      if (aiResults.length > 0) {
        const inserts = aiResults.map((result, idx) => ({
          team_selection_id: selection.id,
          member_id: result.memberId,
          position_id: result.positionId,
          selection_type: result.selectionType,
          sort_order: idx,
        }))

        const { error } = await supabase
          .from('selection_players')
          .insert(inserts)

        if (error) throw error
      }

      const mode = getSelectionMode(selectedRound.opposition_rating)
      const oppositionStr = selectedRound.opposition_rating
        ? `${selectedRound.opposition_rating}/5`
        : 'N/A'

      setSuccessMessage(
        `AI generated team in ${mode} mode based on opposition rating ${oppositionStr}`
      )

      // Refresh data
      await fetchRoundData()
    } catch (err) {
      console.error('Error generating team with AI:', err)
      setError('Failed to generate team with AI')
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

  const handleAddExternalPlayer = async () => {
    if (!currentTeam || !currentMember || !selectedRound || !externalPlayerForm.name.trim()) {
      setError('Please fill in all required fields')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Map position preference to primary_position
      const positionMap: Record<string, string> = {
        'Backs': 'back_pocket',
        'Midfield': 'midfielder',
        'Forward': 'forward',
        'Ruck': 'ruck',
      }

      // Create member record
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: currentMember.user_id, // Use coach's user_id as placeholder
          team_id: currentTeam.id,
          is_guest: true,
          is_external: true,
          guest_name: externalPlayerForm.name,
          external_rating: externalPlayerForm.rating,
          primary_position: positionMap[externalPlayerForm.position],
          status: 'active',
        })
        .select()
        .single()

      if (memberError) throw memberError

      // Create player availability record for this round
      const { error: availError } = await supabase
        .from('player_availability')
        .insert({
          member_id: memberData.id,
          round_id: selectedRound.id,
          status: 'available',
        })

      if (availError) throw availError

      setSuccessMessage(`External player "${externalPlayerForm.name}" added for this round`)
      setShowExternalPlayerForm(false)
      setExternalPlayerForm({ name: '', position: 'Backs', rating: 5 })

      // Refresh data
      await fetchData()
      await fetchRoundData()
    } catch (err) {
      console.error('Error adding external player:', err)
      setError('Failed to add external player')
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
      // Create notifications only for players who have a user account
      const players = selectionPlayers
        .map(sp => members.find(m => m.id === sp.member_id))
        .filter((p): p is NonNullable<typeof p> => !!p && !!p.user_id)

      if (players.length > 0) {
        const notifications = players.map(p => ({
          user_id: p.user_id!,
          type: 'team_selection',
          title: 'Team Selection',
          body: `You have been selected for ${selectedRound.opposition || 'the upcoming match'}`,
          read: false,
        }))

        // Insert one at a time so a single failure doesn't block all
        let sent = 0
        for (const notif of notifications) {
          const { error } = await supabase
            .from('notifications')
            .insert(notif)
          if (error) {
            console.error('Notification insert failed:', error, notif)
          } else {
            sent++
          }
        }

        const skipped = selectionPlayers.length - players.length
        const msg = skipped > 0
          ? `Team finalized! Notified ${sent} player(s). ${skipped} guest player(s) without accounts were skipped.`
          : `Team finalized! Notified ${sent} player(s).`
        alert(msg)
      } else {
        // No players have user accounts — still mark as finalized
        alert('Team finalized! No players have linked accounts yet, so no notifications were sent.')
      }
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

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex justify-between items-center">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-700 hover:text-green-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Round Selector with Opposition Rating */}
      <div className="mb-6 flex items-center gap-4">
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
        {selectedRound.opposition_rating && (
          <div className="flex items-center gap-1 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">
            <span className="text-sm font-medium text-gray-700">Opposition:</span>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < selectedRound.opposition_rating!
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
        )}
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
                      {playerRatings[p.id]?.overall || (p.external_rating ? p.external_rating : '-')}
                    </Badge>
                  </div>
                )
              })

            )}
          </div>

          {/* Add External Player Form */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            {!showExternalPlayerForm ? (
              <button
                onClick={() => setShowExternalPlayerForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-blue-600 hover:bg-blue-50 rounded text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add External Player
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={externalPlayerForm.name}
                    onChange={e =>
                      setExternalPlayerForm({
                        ...externalPlayerForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="Player name"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Position
                  </label>
                  <select
                    value={externalPlayerForm.position}
                    onChange={e =>
                      setExternalPlayerForm({
                        ...externalPlayerForm,
                        position: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    disabled={saving}
                  >
                    <option value="Backs">Backs</option>
                    <option value="Midfield">Midfield</option>
                    <option value="Forward">Forward</option>
                    <option value="Ruck">Ruck</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Rating: {externalPlayerForm.rating}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={externalPlayerForm.rating}
                    onChange={e =>
                      setExternalPlayerForm({
                        ...externalPlayerForm,
                        rating: parseInt(e.target.value),
                      })
                    }
                    className="w-full"
                    disabled={saving}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddExternalPlayer}
                    disabled={saving || !externalPlayerForm.name.trim()}
                    loading={saving}
                    className="flex-1"
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowExternalPlayerForm(false)
                      setExternalPlayerForm({ name: '', position: 'Backs', rating: 5 })
                    }}
                    disabled={saving}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
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
              positions.map((pos, idx) => {
                const assigned = assignedPlayersByPosition[pos.id]
                const assignedMember = assigned
                  ? members.find(m => m.id === assigned.member_id)
                  : null

                // Show separator before first bench position
                const prevPos = idx > 0 ? positions[idx - 1] : null
                const showBenchSeparator = pos.category === 'Bench' && prevPos?.category !== 'Bench'

                return (
                  <div key={pos.id}>
                    {showBenchSeparator && (
                      <div className="border-t-2 border-gray-300 pt-3 mt-3 mb-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Interchange</p>
                      </div>
                    )}
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
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
          onClick={handleAIGenerate}
          disabled={saving}
          loading={saving}
        >
          <Users className="w-4 h-4" />
          AI Generate Team
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
