import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Copy, Check } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTeam } from '../../contexts/TeamContext'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'

type Step = 'club' | 'team' | 'done'

interface ClubFormData {
  name: string
  location: string
  primaryColour: string
  secondaryColour: string
}

interface TeamFormData {
  name: string
  sportType: 'afl' | 'soccer' | 'rugby_league' | 'rugby_union'
  onFieldPlayers: number
  benchPlayers: number
  emergencyPlayers: number
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function ClubSetupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshTeams } = useTeam()
  const [step, setStep] = useState<Step>('club')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const [clubData, setClubData] = useState<ClubFormData>({
    name: '',
    location: '',
    primaryColour: '#1e40af',
    secondaryColour: '#ffffff',
  })

  const [teamData, setTeamData] = useState<TeamFormData>({
    name: '',
    sportType: 'afl',
    onFieldPlayers: 18,
    benchPlayers: 6,
    emergencyPlayers: 2,
  })

  const [clubErrors, setClubErrors] = useState<Record<string, string>>({})
  const [teamErrors, setTeamErrors] = useState<Record<string, string>>({})

  const validateClubStep = () => {
    const errors: Record<string, string> = {}

    if (!clubData.name.trim()) {
      errors.name = 'Club name is required'
    }

    setClubErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateTeamStep = () => {
    const errors: Record<string, string> = {}

    if (!teamData.name.trim()) {
      errors.name = 'Team name is required'
    }

    if (teamData.onFieldPlayers < 1) {
      errors.onFieldPlayers = 'Must have at least 1 player on field'
    }

    setTeamErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleClubNext = () => {
    if (validateClubStep()) {
      setStep('team')
      setError('')
    }
  }

  const handleSubmit = async () => {
    if (!validateTeamStep() || !user) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Create club
      const { data: clubResult, error: clubError } = await supabase
        .from('clubs')
        .insert({
          name: clubData.name,
          location: clubData.location || null,
          primary_colour: clubData.primaryColour,
          secondary_colour: clubData.secondaryColour,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (clubError) throw clubError
      if (!clubResult) throw new Error('Failed to create club')

      const clubId = clubResult.id

      // Create team
      const { data: teamResult, error: teamError } = await supabase
        .from('teams')
        .insert({
          club_id: clubId,
          name: teamData.name,
          sport_type: teamData.sportType,
          on_field_count: teamData.onFieldPlayers,
          bench_count: teamData.benchPlayers,
          emergency_count: teamData.emergencyPlayers,
        })
        .select('id')
        .single()

      if (teamError) throw teamError
      if (!teamResult) throw new Error('Failed to create team')

      const teamId = teamResult.id

      // Add current user as admin
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          team_id: teamId,
          user_id: user.id,
          role: 'admin',
          status: 'active',
          display_name: user.user_metadata?.full_name || user.email || null,
        })

      if (memberError) throw memberError

      // Generate and create invite code
      const code = generateInviteCode()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30 days

      const { error: inviteError } = await supabase
        .from('invite_codes')
        .insert({
          team_id: teamId,
          code: code,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          max_uses: null,
          use_count: 0,
        })

      if (inviteError) throw inviteError

      // Refresh teams so the app knows we have a team now
      await refreshTeams()

      // Generate invite link
      const link = `${window.location.origin}/join/${code}`
      setInviteLink(link)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up club. Please try again.')
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Step 1: Club Details
  if (step === 'club') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* Join existing team option */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Have an invite code?</h2>
              <p className="text-gray-600 text-sm mb-4">
                If your coach sent you a code or link, enter it here to join your team.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.trim().toUpperCase())}
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    if (inviteCode) navigate(`/join/${inviteCode}`)
                  }}
                  disabled={!inviteCode}
                >
                  Join
                </Button>
              </div>
            </div>
          </Card>

          <div className="text-center text-white text-sm font-medium">or</div>

          {/* Create new club */}
          <Card>
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Set Up Your Club</h2>
              <p className="text-gray-600 text-sm mt-1">Step 1 of 3</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Club Name"
                type="text"
                placeholder="e.g., Westside Football Club"
                value={clubData.name}
                onChange={(e) => setClubData({ ...clubData, name: e.target.value })}
                error={clubErrors.name}
                required
                fullWidth
              />

              <Input
                label="Location (Optional)"
                type="text"
                placeholder="e.g., Melbourne, VIC"
                value={clubData.location}
                onChange={(e) => setClubData({ ...clubData, location: e.target.value })}
                fullWidth
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Colour
                </label>
                <input
                  type="color"
                  value={clubData.primaryColour}
                  onChange={(e) => setClubData({ ...clubData, primaryColour: e.target.value })}
                  className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secondary Colour
                </label>
                <input
                  type="color"
                  value={clubData.secondaryColour}
                  onChange={(e) => setClubData({ ...clubData, secondaryColour: e.target.value })}
                  className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
              </div>

              <Button
                onClick={handleClubNext}
                variant="primary"
                fullWidth
                className="mt-6"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          </Card>
        </div>
      </div>
    )
  }

  // Step 2: Team Setup
  if (step === 'team') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Set Up Your Team</h2>
              <p className="text-gray-600 text-sm mt-1">Step 2 of 3</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Team Name"
                type="text"
                placeholder="e.g., Seniors"
                value={teamData.name}
                onChange={(e) => setTeamData({ ...teamData, name: e.target.value })}
                error={teamErrors.name}
                required
                fullWidth
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sport Type
                </label>
                <select
                  value={teamData.sportType}
                  onChange={(e) =>
                    setTeamData({
                      ...teamData,
                      sportType: e.target.value as 'afl' | 'soccer' | 'rugby_league' | 'rugby_union',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="afl">AFL</option>
                  <option value="soccer">Soccer</option>
                  <option value="rugby_league">Rugby League</option>
                  <option value="rugby_union">Rugby Union</option>
                </select>
              </div>

              <Input
                label="On-Field Players"
                type="number"
                value={teamData.onFieldPlayers}
                onChange={(e) =>
                  setTeamData({ ...teamData, onFieldPlayers: parseInt(e.target.value) || 0 })
                }
                error={teamErrors.onFieldPlayers}
                fullWidth
              />

              <Input
                label="Bench Players"
                type="number"
                value={teamData.benchPlayers}
                onChange={(e) =>
                  setTeamData({ ...teamData, benchPlayers: parseInt(e.target.value) || 0 })
                }
                fullWidth
              />

              <Input
                label="Emergency Players"
                type="number"
                value={teamData.emergencyPlayers}
                onChange={(e) =>
                  setTeamData({ ...teamData, emergencyPlayers: parseInt(e.target.value) || 0 })
                }
                fullWidth
              />

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setStep('club')}
                  variant="outline"
                  fullWidth
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  variant="primary"
                  fullWidth
                  loading={loading}
                >
                  Create Club
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Step 3: Success
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="bg-green-100 rounded-full p-3 mb-4 inline-flex">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">All Set!</h2>
              <p className="text-gray-600 text-sm mt-1">Club and team created successfully</p>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">INVITE LINK</p>
                <p className="text-sm text-gray-600 break-all font-mono">{inviteLink}</p>
              </div>

              <Button
                onClick={copyToClipboard}
                variant="secondary"
                fullWidth
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Invite Link
                  </>
                )}
              </Button>

              <Button
                onClick={() => navigate('/')}
                variant="primary"
                fullWidth
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }
}
