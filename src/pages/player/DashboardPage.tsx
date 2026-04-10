import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDateTime, formatDate } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Calendar, AlertCircle, Plus, Send, X, MessageCircle, Users, ChevronRight } from 'lucide-react'
import type { Round, PlayerAvailability, Position } from '../../types'

interface NextGame {
  round: Round
  availability?: PlayerAvailability
  selectionStatus?: string
  position?: Position
}

interface Announcement {
  id: string
  team_id: string
  member_id: string
  title: string
  body: string | null
  created_at: string
  authorName?: string
  authorRole?: string
  comments: AnnouncementCommentData[]
}

interface AnnouncementCommentData {
  id: string
  announcement_id: string
  member_id: string
  body: string
  created_at: string
  authorName?: string
}

export default function DashboardPage() {
  const { currentTeam, currentMember, members } = useTeam()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [nextGame, setNextGame] = useState<NextGame | null>(null)
  const [availability, setAvailability] = useState<'available' | 'unavailable' | 'maybe' | null>(null)
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)
  const [availableCount, setAvailableCount] = useState(0)

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showPostForm, setShowPostForm] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [sendingPost, setSendingPost] = useState(false)

  // Comment state
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  useEffect(() => {
    if (!currentTeam || !currentMember || !user) {
      setLoading(false)
      return
    }

    fetchDashboardData()
  }, [currentTeam, currentMember, user])

  const fetchDashboardData = async () => {
    if (!currentTeam || !currentMember || !user) return
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
            position = selectionPlayersData.positions as unknown as Position
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

        // Fetch available player count for this round
        const { count: availCount } = await supabase
          .from('player_availability')
          .select('*', { count: 'exact', head: true })
          .eq('round_id', nextRound.id)
          .in('status', ['available', 'maybe'])

        setAvailableCount(availCount || 0)
      }

      // Fetch announcements for this team
      const { data: announcementsData } = await supabase
        .from('team_announcements')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (announcementsData && announcementsData.length > 0) {
        // Fetch comments for all announcements
        const announcementIds = announcementsData.map(a => a.id)
        const { data: commentsData } = await supabase
          .from('announcement_comments')
          .select('*')
          .in('announcement_id', announcementIds)
          .order('created_at', { ascending: true })

        const enriched: Announcement[] = announcementsData.map(a => {
          const author = members.find(m => m.id === a.member_id)
          const comments = (commentsData || [])
            .filter(c => c.announcement_id === a.id)
            .map(c => {
              const commentAuthor = members.find(m => m.id === c.member_id)
              return {
                ...c,
                authorName: commentAuthor?.display_name || commentAuthor?.guest_name || 'Unknown',
              }
            })
          return {
            ...a,
            authorName: author?.display_name || author?.guest_name || 'Unknown',
            authorRole: author?.role || 'player',
            comments,
          }
        })
        setAnnouncements(enriched)
      } else {
        setAnnouncements([])
      }

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

  const handleAvailabilityChange = async (status: 'available' | 'unavailable' | 'maybe') => {
    if (!currentMember || !nextGame) return

    setUpdatingAvailability(true)
    try {
      const { error } = await supabase.from('player_availability').upsert(
        {
          member_id: currentMember.id,
          round_id: nextGame.round.id,
          status: status,
        },
        { onConflict: 'member_id,round_id' }
      )

      if (error) throw error
      setAvailability(status)
    } finally {
      setUpdatingAvailability(false)
    }
  }

  const handlePostAnnouncement = async () => {
    if (!currentTeam || !currentMember || !postTitle.trim()) return

    setSendingPost(true)
    try {
      const { error } = await supabase
        .from('team_announcements')
        .insert({
          team_id: currentTeam.id,
          member_id: currentMember.id,
          title: postTitle.trim(),
          body: postBody.trim() || null,
        })

      if (error) throw error

      setPostTitle('')
      setPostBody('')
      setShowPostForm(false)
      await fetchDashboardData()
    } catch (err) {
      console.error('Error posting announcement:', err)
      alert('Failed to post announcement')
    } finally {
      setSendingPost(false)
    }
  }

  const handlePostComment = async (announcementId: string) => {
    if (!currentMember || !commentText.trim()) return

    setSendingComment(true)
    try {
      const { error } = await supabase
        .from('announcement_comments')
        .insert({
          announcement_id: announcementId,
          member_id: currentMember.id,
          body: commentText.trim(),
        })

      if (error) throw error

      setCommentText('')
      await fetchDashboardData()
    } catch (err) {
      console.error('Error posting comment:', err)
      alert('Failed to post comment')
    } finally {
      setSendingComment(false)
    }
  }

  const timeAgo = (dateStr: string) => {
    const now = new Date().getTime()
    const date = new Date(dateStr).getTime()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateStr)
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

      {/* Match Centre Card */}
      {nextGame ? (
        <div
          onClick={() => navigate(`/match-centre/${nextGame.round.id}`)}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Match Centre</p>
              <h3 className="font-semibold text-lg">{nextGame.round.opposition || 'TBA'}</h3>
              <p className="text-gray-500 text-sm">Round {nextGame.round.round_number}</p>
            </div>
            <div className="flex items-center gap-3">
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
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{nextGame.round.date_time ? formatDateTime(nextGame.round.date_time) : 'TBA'}</span>
            </div>
            {availableCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>{availableCount} available</span>
              </div>
            )}
          </div>

          {nextGame.round.venue && (
            <p className="text-sm text-gray-500 mt-1">{nextGame.round.venue}</p>
          )}

          {nextGame.position && (
            <p className="text-sm mt-2"><span className="text-gray-500">Your position:</span> <span className="font-medium">{nextGame.position.name}</span></p>
          )}
        </div>
      ) : (
        <Card title="Next Game">
          <EmptyState
            icon={<Calendar className="w-12 h-12" />}
            title="No upcoming games"
            description="There are no games scheduled at the moment."
          />
        </Card>
      )}

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

      {/* Team Board - Announcements */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <span>Team Board</span>
            <button
              onClick={() => setShowPostForm(!showPostForm)}
              className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              title="Post to team board"
            >
              {showPostForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        }
      >
        {/* Post Form - available to all team members */}
        {showPostForm && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 mb-2">Post to team board</p>
            <input
              type="text"
              placeholder="Title..."
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={100}
            />
            <textarea
              placeholder="Write something (optional)..."
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              maxLength={500}
            />
            <Button
              onClick={handlePostAnnouncement}
              variant="primary"
              fullWidth
              loading={sendingPost}
              disabled={!postTitle.trim()}
            >
              <Send className="w-4 h-4 mr-1" />
              Post
            </Button>
          </div>
        )}

        {announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map(announcement => (
              <div key={announcement.id} className="border-b last:border-b-0 pb-4 last:pb-0">
                {/* Announcement header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{announcement.authorName}</span>
                      {(announcement.authorRole === 'coach' || announcement.authorRole === 'admin') && (
                        <Badge variant="info">{announcement.authorRole === 'coach' ? 'Coach' : 'Admin'}</Badge>
                      )}
                      <span className="text-xs text-gray-400">{timeAgo(announcement.created_at)}</span>
                    </div>
                    <p className="font-medium text-sm">{announcement.title}</p>
                    {announcement.body && (
                      <p className="text-gray-600 text-sm mt-1">{announcement.body}</p>
                    )}
                  </div>
                </div>

                {/* Comment toggle + count */}
                <button
                  onClick={() => setExpandedAnnouncement(
                    expandedAnnouncement === announcement.id ? null : announcement.id
                  )}
                  className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {announcement.comments.length > 0
                    ? `${announcement.comments.length} comment${announcement.comments.length > 1 ? 's' : ''}`
                    : 'Comment'}
                </button>

                {/* Expanded comments */}
                {expandedAnnouncement === announcement.id && (
                  <div className="mt-2 ml-3 border-l-2 border-gray-200 pl-3 space-y-2">
                    {announcement.comments.map(comment => (
                      <div key={comment.id} className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-xs">{comment.authorName}</span>
                          <span className="text-xs text-gray-400">{timeAgo(comment.created_at)}</span>
                        </div>
                        <p className="text-gray-700 text-sm">{comment.body}</p>
                      </div>
                    ))}

                    {/* Comment input */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={expandedAnnouncement === announcement.id ? commentText : ''}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && commentText.trim()) {
                            handlePostComment(announcement.id)
                          }
                        }}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        maxLength={300}
                      />
                      <button
                        onClick={() => handlePostComment(announcement.id)}
                        disabled={!commentText.trim() || sendingComment}
                        className="px-2 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<AlertCircle className="w-8 h-8" />}
            title="No posts yet"
            description="Be the first to post on the team board!"
          />
        )}
      </Card>
    </div>
  )
}
