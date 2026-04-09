import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import type { Team, InviteCode } from '../../types'
import { Copy, Trash2, Plus, Shield, Users, User, Check, AlertTriangle, ChevronRight, Layers } from 'lucide-react'
import { addDays, format } from 'date-fns'

export default function SettingsPage() {
  const { currentTeam, currentClub, members, currentMember, refreshTeams, teams, setCurrentTeam } = useTeam()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string>('members')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCoach, setIsCoach] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingTeam, setDeletingTeam] = useState(false)

  // Form states
  const [clubForm, setClubForm] = useState({
    name: '',
    location: '',
  })

  const [teamForm, setTeamForm] = useState({
    name: '',
  })

  const [memberRoles, setMemberRoles] = useState<Record<string, 'admin' | 'coach' | 'player'>>({})
  const [memberPlayingStatus, setMemberPlayingStatus] = useState<Record<string, boolean>>({})
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Guest player form state
  const [guestForm, setGuestForm] = useState({
    name: '',
    jerseyNumber: '',
  })

  // Create team form
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamForm, setNewTeamForm] = useState({ name: '' })
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [allClubTeams, setAllClubTeams] = useState<Team[]>([])

  // Fetch initial data
  useEffect(() => {
    if (!currentTeam && !currentClub) return
    fetchData()
  }, [currentTeam, currentClub])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Check if current user is admin or coach
      if (currentMember) {
        setIsAdmin(currentMember.role === 'admin')
        setIsCoach(currentMember.role === 'coach' || currentMember.role === 'admin')
      }

      // Fetch club data
      if (currentClub) {
        setClubForm({
          name: currentClub.name,
          location: currentClub.location || '',
        })
      }

      // Fetch team data
      if (currentTeam) {
        setTeamForm({
          name: currentTeam.name,
        })

        // Initialize member roles
        const rolesMap: Record<string, 'admin' | 'coach' | 'player'> = {}
        members.forEach(m => {
          rolesMap[m.id] = m.role
        })
        setMemberRoles(rolesMap)
      }

      // Fetch invite codes
      if (currentTeam) {
        const { data: codesData, error: codesError } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('team_id', currentTeam.id)
          .order('created_at', { ascending: false })

        if (codesError) throw codesError
        setInviteCodes(codesData || [])
      }

      // Fetch all teams in the club (for admin team management + player movement)
      if (currentClub) {
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('club_id', currentClub.id)
          .order('name', { ascending: true })

        if (teamsError) throw teamsError
        setAllClubTeams(teamsData || [])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveClub = async () => {
    if (!currentClub) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('clubs')
        .update({
          name: clubForm.name,
          location: clubForm.location || null,
        })
        .eq('id', currentClub.id)

      if (error) throw error
      setSuccess('Club settings saved successfully')
      await fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving club:', err)
      setError(err instanceof Error ? err.message : 'Failed to save club settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTeam = async () => {
    if (!currentTeam) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: teamForm.name,
        })
        .eq('id', currentTeam.id)

      if (error) throw error
      setSuccess('Team settings saved successfully')
      await fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error saving team:', err)
      setError(err instanceof Error ? err.message : 'Failed to save team settings')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!currentTeam) return
    if (deleteConfirmText !== currentTeam.name) {
      setError('Team name does not match')
      return
    }

    setDeletingTeam(true)
    setError(null)
    setSuccess(null)

    try {
      // Delete the team (cascades will handle related data)
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', currentTeam.id)

      if (error) throw error

      setSuccess('Team deleted successfully')
      setTimeout(() => {
        setSuccess(null)
        // Refresh teams list
        refreshTeams()
        // Navigate based on remaining teams
        const remainingTeams = teams.filter(t => t.id !== currentTeam.id)
        if (remainingTeams.length === 0) {
          navigate('/club/setup')
        } else {
          navigate('/')
        }
      }, 1000)
    } catch (err) {
      console.error('Error deleting team:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete team')
      setDeletingTeam(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!currentClub || !user || !newTeamForm.name.trim()) return

    setCreatingTeam(true)
    setError(null)
    setSuccess(null)

    try {
      // Create the team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          club_id: currentClub.id,
          name: newTeamForm.name.trim(),
          sport_type: 'afl',
        })
        .select()
        .single()

      if (teamError) throw teamError

      // Add current user as admin of the new team
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: user.id,
          team_id: teamData.id,
          role: 'admin',
          display_name: user.user_metadata?.full_name || user.email || null,
        })

      if (memberError) throw memberError

      // Generate an invite code for the new team
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const expiresAt = addDays(new Date(), 30).toISOString()

      await supabase.from('invite_codes').insert({
        team_id: teamData.id,
        code,
        created_by: user.id,
        expires_at: expiresAt,
        max_uses: null,
        use_count: 0,
      })

      setSuccess(`Team "${newTeamForm.name}" created successfully!`)
      setNewTeamForm({ name: '' })
      setShowCreateTeam(false)
      await refreshTeams()
      await fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error creating team:', err)
      setError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setCreatingTeam(false)
    }
  }

  const handleSwitchToTeam = (team: Team) => {
    setCurrentTeam(team)
  }

  const handleGenerateInviteCode = async () => {
    if (!currentTeam || !user) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const expiresAt = addDays(new Date(), 30).toISOString()

      const { data, error } = await supabase
        .from('invite_codes')
        .insert({
          team_id: currentTeam.id,
          code,
          created_by: user.id,
          expires_at: expiresAt,
          max_uses: 50,
          use_count: 0,
        })
        .select()

      if (error) throw error
      setInviteCodes([...(data || []), ...inviteCodes])
      setSuccess('Invite code generated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error generating code:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate invite code')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteInviteCode = async (codeId: string) => {
    if (!confirm('Delete this invite code?')) return

    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('invite_codes')
        .delete()
        .eq('id', codeId)

      if (error) throw error
      setInviteCodes(inviteCodes.filter(c => c.id !== codeId))
      setSuccess('Invite code deleted')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting code:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete code')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateMemberRole = async (memberId: string) => {
    const newRole = memberRoles[memberId]
    if (!newRole) return

    const isPlaying = newRole === 'player' ? true : (memberPlayingStatus[memberId] ?? true)

    if (!confirm(`Update member role to ${newRole}${isPlaying && newRole !== 'player' ? ' (playing)' : ''}?`)) return

    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('members')
        .update({ role: newRole, is_playing: isPlaying })
        .eq('id', memberId)

      if (error) throw error
      setEditingMemberId(null)
      setMemberPlayingStatus({})
      setSuccess('Member role updated')
      setTimeout(() => setSuccess(null), 3000)
      await fetchData()
    } catch (err) {
      console.error('Error updating role:', err)
      setError(err instanceof Error ? err.message : 'Failed to update member role')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    // Prevent removing yourself
    if (memberUserId === user?.id) {
      setError('You cannot remove yourself from the team')
      return
    }

    if (!confirm('Remove this member from the team?')) return

    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('members')
        .update({ status: 'inactive' })
        .eq('id', memberId)

      if (error) throw error
      setSuccess('Member removed from team')
      setTimeout(() => setSuccess(null), 3000)
      await fetchData()
    } catch (err) {
      console.error('Error removing member:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setSaving(false)
    }
  }

  const handleAddGuestPlayer = async () => {
    if (!currentTeam || !guestForm.name.trim()) {
      setError('Please enter a player name')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('members')
        .insert({
          team_id: currentTeam.id,
          user_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID for guests
          role: 'player',
          jersey_number: guestForm.jerseyNumber || null,
          status: 'active',
          is_guest: true,
          guest_name: guestForm.name.trim(),
          display_name: guestForm.name.trim(),
        })

      if (error) throw error
      setSuccess(`Guest player "${guestForm.name}" added successfully`)
      setGuestForm({ name: '', jerseyNumber: '' })
      setTimeout(() => setSuccess(null), 3000)
      await fetchData()
    } catch (err) {
      console.error('Error adding guest player:', err)
      setError(err instanceof Error ? err.message : 'Failed to add guest player')
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getInviteLink = (code: string) => {
    return `${window.location.origin}/join/${code}`
  }

  const getRoleBadgeVariant = (role: 'admin' | 'coach' | 'player') => {
    switch (role) {
      case 'admin':
        return 'danger'
      case 'coach':
        return 'warning'
      case 'player':
      default:
        return 'info'
    }
  }

  const getRoleIcon = (role: 'admin' | 'coach' | 'player') => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />
      case 'coach':
        return <Users className="w-4 h-4" />
      case 'player':
      default:
        return <User className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    )
  }

  if (!isCoach) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <Card>
          <div className="text-center py-8 px-4">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2 font-medium">Restricted Access</p>
            <p className="text-sm text-gray-500">Only team coaches and admins can manage settings.</p>
          </div>
        </Card>
      </div>
    )
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const guestPlayers = activeMembers.filter(m => m.is_guest)
  const currentUserMemberId = members.find(m => m.user_id === user?.id)?.id

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-gray-600 mb-6">
        {isAdmin ? 'Admin - Full access' : 'Coach - Limited access'}
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Club Teams - Admin Only */}
      {isAdmin && allClubTeams.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div
            onClick={() =>
              setExpandedSection(expandedSection === 'clubteams' ? '' : 'clubteams')
            }
            className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 font-semibold border-b border-gray-200"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Club Teams ({allClubTeams.length})
            </div>
            <span className="text-gray-400">
              {expandedSection === 'clubteams' ? '−' : '+'}
            </span>
          </div>
          {expandedSection === 'clubteams' && (
            <div className="p-4 space-y-3">
              {allClubTeams.map(team => (
                <div
                  key={team.id}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                    currentTeam?.id === team.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{team.name}</p>
                    {currentTeam?.id === team.id && (
                      <span className="text-xs text-blue-600">Currently viewing</span>
                    )}
                  </div>
                  {currentTeam?.id !== team.id && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSwitchToTeam(team)}
                    >
                      Manage
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              {/* Create New Team */}
              {!showCreateTeam ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateTeam(true)}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Create New Team
                </Button>
              ) : (
                <div className="mt-3 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
                  <Input
                    label="Team Name"
                    placeholder="e.g., Seniors, Reserves, U19s"
                    value={newTeamForm.name}
                    onChange={e => setNewTeamForm({ name: e.target.value })}
                    fullWidth
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCreateTeam}
                      disabled={creatingTeam || !newTeamForm.name.trim()}
                      loading={creatingTeam}
                    >
                      Create Team
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowCreateTeam(false)
                        setNewTeamForm({ name: '' })
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Club Settings - Admin Only */}
      {isAdmin && (
        <Card className="mb-6 overflow-hidden">
          <div
            onClick={() =>
              setExpandedSection(expandedSection === 'club' ? '' : 'club')
            }
            className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 font-semibold border-b border-gray-200"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Club Settings
            </div>
            <span className="text-gray-400">
              {expandedSection === 'club' ? '−' : '+'}
            </span>
          </div>
          {expandedSection === 'club' && (
            <div className="p-4 space-y-4">
              <Input
                label="Club Name"
                value={clubForm.name}
                onChange={e => setClubForm({ ...clubForm, name: e.target.value })}
                fullWidth
              />
              <Input
                label="Location (Optional)"
                placeholder="e.g., Melbourne, VIC"
                value={clubForm.location}
                onChange={e =>
                  setClubForm({ ...clubForm, location: e.target.value })
                }
                fullWidth
              />
              <Button
                variant="primary"
                onClick={handleSaveClub}
                disabled={saving}
                loading={saving}
              >
                Save Club Settings
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Team Settings - Admin Only */}
      {isAdmin && (
        <Card className="mb-6 overflow-hidden">
          <div
            onClick={() =>
              setExpandedSection(expandedSection === 'team' ? '' : 'team')
            }
            className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 font-semibold border-b border-gray-200"
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Team Settings
            </div>
            <span className="text-gray-400">
              {expandedSection === 'team' ? '−' : '+'}
            </span>
          </div>
          {expandedSection === 'team' && (
            <div className="p-4 space-y-4">
              <Input
                label="Team Name"
                value={teamForm.name}
                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                fullWidth
              />
              <Button
                variant="primary"
                onClick={handleSaveTeam}
                disabled={saving}
                loading={saving}
              >
                Save Team Settings
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Member Management */}
      <Card className="mb-6 overflow-hidden">
        <div
          onClick={() =>
            setExpandedSection(expandedSection === 'members' ? '' : 'members')
          }
          className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 font-semibold border-b border-gray-200"
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Member Management ({activeMembers.length})
          </div>
          <span className="text-gray-400">
            {expandedSection === 'members' ? '−' : '+'}
          </span>
        </div>
        {expandedSection === 'members' && (
          <div className="p-4">
            {activeMembers.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500">No members yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeMembers.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getRoleIcon(member.role)}
                        <span className="font-medium text-gray-900">
                          {member.display_name || member.guest_name || 'Unknown'} {member.jersey_number ? `#${member.jersey_number}` : ''}
                        </span>
                        {member.user_id === user?.id && (
                          <Badge variant="info" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Badge>
                        {member.is_playing && (member.role === 'coach' || member.role === 'admin') && (
                          <Badge variant="success">Playing</Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    {editingMemberId === member.id ? (
                      <div className="flex flex-col gap-2 ml-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={memberRoles[member.id] || 'player'}
                            onChange={e =>
                              setMemberRoles({
                                ...memberRoles,
                                [member.id]: e.target.value as
                                  | 'admin'
                                  | 'coach'
                                  | 'player',
                              })
                            }
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="player">Player</option>
                            <option value="coach">Coach</option>
                            <option value="admin">Admin</option>
                          </select>
                          {(memberRoles[member.id] === 'coach' || memberRoles[member.id] === 'admin') && (
                            <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={memberPlayingStatus[member.id] ?? member.is_playing}
                                onChange={e =>
                                  setMemberPlayingStatus({
                                    ...memberPlayingStatus,
                                    [member.id]: e.target.checked,
                                  })
                                }
                                className="rounded border-gray-300"
                              />
                              Playing
                            </label>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpdateMemberRole(member.id)}
                            disabled={saving}
                            loading={saving}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingMemberId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 ml-2">
                        {isAdmin && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingMemberId(member.id)}
                              disabled={saving}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id, member.user_id)}
                              disabled={saving || member.id === currentUserMemberId}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Guest Players - Coach & Admin */}
      <Card className="mb-6 overflow-hidden">
        <div
          onClick={() =>
            setExpandedSection(expandedSection === 'guests' ? '' : 'guests')
          }
          className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 font-semibold border-b border-gray-200"
        >
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Guest Players ({guestPlayers.length})
          </div>
          <span className="text-gray-400">
            {expandedSection === 'guests' ? '−' : '+'}
          </span>
        </div>
        {expandedSection === 'guests' && (
          <div className="p-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                Add players for one-off games who don't have a team account. Guest players can be selected for matches but won't appear in regular team management.
              </p>
            </div>

            <div className="space-y-3">
              <Input
                label="Player Name"
                placeholder="e.g., John Smith"
                value={guestForm.name}
                onChange={e => setGuestForm({ ...guestForm, name: e.target.value })}
                fullWidth
              />
              <Input
                label="Jersey Number (Optional)"
                placeholder="e.g., 23"
                value={guestForm.jerseyNumber}
                onChange={e => setGuestForm({ ...guestForm, jerseyNumber: e.target.value })}
                fullWidth
              />
              <Button
                variant="primary"
                onClick={handleAddGuestPlayer}
                disabled={saving || !guestForm.name.trim()}
                loading={saving}
                fullWidth
              >
                <Plus className="w-4 h-4" />
                Add Guest Player
              </Button>
            </div>

            {guestPlayers.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-sm">No guest players yet</p>
              </div>
            ) : (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-medium text-gray-700 mb-3">Current Guest Players</p>
                <div className="space-y-2">
                  {guestPlayers.map(guest => (
                    <div
                      key={guest.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-gray-900">
                            {guest.guest_name}
                          </span>
                          {guest.jersey_number && (
                            <span className="text-xs text-gray-500">#{guest.jersey_number}</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveMember(guest.id, guest.user_id)}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Invite Management - Admin & Coach */}
      <Card className="mb-6 overflow-hidden">
        <div
          onClick={() =>
            setExpandedSection(expandedSection === 'invites' ? '' : 'invites')
          }
          className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 font-semibold border-b border-gray-200"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Invite Management
          </div>
          <span className="text-gray-400">
            {expandedSection === 'invites' ? '−' : '+'}
          </span>
        </div>
        {expandedSection === 'invites' && (
          <div className="p-4 space-y-4">
            <Button
              variant="primary"
              onClick={handleGenerateInviteCode}
              disabled={saving}
              loading={saving}
              fullWidth
            >
              <Plus className="w-4 h-4" />
              Generate New Invite Link
            </Button>

            <p className="text-xs text-gray-600">
              Anyone with an invite link can join this team as a player. You can promote them to coach or admin in the member list after they join.
            </p>

            {inviteCodes.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-sm">No invite codes yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inviteCodes.map(code => {
                  const isExpired = code.expires_at ? new Date(code.expires_at) < new Date() : false
                  const maxUsesReached = code.max_uses !== null && code.use_count >= code.max_uses
                  const isValid = !isExpired && !maxUsesReached

                  return (
                    <div
                      key={code.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="font-mono font-bold text-sm bg-gray-100 px-2 py-1 rounded">
                              {code.code}
                            </code>
                            {isValid ? (
                              <Badge variant="success">Active</Badge>
                            ) : (
                              <Badge variant="danger">
                                {isExpired ? 'Expired' : 'Limit Reached'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            Uses: {code.use_count}
                            {code.max_uses ? `/${code.max_uses}` : ' (unlimited)'} · Expires:{' '}
                            <span className="font-medium">
                              {code.expires_at ? format(new Date(code.expires_at), 'MMM d, yyyy') : 'Never'}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard(getInviteLink(code.code))
                          }
                          className="ml-2 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Copy invite link"
                        >
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {isValid && (
                        <div className="text-xs font-mono bg-gray-50 p-2 rounded mb-2 break-all">
                          {getInviteLink(code.code)}
                        </div>
                      )}

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteInviteCode(code.id)}
                          disabled={saving}
                          className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" />
                          Delete
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Danger Zone - Admin Only */}
      {isAdmin && (
        <Card className="mb-6 overflow-hidden border-red-200 bg-red-50">
          <div
            onClick={() =>
              setExpandedSection(expandedSection === 'danger' ? '' : 'danger')
            }
            className="p-4 cursor-pointer flex items-center justify-between hover:bg-red-100 font-semibold border-b border-red-200"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-700">Danger Zone</span>
            </div>
            <span className="text-red-400">
              {expandedSection === 'danger' ? '−' : '+'}
            </span>
          </div>
          {expandedSection === 'danger' && (
            <div className="p-4">
              {!showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-700 font-medium">
                    Delete this team permanently. This action cannot be undone.
                  </p>
                  <p className="text-xs text-red-600">
                    All team data, members, rounds, and selections will be deleted.
                  </p>
                  <Button
                    variant="danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingTeam}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Team
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 p-3 bg-white rounded border border-red-200">
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Type the team name to confirm deletion:
                    </p>
                    <p className="text-xs text-gray-600 mb-3">
                      This will permanently delete <strong>{currentTeam?.name}</strong> and all associated data.
                    </p>
                    <Input
                      placeholder={currentTeam?.name || 'Team name'}
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      fullWidth
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="danger"
                      onClick={handleDeleteTeam}
                      disabled={deleteConfirmText !== currentTeam?.name || deletingTeam}
                      loading={deletingTeam}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Team Permanently
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setDeleteConfirmText('')
                      }}
                      disabled={deletingTeam}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
