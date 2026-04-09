import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { GameDayRole, RoleAssignment, Round } from '../../types'
import { format } from 'date-fns'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'

interface RoleWithAssignment extends GameDayRole {
  assignedMemberId?: string | null
  assignedMemberName?: string
}

export default function RolesPage() {
  const { currentTeam, members } = useTeam()
  const [rounds, setRounds] = useState<Round[]>([])
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)
  const [roles, setRoles] = useState<RoleWithAssignment[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [roleAssignments, setRoleAssignments] = useState<
    Record<string, string>
  >({})
  const [expandedRole, setExpandedRole] = useState<string | null>(null)

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

      // Fetch game day roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('game_day_roles')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: true })

      if (rolesError) throw rolesError
      setRoles(rolesData || [])

      // Fetch role assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('role_assignments')
        .select('*')

      if (assignmentsError) throw assignmentsError
      setAssignments(assignmentsData || [])

      // Initialize role assignments map
      const assignmentsMap: Record<string, string> = {}
      ;(assignmentsData || []).forEach(a => {
        if (a.member_id) {
          assignmentsMap[a.role_id] = a.member_id
        }
      })
      setRoleAssignments(assignmentsMap)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRole = async () => {
    if (!currentTeam || !newRoleName.trim()) return

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('game_day_roles')
        .insert({
          team_id: currentTeam.id,
          name: newRoleName,
          description: newRoleDesc || null,
        })
        .select()

      if (error) throw error

      setRoles([...roles, ...(data || [])])
      setNewRoleName('')
      setNewRoleDesc('')
      setShowAddRole(false)
    } catch (err) {
      console.error('Error adding role:', err)
      setError('Failed to add role')
    } finally {
      setSaving(false)
    }
  }

  const handleAssignRole = async (roleId: string, memberId: string | null) => {
    if (!selectedRound) return
    setSaving(true)
    try {
      // Remove existing assignment
      const existing = assignments.find(a => a.role_id === roleId)
      if (existing) {
        const { error } = await supabase
          .from('role_assignments')
          .delete()
          .eq('id', existing.id)
        if (error) throw error
      }

      // Add new assignment if memberId provided
      if (memberId) {
        const { error } = await supabase.from('role_assignments').insert({
          round_id: selectedRound.id,
          role_id: roleId,
          assigned_to: memberId,
          member_id: memberId,
        })
        if (error) throw error
      }

      await fetchData()
    } catch (err) {
      console.error('Error assigning role:', err)
      setError('Failed to assign role')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Delete this role?')) return

    setSaving(true)
    try {
      // Delete assignments first
      const { error: assignError } = await supabase
        .from('role_assignments')
        .delete()
        .eq('role_id', roleId)

      if (assignError) throw assignError

      // Delete role
      const { error } = await supabase
        .from('game_day_roles')
        .delete()
        .eq('id', roleId)

      if (error) throw error

      await fetchData()
    } catch (err) {
      console.error('Error deleting role:', err)
      setError('Failed to delete role')
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

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Game Day Roles</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Round Selector */}
      {rounds.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Round (for role assignments)
          </label>
          <div className="relative inline-block w-full max-w-xs">
            <select
              value={selectedRound?.id || ''}
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
        </div>
      )}

      {/* Roles List */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Game Day Roles</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddRole(!showAddRole)}
          >
            <Plus className="w-4 h-4" />
            Add Role
          </Button>
        </div>

        {showAddRole && (
          <Card className="mb-4">
            <div className="p-4 space-y-4">
              <Input
                label="Role Name"
                placeholder="e.g., Captain, Vice Captain"
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
              />
              <Input
                label="Description (optional)"
                placeholder="Brief description of the role"
                value={newRoleDesc}
                onChange={e => setNewRoleDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddRole}
                  disabled={saving || !newRoleName.trim()}
                  loading={saving}
                >
                  Create Role
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowAddRole(false)
                    setNewRoleName('')
                    setNewRoleDesc('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {roles.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-gray-500">
              <p>No roles defined yet</p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setShowAddRole(true)}
              >
                <Plus className="w-4 h-4" />
                Create First Role
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {roles.map(role => {
              const assignedMemberId = roleAssignments[role.id]
              const assignedMember = assignedMemberId
                ? members.find(m => m.id === assignedMemberId)
                : null

              return (
                <Card key={role.id} className="overflow-hidden">
                  <div
                    onClick={() =>
                      setExpandedRole(
                        expandedRole === role.id ? null : role.id
                      )
                    }
                    className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{role.name}</h3>
                      {role.description && (
                        <p className="text-sm text-gray-500">{role.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {assignedMember ? (
                        <span className="text-sm font-medium text-blue-600">
                          {assignedMember.display_name || assignedMember.guest_name || 'Unknown'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">Unassigned</span>
                      )}
                    </div>
                  </div>

                  {expandedRole === role.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Assign to:
                        </label>
                        <select
                          value={roleAssignments[role.id] || ''}
                          onChange={e =>
                            handleAssignRole(role.id, e.target.value || null)
                          }
                          disabled={saving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">-- Unassigned --</option>
                          {members.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.display_name || m.guest_name || 'Unknown'}
                              {m.jersey_number && ` #${m.jersey_number}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2 justify-end pt-4 border-t border-gray-300">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                          disabled={saving}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Role
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      {roles.length > 0 && (
        <Card title="Role Summary" className="mt-8">
          <div className="space-y-2">
            {roles.map(role => {
              const assignedMemberId = roleAssignments[role.id]
              const assignedMember = assignedMemberId
                ? members.find(m => m.id === assignedMemberId)
                : null

              return (
                <div key={role.id} className="flex justify-between py-2">
                  <span className="font-medium">{role.name}</span>
                  <span className="text-gray-600">
                    {assignedMember
                      ? assignedMember.display_name || assignedMember.guest_name || 'Unknown'
                      : 'Unassigned'}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
