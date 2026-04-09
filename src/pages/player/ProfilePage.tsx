import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { LogOut, Copy, Check } from 'lucide-react'
import type { InviteCode } from '../../types'

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { currentTeam, teams, currentMember, setCurrentTeam } = useTeam()

  const [_jerseyNumber, setJerseyNumber] = useState<string | null>(null)
  const [jerseyInput, setJerseyInput] = useState('')
  const [savingJersey, setSavingJersey] = useState(false)
  const [jerseyError, setJerseyError] = useState('')
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [primaryPosition, setPrimaryPosition] = useState<string | null>(null)
  const [secondaryPosition, setSecondaryPosition] = useState<string | null>(null)
  const [thirdPosition, setThirdPosition] = useState<string | null>(null)
  const [savingPositions, setSavingPositions] = useState(false)
  const [positionError, setPositionError] = useState('')

  useEffect(() => {
    if (!currentMember || !currentTeam) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      try {
        setJerseyNumber(currentMember.jersey_number)
        setJerseyInput(currentMember.jersey_number?.toString() || '')
        setPrimaryPosition(currentMember.primary_position || null)
        setSecondaryPosition(currentMember.secondary_position || null)
        setThirdPosition(currentMember.third_position || null)

        // Fetch team invite code
        const { data: inviteData } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('team_id', currentTeam.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (inviteData) {
          setInviteCode(inviteData)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentMember, currentTeam])

  const handleJerseySave = async () => {
    if (!currentMember) return

    setJerseyError('')

    // Keep jersey number as string (DB column is text)
    const jerseyNum = jerseyInput.trim() || null

    if (jerseyInput.trim()) {
      const numValue = parseInt(jerseyInput.trim(), 10)
      if (isNaN(numValue) || numValue < 1 || numValue > 99) {
        setJerseyError('Jersey number must be between 1 and 99')
        return
      }
    }

    setSavingJersey(true)
    try {
      const { error } = await supabase
        .from('members')
        .update({ jersey_number: jerseyNum })
        .eq('id', currentMember.id)

      if (error) throw error

      setJerseyNumber(jerseyNum)
    } finally {
      setSavingJersey(false)
    }
  }

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return

    try {
      const inviteLink = `${window.location.origin}/join/${inviteCode.code}`
      await navigator.clipboard.writeText(inviteLink)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handlePositionsSave = async () => {
    if (!currentMember) return

    setPositionError('')
    setSavingPositions(true)
    try {
      const { error } = await supabase
        .from('members')
        .update({
          primary_position: primaryPosition,
          secondary_position: secondaryPosition,
          third_position: thirdPosition,
        })
        .eq('id', currentMember.id)

      if (error) throw error
    } finally {
      setSavingPositions(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {/* User Info */}
      <Card title="Account">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600">Full Name</p>
            <p className="font-semibold">{user?.user_metadata?.full_name || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-semibold">{user?.email || 'Not available'}</p>
          </div>
        </div>
      </Card>

      {/* Current Team Info */}
      {currentTeam && (
        <Card title="Current Team">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Team</p>
              <p className="font-semibold">{currentTeam.name}</p>
              {currentTeam.sport_type && <p className="text-sm text-gray-500 capitalize">{currentTeam.sport_type}</p>}
            </div>
            <div>
              <p className="text-sm text-gray-600">Role</p>
              <p className="font-semibold capitalize">
                {currentMember?.role === 'coach' && currentMember?.is_playing
                  ? 'Player-Coach'
                  : currentMember?.role === 'admin' && currentMember?.is_playing
                    ? 'Admin · Player'
                    : currentMember?.role || 'Player'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Jersey Number */}
      {currentMember && (
        <Card title="Jersey Number">
          <div className="space-y-3">
            <Input
              type="number"
              min="1"
              max="99"
              value={jerseyInput}
              onChange={e => {
                setJerseyInput(e.target.value)
                setJerseyError('')
              }}
              placeholder="Enter jersey number"
              error={jerseyError}
              helpText="Optional - 1 to 99"
            />
            <Button
              onClick={handleJerseySave}
              loading={savingJersey}
              fullWidth
              variant="primary"
              size="sm"
            >
              Save Jersey Number
            </Button>
          </div>
        </Card>
      )}

      {/* Position Preferences */}
      {currentMember && (
        <Card title="Position Preferences">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Position
              </label>
              <select
                value={primaryPosition || ''}
                onChange={e => setPrimaryPosition(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="back_key">Back (Key)</option>
                <option value="back_general">Back (General)</option>
                <option value="mid_centre">Mid (Centre)</option>
                <option value="mid_wing">Mid (Wing)</option>
                <option value="ruck">Ruck</option>
                <option value="forward_key">Forward (Key)</option>
                <option value="forward_small">Forward (Small)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secondary Position
              </label>
              <select
                value={secondaryPosition || ''}
                onChange={e => setSecondaryPosition(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="back_key">Back (Key)</option>
                <option value="back_general">Back (General)</option>
                <option value="mid_centre">Mid (Centre)</option>
                <option value="mid_wing">Mid (Wing)</option>
                <option value="ruck">Ruck</option>
                <option value="forward_key">Forward (Key)</option>
                <option value="forward_small">Forward (Small)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Third Position
              </label>
              <select
                value={thirdPosition || ''}
                onChange={e => setThirdPosition(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="back_key">Back (Key)</option>
                <option value="back_general">Back (General)</option>
                <option value="mid_centre">Mid (Centre)</option>
                <option value="mid_wing">Mid (Wing)</option>
                <option value="ruck">Ruck</option>
                <option value="forward_key">Forward (Key)</option>
                <option value="forward_small">Forward (Small)</option>
              </select>
            </div>

            {positionError && (
              <p className="text-sm text-red-600">{positionError}</p>
            )}

            <Button
              onClick={handlePositionsSave}
              loading={savingPositions}
              fullWidth
              variant="primary"
              size="sm"
            >
              Save Positions
            </Button>
          </div>
        </Card>
      )}

      {/* Invite Code */}
      {inviteCode && (
        <Card title="Team Invite Code">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Share this code to invite new players to your team</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 p-3 rounded font-mono text-sm text-center">
                {inviteCode.code}
              </code>
              <button
                onClick={handleCopyInviteCode}
                className="p-3 rounded bg-blue-100 hover:bg-blue-200 transition-colors"
                title="Copy invite link"
              >
                {copyFeedback ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-blue-600" />
                )}
              </button>
            </div>
            {copyFeedback && (
              <p className="text-xs text-green-600 text-center">Invite link copied!</p>
            )}
          </div>
        </Card>
      )}

      {/* Team Switcher */}
      {teams.length > 1 && (
        <Card title="Your Teams">
          <div className="space-y-2">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setCurrentTeam(team)}
                className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                  currentTeam?.id === team.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold">{team.name}</p>
                {team.sport_type && <p className="text-xs text-gray-500 capitalize">{team.sport_type}</p>}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Sign Out */}
      <Button
        onClick={handleSignOut}
        loading={signingOut}
        variant="danger"
        fullWidth
        className="mt-6"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    </div>
  )
}
