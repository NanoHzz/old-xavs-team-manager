import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle, Check } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTeam } from '../../contexts/TeamContext'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

interface InviteInfo {
  teamId: string
  teamName: string
  clubName: string
  expiresAt: string | null
  maxUses: number | null
  usedCount: number
}

const POSITION_OPTIONS = [
  { value: 'back_key', label: 'Back (Key)' },
  { value: 'back_general', label: 'Back (General)' },
  { value: 'mid_centre', label: 'Mid (Centre)' },
  { value: 'mid_wing', label: 'Mid (Wing)' },
  { value: 'ruck', label: 'Ruck' },
  { value: 'forward_key', label: 'Forward (Key)' },
  { value: 'forward_small', label: 'Forward (Small)' },
]

type PageState = 'loading' | 'valid' | 'position_select' | 'joined' | 'error' | 'expired'

export default function JoinTeamPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { refreshTeams } = useTeam()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  // Position selection state
  const [primaryPosition, setPrimaryPosition] = useState('')
  const [secondaryPosition, setSecondaryPosition] = useState('')
  const [savingPosition, setSavingPosition] = useState(false)
  const [newMemberId, setNewMemberId] = useState<string | null>(null)

  // Check if user is logged in, if not redirect to signup with return url
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signup', { state: { returnUrl: location.pathname } })
    }
  }, [user, authLoading, navigate, location.pathname])

  // Load invite code info using RPC function (bypasses RLS)
  useEffect(() => {
    if (!user || !code) return

    const loadInvite = async () => {
      try {
        // Use RPC function to get invite info (bypasses RLS)
        const { data: rawInviteData, error: inviteError } = await supabase
          .rpc('get_invite_info', { invite_code: code })

        const inviteData = rawInviteData as {
          team_id: string
          team_name: string
          club_name: string
          expires_at: string | null
          max_uses: number | null
          use_count: number
        } | null

        if (inviteError || !inviteData) {
          setError('Invite code not found or invalid')
          setPageState('error')
          return
        }

        // Check if expired
        if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
          setError('This invite link has expired')
          setPageState('expired')
          return
        }

        // Check if max uses reached
        if (
          inviteData.max_uses !== null &&
          inviteData.use_count >= inviteData.max_uses
        ) {
          setError('This invite link has reached its maximum uses')
          setPageState('error')
          return
        }

        // Check if already a member using RPC function (bypasses RLS)
        const { data: isMember } = await supabase
          .rpc('check_team_membership', {
            p_team_id: inviteData.team_id,
            p_user_id: user.id,
          })

        if (isMember) {
          setError('You are already a member of this team')
          setPageState('error')
          return
        }

        setInviteInfo({
          teamId: inviteData.team_id,
          teamName: inviteData.team_name,
          clubName: inviteData.club_name,
          expiresAt: inviteData.expires_at,
          maxUses: inviteData.max_uses,
          usedCount: inviteData.use_count,
        })

        setPageState('valid')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invite')
        setPageState('error')
      }
    }

    loadInvite()
  }, [user, code])

  const handleJoinTeam = async () => {
    if (!user || !inviteInfo || !code) return

    setJoining(true)

    try {
      // Create member record
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert({
          team_id: inviteInfo.teamId,
          user_id: user.id,
          role: 'player',
          status: 'active',
          display_name: user.user_metadata?.full_name || user.email || null,
        })
        .select('id')
        .single()

      if (memberError) throw memberError

      // Increment use_count
      const { error: updateError } = await supabase
        .from('invite_codes')
        .update({ use_count: inviteInfo.usedCount + 1 })
        .eq('code', code)

      if (updateError) throw updateError

      // Refresh teams so the context knows about the new team
      await refreshTeams()

      // Save member ID for position selection
      setNewMemberId(memberData.id)

      // Go to position selection step
      setPageState('position_select')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team')
      setJoining(false)
    }
  }

  const handleSavePositions = async () => {
    if (!newMemberId) return

    setSavingPosition(true)

    try {
      const { error } = await supabase
        .from('members')
        .update({
          primary_position: primaryPosition || null,
          secondary_position: secondaryPosition || null,
        })
        .eq('id', newMemberId)

      if (error) throw error

      setPageState('joined')
    } catch (err) {
      // Don't block the flow — positions can be set later
      console.error('Error saving positions:', err)
      setPageState('joined')
    } finally {
      setSavingPosition(false)
    }
  }

  const handleSkipPositions = () => {
    setPageState('joined')
  }

  // Loading state
  if (authLoading || pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="p-8 text-center">
            <div className="inline-flex mb-4">
              <svg
                className="animate-spin h-6 w-6 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </Card>
      </div>
    )
  }

  // Position selection step (after joining)
  if (pageState === 'position_select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="bg-green-100 rounded-full p-3 mb-4 inline-flex">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">You're in!</h2>
              <p className="text-gray-600 text-sm">
                Welcome to <strong>{inviteInfo?.teamName}</strong>. Where do you like to play?
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Position
                </label>
                <select
                  value={primaryPosition}
                  onChange={(e) => setPrimaryPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select position...</option>
                  {POSITION_OPTIONS.map((pos) => (
                    <option key={pos.value} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secondary Position (optional)
                </label>
                <select
                  value={secondaryPosition}
                  onChange={(e) => setSecondaryPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select position...</option>
                  {POSITION_OPTIONS.filter((p) => p.value !== primaryPosition).map((pos) => (
                    <option key={pos.value} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleSavePositions}
                variant="primary"
                fullWidth
                loading={savingPosition}
                disabled={!primaryPosition}
              >
                Save & Continue
              </Button>
              <Button
                onClick={handleSkipPositions}
                variant="outline"
                fullWidth
              >
                Skip for now
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Success state (final)
  if (pageState === 'joined') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="p-8 text-center">
            <div className="bg-green-100 rounded-full p-3 mb-4 inline-flex">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
            <p className="text-gray-600 mb-6">
              You've successfully joined <strong>{inviteInfo?.teamName}</strong> at{' '}
              <strong>{inviteInfo?.clubName}</strong>.
            </p>
            <Button
              onClick={() => navigate('/')}
              variant="primary"
              fullWidth
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Error/Expired state
  if (pageState === 'error' || pageState === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="p-8 text-center">
            <div className="bg-red-100 rounded-full p-3 mb-4 inline-flex">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {pageState === 'expired' ? 'Invite Expired' : 'Invalid Invite'}
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button
              onClick={() => navigate('/')}
              variant="primary"
              fullWidth
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Valid invite state — confirm join
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Join Team</h2>
          <p className="text-gray-600 text-sm mb-6">
            You've been invited to join a team
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-1">TEAM</p>
              <p className="text-lg font-bold text-gray-900">{inviteInfo?.teamName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">CLUB</p>
              <p className="text-lg font-bold text-gray-900">{inviteInfo?.clubName}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleJoinTeam}
              variant="primary"
              fullWidth
              loading={joining}
            >
              Join Team
            </Button>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              fullWidth
            >
              Not Now
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Expires: {new Date(inviteInfo?.expiresAt || '').toLocaleDateString()}
          </p>
        </div>
      </Card>
    </div>
  )
}
