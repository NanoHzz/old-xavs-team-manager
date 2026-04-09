import { Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTeam } from '../../contexts/TeamContext'
import { BottomNav } from './BottomNav'
import { getInitials } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { Shield, Users, User } from 'lucide-react'

export function AppLayout() {
  const { user } = useAuth()
  const { currentTeam, currentMember } = useTeam()

  const getRoleBadgeInfo = () => {
    const role = currentMember?.role
    const isPlaying = currentMember?.is_playing ?? true
    switch (role) {
      case 'admin':
        return { icon: Shield, variant: 'danger', label: isPlaying ? 'Admin · Coach · Player' : 'Admin · Coach' }
      case 'coach':
        return { icon: Users, variant: 'warning', label: isPlaying ? 'Player-Coach' : 'Coach' }
      case 'player':
      default:
        return { icon: User, variant: 'info', label: 'Player' }
    }
  }

  const roleInfo = getRoleBadgeInfo()
  const RoleIcon = roleInfo.icon

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Team Manager</h1>
            {currentTeam && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">{currentTeam.name}</p>
                {currentMember && (
                  <Badge variant={roleInfo.variant as any}>
                    <RoleIcon className="w-3 h-3 inline mr-1" />
                    {roleInfo.label}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                {getInitials(user.user_metadata?.full_name || user.email || '')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto pb-24">
          <Outlet />
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
