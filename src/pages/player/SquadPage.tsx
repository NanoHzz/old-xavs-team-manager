import { useTeam } from '../../contexts/TeamContext'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Users, Shield, User } from 'lucide-react'
import type { Member } from '../../types'

// Position mapping from DB values to display labels
const positionMap: Record<string, string> = {
  back_key: 'Back (Key)',
  back_general: 'Back (General)',
  mid_centre: 'Mid (Centre)',
  mid_wing: 'Mid (Wing)',
  ruck: 'Ruck',
  forward_key: 'Forward (Key)',
  forward_small: 'Forward (Small)',
}

function getPositionLabel(position: string | null): string | null {
  if (!position) return null
  return positionMap[position] || position
}

function getRoleBadgeVariant(role: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (role) {
    case 'admin':
      return 'danger'
    case 'coach':
      return 'info'
    case 'player':
      return 'default'
    default:
      return 'default'
  }
}

function getRoleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function SquadPage() {
  const { members, currentTeam, loading } = useTeam()

  // Filter active members and sort by role (admins/coaches first, then players)
  const activeMembers = members.filter(m => m.status === 'active')

  const coachesAndAdmins = activeMembers.filter(m => m.role === 'admin' || m.role === 'coach')
  const players = activeMembers.filter(m => m.role === 'player')

  const sortedMembers = [...coachesAndAdmins, ...players]

  const getMemberName = (member: Member): string => {
    return member.display_name || member.guest_name || 'Unknown'
  }

  if (loading) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Squad</h1>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Squad</h1>
        {currentTeam && (
          <p className="text-gray-500 text-sm mt-1">{currentTeam.name}</p>
        )}
      </div>

      {/* Member Count */}
      <div className="text-sm text-gray-600">
        Total Members: <span className="font-semibold text-gray-900">{activeMembers.length}</span>
      </div>

      {/* Members List */}
      {activeMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-12 h-12" />}
          title="No team members"
          description="There are no active members in your team yet."
        />
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-200">
            {sortedMembers.map((member) => (
              <div key={member.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Name and Jersey Number */}
                    <div className="flex items-baseline gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {getMemberName(member)}
                      </h3>
                      {member.jersey_number && (
                        <span className="text-sm text-gray-600 whitespace-nowrap">
                          #{member.jersey_number}
                        </span>
                      )}
                    </div>

                    {/* Role Badge and Guest Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {getRoleLabel(member.role)}
                      </Badge>
                      {member.is_guest && (
                        <Badge variant="warning">Guest</Badge>
                      )}
                    </div>

                    {/* Primary Position */}
                    {member.primary_position && (
                      <div className="text-sm">
                        <p className="text-gray-600">Position</p>
                        <p className="text-gray-900">
                          {getPositionLabel(member.primary_position)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Icon based on role */}
                  <div className="flex-shrink-0 text-gray-400">
                    {(member.role === 'admin' || member.role === 'coach') ? (
                      <Shield size={24} />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
