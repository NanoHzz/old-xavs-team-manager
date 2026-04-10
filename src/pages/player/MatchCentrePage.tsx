import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { AflOval } from '../../components/ui/AflOval'
import { formatDateTime } from '../../lib/utils'
import { ArrowLeft, Users, BarChart3, Award, CheckCircle } from 'lucide-react'
import type { Round } from '../../types'

interface TeamSheetPlayer {
  id: string
  member_id: string
  team_selection_id: string
  position_id: string | null
  selection_type: string
  memberName?: string
  jerseyNumber?: string | null
  positionName?: string
  primaryPosition?: string | null
}

interface PlayerGameStat {
  id: string
  round_id: string
  member_id: string
  goals: number
  behinds: number
  created_at: string
}

interface PlayerVote {
  id: string
  round_id: string
  voter_member_id: string
  voted_for_member_id: string
  votes: number
  created_at: string
}

interface AggregatedVote {
  member_id: string
  memberName: string
  totalVotes: number
  voterCount: number
}

type TabId = 'team' | 'stats' | 'votes'

export default function MatchCentrePage() {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const { currentTeam, currentMember, members } = useTeam()

  // State
  const [round, setRound] = useState<Round | null>(null)
  const [tab, setTab] = useState<TabId>('team')
  const [loading, setLoading] = useState(true)

  // Team data
  const [players, setPlayers] = useState<TeamSheetPlayer[]>([])

  // Stats data
  const [allStats, setAllStats] = useState<PlayerGameStat[]>([])
  const [myGoals, setMyGoals] = useState(0)
  const [myBehinds, setMyBehinds] = useState(0)
  const [savingStats, setSavingStats] = useState(false)
  const [statsSaved, setStatsSaved] = useState(false)

  // Votes data
  const [myVotes, setMyVotes] = useState<Record<string, number>>({})
  const [allVotes, setAllVotes] = useState<PlayerVote[]>([])
  const [savingVotes, setSavingVotes] = useState(false)
  const [votesSaved, setVotesSaved] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)

  const isCoachOrAdmin = currentMember?.role === 'coach' || currentMember?.role === 'admin'

  const tabs = [
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'stats' as const, label: 'Stats', icon: BarChart3 },
    { id: 'votes' as const, label: 'Votes', icon: Award },
  ]

  // Main data fetch
  useEffect(() => {
    if (!roundId || !currentTeam || !currentMember) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      try {
        // 1. Fetch round
        const { data: roundData, error: roundError } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', roundId)
          .single()

        if (roundError) throw roundError
        setRound(roundData)

        // 2. Fetch team selection and selection players
        const { data: teamSelectionData, error: tsError } = await supabase
          .from('team_selections')
          .select('*')
          .eq('round_id', roundId)
          .single()

        if (tsError) throw tsError

        const { data: selectionPlayersData, error: spError } = await supabase
          .from('selection_players')
          .select(`
            *,
            positions(name),
            members(jersey_number, primary_position)
          `)
          .eq('team_selection_id', teamSelectionData.id)

        if (spError) throw spError

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

        setPlayers(playersWithInfo)

        // 3. Fetch player game stats
        const { data: statsData, error: statsError } = await supabase
          .from('player_game_stats')
          .select('*')
          .eq('round_id', roundId)

        if (statsError) throw statsError
        setAllStats(statsData || [])

        // Find current user's stats
        const myStats = statsData?.find(s => s.member_id === currentMember.id)
        if (myStats) {
          setMyGoals(myStats.goals)
          setMyBehinds(myStats.behinds)
        }

        // 4. Fetch current user's votes
        const { data: myVotesData, error: myVotesError } = await supabase
          .from('player_votes')
          .select('*')
          .eq('round_id', roundId)
          .eq('voter_member_id', currentMember.id)

        if (myVotesError) throw myVotesError

        const myVotesMap: Record<string, number> = {}
        if (myVotesData) {
          for (const vote of myVotesData) {
            myVotesMap[vote.voted_for_member_id] = vote.votes
          }
        }
        setMyVotes(myVotesMap)
        setHasVoted((myVotesData?.length || 0) > 0)

        // 5. If coach/admin, fetch all votes
        if (isCoachOrAdmin) {
          const { data: allVotesData, error: allVotesError } = await supabase
            .from('player_votes')
            .select('*')
            .eq('round_id', roundId)

          if (allVotesError) throw allVotesError
          setAllVotes(allVotesData || [])
        }
      } catch (error) {
        console.error('Error fetching match centre data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [roundId, currentTeam, currentMember, isCoachOrAdmin, members])

  const getFieldPlayers = () => players.filter(p => p.selection_type === 'on_field')
  const getBenchPlayers = () => players.filter(p => p.selection_type !== 'on_field')

  const handleSaveStats = async () => {
    if (!roundId || !currentMember) return

    setSavingStats(true)
    try {
      const { error } = await supabase
        .from('player_game_stats')
        .upsert(
          {
            round_id: roundId,
            member_id: currentMember.id,
            goals: myGoals,
            behinds: myBehinds,
          },
          { onConflict: 'round_id,member_id' }
        )

      if (error) throw error

      setStatsSaved(true)
      setTimeout(() => setStatsSaved(false), 2000)
    } catch (error) {
      console.error('Error saving stats:', error)
    } finally {
      setSavingStats(false)
    }
  }

  const validateVotes = (): boolean => {
    const voteCounts: Record<number, number> = {}
    Object.values(myVotes).forEach(vote => {
      if (vote > 0) {
        voteCounts[vote] = (voteCounts[vote] || 0) + 1
      }
    })

    // Each vote value can only be assigned once
    for (const count of Object.values(voteCounts)) {
      if (count > 1) return false
    }

    // Can't vote for themselves
    if (myVotes[currentMember?.id || ''] && myVotes[currentMember?.id || ''] > 0) {
      return false
    }

    return true
  }

  const handleSaveVotes = async () => {
    if (!roundId || !currentMember || !validateVotes()) return

    setSavingVotes(true)
    try {
      // Delete existing votes
      const { error: deleteError } = await supabase
        .from('player_votes')
        .delete()
        .eq('round_id', roundId)
        .eq('voter_member_id', currentMember.id)

      if (deleteError) throw deleteError

      // Insert new votes (only non-zero votes)
      const votesToInsert = Object.entries(myVotes)
        .filter(([_, value]) => value > 0)
        .map(([votedMemberId, voteValue]) => ({
          round_id: roundId,
          voter_member_id: currentMember.id,
          voted_for_member_id: votedMemberId,
          votes: voteValue,
        }))

      if (votesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('player_votes')
          .insert(votesToInsert)

        if (insertError) throw insertError
      }

      setHasVoted(votesToInsert.length > 0)
      setVotesSaved(true)
      setTimeout(() => setVotesSaved(false), 2000)
    } catch (error) {
      console.error('Error saving votes:', error)
    } finally {
      setSavingVotes(false)
    }
  }

  const getAggregatedVotes = (): AggregatedVote[] => {
    const votesMap: Record<string, { votes: number; voters: Set<string> }> = {}

    allVotes.forEach(vote => {
      if (!votesMap[vote.voted_for_member_id]) {
        votesMap[vote.voted_for_member_id] = { votes: 0, voters: new Set() }
      }
      votesMap[vote.voted_for_member_id].votes += vote.votes
      votesMap[vote.voted_for_member_id].voters.add(vote.voter_member_id)
    })

    return Object.entries(votesMap)
      .map(([memberId, data]) => {
        const member = members.find(m => m.id === memberId)
        return {
          member_id: memberId,
          memberName: member?.display_name || member?.guest_name || 'Unknown',
          totalVotes: data.votes,
          voterCount: data.voters.size,
        }
      })
      .sort((a, b) => b.totalVotes - a.totalVotes)
  }

  const getTotalTeamStats = () => {
    return {
      goals: allStats.reduce((sum, s) => sum + s.goals, 0),
      behinds: allStats.reduce((sum, s) => sum + s.behinds, 0),
    }
  }

  if (loading) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Match Centre</h1>
        <LoadingSpinner />
      </div>
    )
  }

  if (!round) {
    return (
      <div className="p-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Match Centre</h1>
        </div>
        <Card>
          <p className="text-gray-500">Round not found</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      {/* Back button + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Match Centre</h1>
          <p className="text-sm text-gray-500">
            Round {round.round_number} vs {round.opposition || 'TBA'}
          </p>
        </div>
      </div>

      {/* Match info card */}
      <Card>
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">{round.opposition || 'TBA'}</p>
            <p className="text-sm text-gray-500">
              {round.date_time ? formatDateTime(round.date_time) : 'TBA'}
            </p>
            {round.venue && <p className="text-xs text-gray-400">{round.venue}</p>}
          </div>
          <Badge
            variant={
              round.status === 'completed' ? 'success' : round.status === 'team_selected' ? 'info' : 'warning'
            }
          >
            {round.status === 'completed'
              ? 'Completed'
              : round.status === 'team_selected'
              ? 'Team Selected'
              : 'Upcoming'}
          </Badge>
        </div>
      </Card>

      {/* Tab bar */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                tab === t.id ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}

      {/* Team Tab */}
      {tab === 'team' && (
        <>
          {players.length === 0 ? (
            <Card>
              <p className="text-center text-gray-500 py-8">Team not yet announced</p>
            </Card>
          ) : (
            <>
              <Card title="Team Positions" padding={false}>
                <div className="p-2">
                  <AflOval
                    players={players.map(p => ({
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

              {getBenchPlayers().length > 0 && (
                <Card title="Interchange">
                  <div className="flex flex-wrap gap-2">
                    {getBenchPlayers().map(player => (
                      <div
                        key={player.id}
                        className={`px-3 py-2 rounded text-sm font-medium ${
                          player.member_id === currentMember?.id
                            ? 'bg-blue-50 border border-blue-300'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        {player.jerseyNumber && <span className="font-bold mr-1">#{player.jerseyNumber}</span>}
                        {player.memberName}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && (
        <>
          {round.status === 'completed' && (
            <>
              {/* Your stats */}
              <Card title="Your Stats">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Goals</label>
                      <input
                        type="number"
                        min="0"
                        value={myGoals}
                        onChange={e => setMyGoals(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Behinds</label>
                      <input
                        type="number"
                        min="0"
                        value={myBehinds}
                        onChange={e => setMyBehinds(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveStats}
                      disabled={savingStats}
                      className="flex-1"
                    >
                      {savingStats ? 'Saving...' : 'Save Stats'}
                    </Button>
                    {statsSaved && <div className="text-green-600 text-sm flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Saved
                    </div>}
                  </div>
                </div>
              </Card>

              {/* Team stats */}
              <Card title="Team Stats">
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 font-semibold">Player</th>
                          <th className="text-center py-2 px-2 font-semibold">Goals</th>
                          <th className="text-center py-2 px-2 font-semibold">Behinds</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players
                          .sort((a, b) => {
                            const aStats = allStats.find(s => s.member_id === a.member_id)
                            const bStats = allStats.find(s => s.member_id === b.member_id)
                            return (bStats?.goals || 0) - (aStats?.goals || 0)
                          })
                          .map(player => {
                            const stats = allStats.find(s => s.member_id === player.member_id)
                            return (
                              <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-2 px-2">{player.memberName}</td>
                                <td className="text-center py-2 px-2">{stats?.goals || 0}</td>
                                <td className="text-center py-2 px-2">{stats?.behinds || 0}</td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Total Goals</p>
                      <p className="text-2xl font-bold">{getTotalTeamStats().goals}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Total Behinds</p>
                      <p className="text-2xl font-bold">{getTotalTeamStats().behinds}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {round.status !== 'completed' && (
            <Card>
              <p className="text-center text-gray-500 py-8">Stats will be available after the match is completed</p>
            </Card>
          )}
        </>
      )}

      {/* Votes Tab */}
      {tab === 'votes' && (
        <>
          {round.status === 'completed' && (
            <>
              {/* Voting section */}
              <Card title="Best & Fairest Votes">
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Award votes to the best players this round. 5 votes for best, 4 for second best, etc.
                  </p>

                  <div className="space-y-3">
                    {getFieldPlayers()
                      .concat(getBenchPlayers())
                      .filter(p => p.member_id !== currentMember?.id)
                      .map(player => (
                        <div key={player.id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm font-medium">{player.memberName}</span>
                          <select
                            value={myVotes[player.member_id] || 0}
                            onChange={e => {
                              const value = parseInt(e.target.value)
                              setMyVotes(prev => ({
                                ...prev,
                                [player.member_id]: value,
                              }))
                            }}
                            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={0}>-</option>
                            <option value={5}>5</option>
                            <option value={4}>4</option>
                            <option value={3}>3</option>
                            <option value={2}>2</option>
                            <option value={1}>1</option>
                          </select>
                        </div>
                      ))}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={handleSaveVotes}
                      disabled={savingVotes || !validateVotes()}
                      className="flex-1"
                    >
                      {savingVotes ? 'Saving...' : 'Submit Votes'}
                    </Button>
                    {votesSaved && (
                      <div className="text-green-600 text-sm flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Submitted
                      </div>
                    )}
                  </div>

                  {!validateVotes() && (
                    <p className="text-xs text-red-600">
                      Each vote value (5,4,3,2,1) can only be assigned once, and you cannot vote for yourself.
                    </p>
                  )}

                  {hasVoted && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700">Your votes have been submitted</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Vote results - coach/admin only */}
              {isCoachOrAdmin && (
                <Card title="Vote Results">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 font-semibold">Player</th>
                          <th className="text-center py-2 px-2 font-semibold">Total Votes</th>
                          <th className="text-center py-2 px-2 font-semibold">Voters</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getAggregatedVotes().map(vote => (
                          <tr key={vote.member_id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-2">{vote.memberName}</td>
                            <td className="text-center py-2 px-2 font-semibold">{vote.totalVotes}</td>
                            <td className="text-center py-2 px-2">{vote.voterCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {getAggregatedVotes().length === 0 && (
                    <p className="text-center text-gray-500 py-4">No votes submitted yet</p>
                  )}
                </Card>
              )}
            </>
          )}

          {round.status !== 'completed' && (
            <Card>
              <p className="text-center text-gray-500 py-8">Voting will be available after the match is completed</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
