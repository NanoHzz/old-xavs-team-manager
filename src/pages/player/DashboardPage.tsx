import { useEffect, useState } from 'react'
import { formatDateTime, formatDate } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button as _Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Calendar, AlertCircle } from 'lucide-react'
import type { Round, PlayerAvailability, Position } from '../../types'

interface NextGame {
  round: Round
  availability?: PlayerAvailability
  selectionStatus?: string
  position?: Position
}

interface RecentNotification {
  id: string
  title: string | null
  body: string | null
  type: string | null
  created_at: string
}

export default function DashboardPage() {
  const { currentTeam, currentMember } = useTeam()
  const { user } = useAuth()

  const [nextGame, setNextGame] = useState<NextGame | null>(null)
  const [availability, setAvailability] = useState<'available' | 'unavailable' | 'maybe' | null>(null)
  const [notifications, setNotifications] = useState<RecentNotification[]>([])
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)

  useEffect(() => {
    if (!currentTeam || !currentMember || !user) {
      setLoading(false)
      return
    }

    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        // Fetch active seasons for this team
        const { data: seasonsData } = await supabase
          .from('seasons')
          .select('id')
          .eq('team_id', currentTeam.id)
          .eq('is_active', true)

        const seasonIds = seasonsData?.map(s => s.id) || []

        // Fetch next upcoming round
        const { data: roundsData, error: roundsError } = seasonIds.length > 0
          ? await supabase
              .from('rounds')
              .select('*')
              .in('season_id', seasonIds)
              .gte('date_time', new Date().toISOString())
              .order('date_time', { ascending: true })
              .limit(1)
          : { data: [], error: null }

        if (roundsError) throw roundsError

        if (roundsData && roundsData.length > 0) {
          const nextRound = roundsData[0]

          // Fetch player availability for next round
          const { data: availData } = await supabase
            .from('player_availability')
            .select('*')
            .eq('member_id', currentMember.id)
            .eq('round_id', nextRound.id)
            .single()

          // Fetch selection info
          let selectionStatus = 'pending'
          let position: Position | undefined

          const { data: teamSelectionData } = await supabase
            .from('team_selections')
            .select('id')
            .eq('round_id', nextRound.id)
            .single()

          if (teamSelectionData) {
            const { data: selectionPlayersData } = await supabase
              .from('selection_players')
              .select('selection_type, positions(*)')
              .eq('team_selection_id', teamSelectionData.id)
              .eq('member_id', currentMember.id)
              .single()

            if (selectionPlayersData) {
              selectionStatus = selectionPlayersData.selection_type === 'on_field' ? 'selected' : selectionPlayersData.selection_type
              position = (selectionPlayersData.positions as unknown as Position[])?.[0]
            }
          }

          setNextGame({
            round: nextRound,
            availability: availData || undefined,
            selectionStatus,
            position,
          })

          if (availData) {
            setAvailability(availData.status)
          }
        }

        // Fetch recent notifications
        const { data: notificationsData } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        setNotifications(notificationsData || [])

        // Count games played this season
        const { data: selectedData, error: selectedError } = await supabase
          .from('selection_players')
          .select('team_selection_id')
          .eq('member_id', currentMember.id)

        if (!selectedError && selectedData) {
          const teamSelectionIds = selectedData.map(s => s.team_selection_id)
          if (teamSelectionIds.length > 0) {
            const { count } = await supabase
              .from('team_selections')
              .select('*', { count: 'exact' })
              .in('id', teamSelectionIds)

            setGamesPlayed(count || 0)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [currentTeam, currentMember, user])

  const handleAvailabilityChange = async (status: 'available' | 'unavailable' | 'maybe') => {
    if (!currentMember || !nextGame) return

    setUpdatingAvailability(true)
    try {
      const { error } = await supabase.from('player_availability').upsert({
        member_id: currentMember.id,
        round_id: nextGame.round.id,
        status: status,
      })

      if (error) throw error
      setAvailability(status)
    } finally {
      setUpdatingAvailability(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome, {user?.user_metadata?.full_name || 'Player'}</p>
      </div>

      {/* Next Game Card */}
      <Card title="Next Game">
        {nextGame ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{nextGame.round.opposition || 'TBA'}</h3>
                <p className="text-gray-600 text-sm">Round {nextGame.round.round_number}</p>
              </div>
              {nextGame.selectionStatus && (
                <Badge
                  variant={
                    nextGame.selectionStatus === 'selected'
                      ? 'success'
                      : nextGame.selectionStatus === 'bench'
                        ? 'info'
                        : 'warning'
                  }
                >
                  {nextGame.selectionStatus === 'selected' && 'Selected'}
                  {nextGame.selectionStatus === 'bench' && 'Bench'}
                  {nextGame.selectionStatus === 'pending' && 'Pending'}
                </Badge>
              )}
            </div>

            {nextGame.position && (
              <div className="text-sm">
                <p className="text-gray-600">Position</p>
                <p className="font-medium">{nextGame.position.name}</p>
              </div>
            )}

            <div className="text-sm space-y-1">
              <p className="text-gray-600">Date & Time</p>
              <p className="font-medium">{nextGame.round.date_time ? formatDateTime(nextGame.round.date_time) : 'TBA'}</p>
            </div>

            {nextGame.round.venue && (
              <div className="text-sm">
                <p className="text-gray-600">Venue</p>
                <p className="font-medium">{nextGame.round.venue}</p>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={<Calendar className="w-12 h-12" />}
            title="No upcoming games"
            description="There are no games scheduled at the moment."
          />
        )}
      </Card>

      {/* Availability Card */}
      {nextGame && (
        <Card title="Your Availability">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleAvailabilityChange('available')}
                disabled={updatingAvailability}
                className={`py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                  availability === 'available'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Available
              </button>
              <button
                onClick={() => handleAvailabilityChange('maybe')}
                disabled={updatingAvailability}
                className={`py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                  availability === 'maybe'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Maybe
              </button>
              <button
                onClick={() => handleAvailabilityChange('unavailable')}
                disabled={updatingAvailability}
                className={`py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                  availability === 'unavailable'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Unavailable
              </button>
            </div>
            {updatingAvailability && <p className="text-xs text-gray-500">Saving...</p>}
          </div>
        </Card>
      )}

      {/* Quick Stats Card */}
      <Card title="Quick Stats">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-blue-600">{gamesPlayed}</p>
            <p className="text-gray-600 text-sm">Games Played</p>
          </div>
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-gray-600">{currentMember?.jersey_number || '-'}</p>
            <p className="text-gray-600 text-sm">Jersey Number</p>
          </div>
        </div>
      </Card>

      {/* Recent Notifications */}
      <Card title="Recent Notifications">
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div key={notif.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{notif.title}</p>
                    <p className="text-gray-600 text-sm">{notif.body}</p>
                  </div>
                  <Badge variant="default">{notif.type}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(notif.created_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<AlertCircle className="w-8 h-8" />}
            title="No notifications"
            description="You're all caught up!"
          />
        )}
      </Card>
    </div>
  )
}
