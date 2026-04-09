import { useEffect, useState } from 'react'
import { formatDate } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Calendar } from 'lucide-react'
import type { Round, PlayerAvailability } from '../../types'

interface RoundWithAvailability extends Round {
  availability?: PlayerAvailability
  isPast: boolean
}

export default function AvailabilityPage() {
  const { currentTeam, currentMember } = useTeam()

  const [rounds, setRounds] = useState<RoundWithAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingRound, setUpdatingRound] = useState<string | null>(null)

  useEffect(() => {
    if (!currentTeam || !currentMember) {
      setLoading(false)
      return
    }

    const fetchAvailability = async () => {
      setLoading(true)
      try {
        // Fetch active seasons for the team
        const { data: seasonsData } = await supabase
          .from('seasons')
          .select('id')
          .eq('team_id', currentTeam.id)
          .eq('is_active', true)

        const seasonIds = seasonsData?.map(s => s.id) || []
        if (seasonIds.length === 0) {
          setRounds([])
          setLoading(false)
          return
        }

        // Fetch all rounds for the active season(s)
        const { data: roundsData, error: roundsError } = await supabase
          .from('rounds')
          .select('*')
          .in('season_id', seasonIds)
          .order('round_number', { ascending: true })

        if (roundsError) throw roundsError

        // Fetch availability for all rounds
        const { data: availData } = await supabase
          .from('player_availability')
          .select('*')
          .eq('member_id', currentMember.id)

        const now = new Date()

        // Combine rounds with availability
        const roundsWithAvail = (roundsData || []).map(round => {
          const avail = availData?.find(a => a.round_id === round.id)
          const isPast = round.date_time ? new Date(round.date_time) < now : false

          return {
            ...round,
            availability: avail,
            isPast,
          }
        })

        setRounds(roundsWithAvail)
      } finally {
        setLoading(false)
      }
    }

    fetchAvailability()
  }, [currentTeam, currentMember])

  const handleAvailabilityChange = async (roundId: string, status: 'available' | 'unavailable' | 'maybe') => {
    if (!currentMember) return

    setUpdatingRound(roundId)
    try {
      const { error } = await supabase.from('player_availability').upsert(
        {
          member_id: currentMember.id,
          round_id: roundId,
          status: status,
        },
        { onConflict: 'member_id,round_id' }
      )

      if (error) throw error

      // Update local state
      setRounds(rounds =>
        rounds.map(r => {
          if (r.id === roundId) {
            return {
              ...r,
              availability: {
                ...(r.availability || { id: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), notes: null }),
                member_id: currentMember.id,
                round_id: roundId,
                status: status,
              } as PlayerAvailability,
            }
          }
          return r
        })
      )
    } finally {
      setUpdatingRound(null)
    }
  }

  const handleSetAllAvailable = async () => {
    if (!currentMember) return

    try {
      const futureRounds = rounds.filter(r => !r.isPast)

      const upserts = futureRounds.map(round => ({
        member_id: currentMember.id,
        round_id: round.id,
        status: 'available' as const,
      }))

      const { error } = await supabase.from('player_availability').upsert(upserts, { onConflict: 'member_id,round_id' })

      if (error) throw error

      // Update local state
      setRounds(rounds =>
        rounds.map(r => {
          if (!r.isPast) {
            return {
              ...r,
              availability: {
                ...(r.availability || { id: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), notes: null }),
                member_id: currentMember.id,
                round_id: r.id,
                status: 'available',
              } as PlayerAvailability,
            }
          }
          return r
        })
      )
    } catch (error) {
      console.error('Error setting all available:', error)
    }
  }

  const getAvailabilityBadge = (status?: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="success">Available</Badge>
      case 'unavailable':
        return <Badge variant="danger">Unavailable</Badge>
      case 'maybe':
        return <Badge variant="warning">Maybe</Badge>
      default:
        return <Badge variant="default">Not Set</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Availability</h1>
        <LoadingSpinner />
      </div>
    )
  }

  if (rounds.length === 0) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Availability</h1>
        <Card>
          <EmptyState
            icon={<Calendar className="w-12 h-12" />}
            title="No rounds scheduled"
            description="There are no rounds scheduled for your team yet."
          />
        </Card>
      </div>
    )
  }

  const futureRounds = rounds.filter(r => !r.isPast)

  return (
    <div className="p-4 pb-20 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Availability</h1>
          <p className="text-gray-500 text-sm mt-1">Mark yourself available for upcoming rounds</p>
        </div>
      </div>

      {futureRounds.length > 0 && (
        <Button
          onClick={handleSetAllAvailable}
          variant="secondary"
          fullWidth
        >
          Set All Remaining as Available
        </Button>
      )}

      <div className="space-y-3">
        {rounds.map(round => (
          <Card key={round.id} className={round.isPast ? 'opacity-60' : ''}>
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">Round {round.round_number}</h3>
                  <p className="text-gray-600 text-sm">{round.opposition || 'TBA'}</p>
                  <p className="text-gray-500 text-xs mt-1">{round.date_time ? formatDate(round.date_time) : 'Date TBA'}</p>
                </div>
                {getAvailabilityBadge(round.availability?.status)}
              </div>

              {!round.isPast && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    onClick={() => handleAvailabilityChange(round.id, 'available')}
                    disabled={updatingRound === round.id}
                    className={`py-2 px-2 rounded text-xs font-medium transition-colors ${
                      round.availability?.status === 'available'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Available
                  </button>
                  <button
                    onClick={() => handleAvailabilityChange(round.id, 'maybe')}
                    disabled={updatingRound === round.id}
                    className={`py-2 px-2 rounded text-xs font-medium transition-colors ${
                      round.availability?.status === 'maybe'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Maybe
                  </button>
                  <button
                    onClick={() => handleAvailabilityChange(round.id, 'unavailable')}
                    disabled={updatingRound === round.id}
                    className={`py-2 px-2 rounded text-xs font-medium transition-colors ${
                      round.availability?.status === 'unavailable'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Unavailable
                  </button>
                </div>
              )}

              {round.isPast && (
                <p className="text-xs text-gray-500 py-2">This round has passed</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
