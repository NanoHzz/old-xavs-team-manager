import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { PlayerRating, PositionRating, Position } from '../../types'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface PlayerWithRatings {
  memberId: string
  memberName: string
  jerseyNumber: string | null
  overallRating: number | null
  fitnessRating: number | null
  formRating: number | null
  positionRatings: PositionRating[]
}

type SortField = 'name' | 'overall'
type FilterOption = 'all' | 'rated' | 'unrated'

export default function PlayerRatingsPage() {
  const { currentTeam, members, currentMember } = useTeam()
  const [playerRatings, setPlayerRatings] = useState<Map<string, PlayerRating>>(
    new Map()
  )
  const [positionRatings, setPositionRatings] = useState<PositionRating[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [ratings, setRatings] = useState<
    Record<string, { overall: number; fitness: number; form: number }>
  >({})

  // Fetch initial data
  useEffect(() => {
    if (!currentTeam) return
    fetchData()
  }, [currentTeam])

  const fetchData = async () => {
    if (!currentTeam) return
    setLoading(true)
    setError(null)

    try {
      // Fetch player ratings
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('player_ratings')
        .select('*')
        .in(
          'member_id',
          members.map(m => m.id)
        )

      if (ratingsError) throw ratingsError

      const ratingsMap = new Map<string, PlayerRating>()
      const initialRatings: Record<
        string,
        { overall: number; fitness: number; form: number }
      > = {}

      ;(ratingsData || []).forEach(r => {
        ratingsMap.set(r.member_id, r)
        // Use individual rating fields from the schema
        initialRatings[r.member_id] = {
          overall: r.overall || 5,
          fitness: r.fitness || 5,
          form: r.form || 5,
        }
      })

      // Initialize ratings for members without ratings
      members.forEach(m => {
        if (!initialRatings[m.id]) {
          initialRatings[m.id] = { overall: 5, fitness: 5, form: 5 }
        }
      })

      setPlayerRatings(ratingsMap)
      setRatings(initialRatings)

      // Fetch position ratings
      // Note: position_ratings uses player_rating_id, not member_id
      const { data: posRatingsData, error: posRatingsError } = await supabase
        .from('position_ratings')
        .select('*')
        .in(
          'player_rating_id',
          (ratingsData || []).map(r => r.id)
        )

      if (posRatingsError) throw posRatingsError
      setPositionRatings(posRatingsData || [])

      // Fetch positions
      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('team_id', currentTeam.id)

      if (positionsError) throw positionsError
      setPositions(positionsData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load player data')
    } finally {
      setLoading(false)
    }
  }

  const playerList = useMemo(() => {
    const list: PlayerWithRatings[] = members.map(m => {
      const rating = playerRatings.get(m.id)
      const posRatings = positionRatings.filter(pr => pr.player_rating_id === rating?.id)
      const memberRatings = ratings[m.id] || { overall: 5, fitness: 5, form: 5 }

      return {
        memberId: m.id,
        memberName: m.display_name || m.guest_name || 'Unknown',
        jerseyNumber: m.jersey_number,
        overallRating: memberRatings.overall,
        fitnessRating: memberRatings.fitness,
        formRating: memberRatings.form,
        positionRatings: posRatings,
      }
    })

    // Apply filter
    let filtered = list
    if (filterBy === 'rated') {
      filtered = list.filter(p => playerRatings.has(p.memberId))
    } else if (filterBy === 'unrated') {
      filtered = list.filter(p => !playerRatings.has(p.memberId))
    }

    // Apply sort
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.memberName.localeCompare(b.memberName)
      } else {
        return (b.overallRating || 0) - (a.overallRating || 0)
      }
    })

    return filtered
  }, [members, playerRatings, positionRatings, ratings, sortBy, filterBy])

  const handleRatingChange = (
    memberId: string,
    field: 'overall' | 'fitness' | 'form',
    value: number
  ) => {
    setRatings(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value,
      },
    }))
  }

  const handleSaveAll = async () => {
    if (!currentTeam) return

    setSaving(true)
    try {
      if (!currentMember) throw new Error('No current member')

      const updates = members.map(m => {
        const rating = ratings[m.id] || { overall: 5, fitness: 5, form: 5 }
        const existing = playerRatings.get(m.id)

        if (existing) {
          return {
            id: existing.id,
            member_id: m.id,
            overall: rating.overall,
            fitness: rating.fitness,
            form: rating.form,
            rated_by: currentMember.id,
          }
        } else {
          return {
            member_id: m.id,
            overall: rating.overall,
            fitness: rating.fitness,
            form: rating.form,
            rated_by: currentMember.id,
          }
        }
      })

      const inserts = updates.filter(u => !('id' in u))
      const updateIds = updates.filter(u => 'id' in u)

      // Insert new ratings
      if (inserts.length > 0) {
        const { error } = await supabase.from('player_ratings').insert(inserts)
        if (error) throw error
      }

      // Update existing ratings
      for (const update of updateIds) {
        const { error } = await supabase
          .from('player_ratings')
          .update({
            overall: update.overall,
            fitness: update.fitness,
            form: update.form,
            rated_by: update.rated_by,
          })
          .eq('id', (update as any).id)
        if (error) throw error
      }

      await fetchData()
      alert('All ratings saved successfully!')
    } catch (err) {
      console.error('Error saving ratings:', err)
      setError('Failed to save ratings')
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

  const ratedCount = members.filter(m => playerRatings.has(m.id)).length
  const unratedCount = members.length - ratedCount

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Player Ratings</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Header with stats */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Badge variant="success">{ratedCount} rated</Badge>
          <Badge variant="warning">{unratedCount} unrated</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Sort selector */}
          <div className="relative inline-block">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortField)}
              className="px-3 py-2 border border-gray-300 rounded-lg appearance-none bg-white cursor-pointer text-sm"
            >
              <option value="name">Sort by Name</option>
              <option value="overall">Sort by Rating</option>
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Filter selector */}
          <div className="relative inline-block">
            <select
              value={filterBy}
              onChange={e => setFilterBy(e.target.value as FilterOption)}
              className="px-3 py-2 border border-gray-300 rounded-lg appearance-none bg-white cursor-pointer text-sm"
            >
              <option value="all">All Players</option>
              <option value="rated">Rated Only</option>
              <option value="unrated">Unrated Only</option>
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-3 mb-6">
        {playerList.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-gray-500">
              No players found
            </div>
          </Card>
        ) : (
          playerList.map(player => (
            <Card key={player.memberId} className="overflow-hidden">
              <div
                onClick={() =>
                  setExpandedPlayer(
                    expandedPlayer === player.memberId ? null : player.memberId
                  )
                }
                className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {player.memberName}
                    {player.jerseyNumber && (
                      <span className="text-sm text-gray-500 ml-2">
                        #{player.jerseyNumber}
                      </span>
                    )}
                  </h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Overall</p>
                      <p className="font-bold text-lg">
                        {player.overallRating}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Fitness</p>
                      <p className="font-bold text-lg">
                        {player.fitnessRating}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Form</p>
                      <p className="font-bold text-lg">{player.formRating}</p>
                    </div>
                  </div>

                  {expandedPlayer === player.memberId ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded view with sliders */}
              {expandedPlayer === player.memberId && (
                <div className="border-t border-gray-200 p-4 space-y-6 bg-gray-50">
                  {/* Overall Rating */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Overall Rating
                      </label>
                      <span className="text-sm font-bold text-blue-600">
                        {player.overallRating}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={player.overallRating || 5}
                      onChange={e =>
                        handleRatingChange(
                          player.memberId,
                          'overall',
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  {/* Fitness Rating */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Fitness Rating
                      </label>
                      <span className="text-sm font-bold text-green-600">
                        {player.fitnessRating}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={player.fitnessRating || 5}
                      onChange={e =>
                        handleRatingChange(
                          player.memberId,
                          'fitness',
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Unfit</span>
                      <span>Peak</span>
                    </div>
                  </div>

                  {/* Form Rating */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Form Rating
                      </label>
                      <span className="text-sm font-bold text-purple-600">
                        {player.formRating}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={player.formRating || 5}
                      onChange={e =>
                        handleRatingChange(
                          player.memberId,
                          'form',
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  {/* Position-specific ratings */}
                  {player.positionRatings.length > 0 && (
                    <div className="pt-4 border-t border-gray-300">
                      <h4 className="text-sm font-semibold mb-3">
                        Position Ratings
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {player.positionRatings.map(pr => {
                          const pos = positions.find(p => p.id === pr.position_id)
                          return (
                            <div key={pr.id} className="text-sm">
                              <p className="text-gray-600">{pos?.name}</p>
                              <p className="font-bold text-blue-600">
                                {pr.rating}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Save button */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="primary"
          onClick={handleSaveAll}
          disabled={saving}
          loading={saving}
        >
          Save All Ratings
        </Button>
      </div>
    </div>
  )
}
