import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Calendar,
  Users,
  ClipboardList,
  Settings,
  CalendarDays,
  Star,
  Sliders,
  User,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { useTeam } from '../../contexts/TeamContext'

interface Tab {
  path: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

export function BottomNav() {
  const { currentMember } = useTeam()
  const location = useLocation()
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const isCoach = currentMember?.role === 'coach' || currentMember?.role === 'admin'

  // Close the More menu on route change or outside click
  useEffect(() => {
    setShowMore(false)
  }, [location.pathname])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false)
      }
    }
    if (showMore) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMore])

  // All available tabs based on role
  const playerTabs: Tab[] = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/squad', label: 'Squad', icon: Users },
    { path: '/availability', label: 'Availability', icon: Calendar },
    { path: '/team-sheet', label: 'Team Sheet', icon: ClipboardList },
    { path: '/preferences', label: 'Preferences', icon: Sliders },
    { path: '/profile', label: 'Profile', icon: User },
  ]

  const coachTabs: Tab[] = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/squad', label: 'Squad', icon: Users },
    { path: '/availability', label: 'Availability', icon: Calendar },
    { path: '/rounds', label: 'Rounds', icon: CalendarDays },
    { path: '/selection', label: 'Selection', icon: Users },
    { path: '/team-sheet', label: 'Team Sheet', icon: ClipboardList },
    { path: '/ratings', label: 'Ratings', icon: Star },
    { path: '/preferences', label: 'Preferences', icon: Sliders },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/profile', label: 'Profile', icon: User },
  ]

  const allTabs = isCoach ? coachTabs : playerTabs

  // For mobile: show first 4 tabs in the bar, rest in "More" menu
  const MAX_VISIBLE = 4
  const needsMore = allTabs.length > MAX_VISIBLE + 1

  const visibleTabs = needsMore ? allTabs.slice(0, MAX_VISIBLE) : allTabs
  const overflowTabs = needsMore ? allTabs.slice(MAX_VISIBLE) : []

  // Check if any overflow tab is active
  const overflowActive = overflowTabs.some(
    t => t.path === '/' ? location.pathname === '/' : location.pathname.startsWith(t.path)
  )

  const baseStyles =
    'flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-medium rounded-lg transition-colors min-w-0 flex-1'
  const activeStyles = 'bg-blue-100 text-blue-600'
  const inactiveStyles = 'text-gray-500 hover:bg-gray-100'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
      {/* Overflow menu */}
      {showMore && overflowTabs.length > 0 && (
        <div ref={moreRef} className="absolute bottom-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg rounded-t-xl">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">More</span>
              <button
                onClick={() => setShowMore(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {overflowTabs.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${
                      isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon size={22} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-2 py-1.5 flex justify-around">
        {visibleTabs.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `${baseStyles} ${isActive ? activeStyles : inactiveStyles}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}

        {needsMore && (
          <button
            onClick={() => setShowMore(!showMore)}
            className={`${baseStyles} ${overflowActive || showMore ? activeStyles : inactiveStyles}`}
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
        )}
      </div>
    </nav>
  )
}
