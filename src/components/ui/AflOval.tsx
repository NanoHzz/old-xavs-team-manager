import { useMemo } from 'react'

interface OvalPlayer {
  name: string
  jerseyNumber?: string | null
  positionName?: string
  primaryPosition?: string | null
  isCurrentUser?: boolean
  selectionType?: string
}

interface AflOvalProps {
  players: OvalPlayer[]
  className?: string
  compact?: boolean
}

// Map position names to zones on the oval
// Layout: Defence at top, Forward at bottom
const POSITION_ZONES: Record<string, { x: number; y: number }> = {
  // Defence (top)
  'Full Back': { x: 50, y: 12 },
  'FB': { x: 50, y: 12 },
  'Back Pocket (L)': { x: 25, y: 18 },
  'BPL': { x: 25, y: 18 },
  'Back Pocket (R)': { x: 75, y: 18 },
  'BPR': { x: 75, y: 18 },
  'Back Pocket': { x: 25, y: 18 },
  'BP': { x: 25, y: 18 },
  'Centre Half Back': { x: 50, y: 28 },
  'CHB': { x: 50, y: 28 },
  'Half Back Flank (L)': { x: 22, y: 32 },
  'HBFL': { x: 22, y: 32 },
  'Half Back Flank (R)': { x: 78, y: 32 },
  'HBFR': { x: 78, y: 32 },
  'Half Back Flank': { x: 22, y: 32 },
  'HBF': { x: 22, y: 32 },

  // Midfield (middle)
  'Wing (L)': { x: 12, y: 50 },
  'WL': { x: 12, y: 50 },
  'Wing (R)': { x: 88, y: 50 },
  'WR': { x: 88, y: 50 },
  'Wing': { x: 12, y: 50 },
  'W': { x: 12, y: 50 },
  'Centre': { x: 50, y: 50 },
  'C': { x: 50, y: 50 },
  'Ruck': { x: 50, y: 55 },
  'R': { x: 50, y: 55 },
  'RK': { x: 50, y: 55 },
  'Ruck Rover': { x: 42, y: 50 },
  'RR': { x: 42, y: 50 },
  'Rover': { x: 58, y: 50 },
  'ROV': { x: 58, y: 50 },

  // Forward (bottom)
  'Half Forward Flank (L)': { x: 22, y: 68 },
  'HFFL': { x: 22, y: 68 },
  'Half Forward Flank (R)': { x: 78, y: 68 },
  'HFFR': { x: 78, y: 68 },
  'Half Forward Flank': { x: 22, y: 68 },
  'HFF': { x: 22, y: 68 },
  'Centre Half Forward': { x: 50, y: 72 },
  'CHF': { x: 50, y: 72 },
  'Forward Pocket (L)': { x: 25, y: 82 },
  'FPL': { x: 25, y: 82 },
  'Forward Pocket (R)': { x: 75, y: 82 },
  'FPR': { x: 75, y: 82 },
  'Forward Pocket': { x: 25, y: 82 },
  'FP': { x: 25, y: 82 },
  'Full Forward': { x: 50, y: 88 },
  'FF': { x: 50, y: 88 },
}

// Map member primary_position enum values to oval zones (fallback)
const PRIMARY_POSITION_ZONES: Record<string, { x: number; y: number }> = {
  'back_key': { x: 50, y: 12 },
  'back_general': { x: 35, y: 22 },
  'back_pocket': { x: 25, y: 18 },
  'full_back': { x: 50, y: 12 },
  'centre_half_back': { x: 50, y: 28 },
  'half_back_flank': { x: 22, y: 32 },
  'mid_general': { x: 50, y: 50 },
  'mid_centre': { x: 50, y: 50 },
  'mid_wing': { x: 12, y: 50 },
  'ruck': { x: 50, y: 55 },
  'ruck_rover': { x: 42, y: 50 },
  'rover': { x: 58, y: 50 },
  'fwd_general': { x: 35, y: 78 },
  'forward_key': { x: 50, y: 88 },
  'forward_small': { x: 25, y: 82 },
  'forward_pocket': { x: 25, y: 82 },
  'full_forward': { x: 50, y: 88 },
  'centre_half_forward': { x: 50, y: 72 },
  'half_forward_flank': { x: 22, y: 68 },
}

// Positions that come in pairs — left and right coordinates
const PAIRED_POSITIONS: Record<string, { left: { x: number; y: number }; right: { x: number; y: number } }> = {
  'Back Pocket':        { left: { x: 25, y: 18 }, right: { x: 75, y: 18 } },
  'Half Back Flank':    { left: { x: 22, y: 32 }, right: { x: 78, y: 32 } },
  'Wing':               { left: { x: 12, y: 50 }, right: { x: 88, y: 50 } },
  'Half Forward Flank': { left: { x: 22, y: 68 }, right: { x: 78, y: 68 } },
  'Forward Pocket':     { left: { x: 25, y: 82 }, right: { x: 75, y: 82 } },
}

// Match position name to a zone, tracking instance count for paired positions
function getPositionCoords(
  positionName: string | undefined,
  primaryPosition: string | null | undefined,
  positionInstanceCount: Record<string, number>,
): { x: number; y: number } {
  // Check paired positions first (these share the same name in the DB)
  if (positionName && PAIRED_POSITIONS[positionName]) {
    const count = positionInstanceCount[positionName] || 0
    positionInstanceCount[positionName] = count + 1
    return count === 0 ? PAIRED_POSITIONS[positionName].left : PAIRED_POSITIONS[positionName].right
  }

  // Try exact match on position name
  if (positionName && POSITION_ZONES[positionName]) return POSITION_ZONES[positionName]

  // Fuzzy match on position name
  if (positionName) {
    const lower = positionName.toLowerCase()
    if (lower.includes('full back')) return { x: 50, y: 12 }
    if (lower.includes('full forward')) return { x: 50, y: 88 }
    if (lower.includes('back pocket')) return { x: 25, y: 18 }
    if (lower.includes('forward pocket')) return { x: 25, y: 82 }
    if (lower.includes('centre half back') || lower.includes('center half back')) return { x: 50, y: 28 }
    if (lower.includes('centre half forward') || lower.includes('center half forward')) return { x: 50, y: 72 }
    if (lower.includes('half back')) return { x: 22, y: 32 }
    if (lower.includes('half forward')) return { x: 22, y: 68 }
    if (lower.includes('wing')) return { x: 12, y: 50 }
    if (lower.includes('ruck rover')) return { x: 42, y: 50 }
    if (lower.includes('rover')) return { x: 58, y: 50 }
    if (lower.includes('ruck')) return { x: 50, y: 55 }
    if (lower.includes('centre') || lower.includes('center')) return { x: 50, y: 50 }
    if (lower.includes('interchange') || lower.includes('bench')) return { x: 50, y: 96 }
  }

  // Fallback to member's primary_position enum value
  if (primaryPosition && PRIMARY_POSITION_ZONES[primaryPosition]) {
    return PRIMARY_POSITION_ZONES[primaryPosition]
  }

  // Default to centre if nothing matches
  return { x: 50, y: 50 }
}

export function AflOval({ players, className = '', compact = false }: AflOvalProps) {
  const positionedPlayers = useMemo(() => {
    const positionInstanceCount: Record<string, number> = {}
    const zoneCount: Record<string, number> = {}

    return players
      .filter(p => p.selectionType === 'on_field')
      .map(player => {
        const coords = getPositionCoords(player.positionName, player.primaryPosition, positionInstanceCount)
        // For non-paired positions that end up at the same exact spot, offset slightly
        const key = `${coords.x}-${coords.y}`
        const count = zoneCount[key] || 0
        zoneCount[key] = count + 1

        const offsetX = count > 0 ? (count % 2 === 0 ? count * 6 : -count * 6) : 0

        return {
          ...player,
          x: Math.min(95, Math.max(5, coords.x + offsetX)),
          y: coords.y,
        }
      })
  }, [players])

  const benchPlayers = players.filter(p => p.selectionType !== 'on_field')

  const paddingBottom = compact ? '75%' : '115%'

  return (
    <div className={className}>
      {/* The Oval */}
      <div className="relative w-full" style={{ paddingBottom }}>
        <svg
          viewBox="0 0 300 345"
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grass background */}
          <rect x="0" y="0" width="300" height="345" rx="8" fill="#2d8a4e" />

          {/* Outer oval boundary */}
          <ellipse cx="150" cy="172" rx="140" ry="162" fill="none" stroke="white" strokeWidth="2" />

          {/* Centre circle */}
          <circle cx="150" cy="172" r="25" fill="none" stroke="white" strokeWidth="1.5" />

          {/* Centre square */}
          <rect x="125" y="147" width="50" height="50" fill="none" stroke="white" strokeWidth="1.5" />

          {/* 50m arcs */}
          <path d="M 55 95 Q 150 125 245 95" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
          <path d="M 55 250 Q 150 220 245 250" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" />

          {/* Goal squares */}
          {/* Defence end (top) */}
          <rect x="125" y="12" width="50" height="22" fill="none" stroke="white" strokeWidth="1.5" />
          {/* Forward end (bottom) */}
          <rect x="125" y="311" width="50" height="22" fill="none" stroke="white" strokeWidth="1.5" />

          {/* Goal posts */}
          <line x1="125" y1="9" x2="125" y2="14" stroke="white" strokeWidth="2" />
          <line x1="175" y1="9" x2="175" y2="14" stroke="white" strokeWidth="2" />
          <line x1="125" y1="331" x2="125" y2="336" stroke="white" strokeWidth="2" />
          <line x1="175" y1="331" x2="175" y2="336" stroke="white" strokeWidth="2" />

          {/* Behind posts */}
          <line x1="110" y1="12" x2="110" y2="16" stroke="white" strokeWidth="1.5" />
          <line x1="190" y1="12" x2="190" y2="16" stroke="white" strokeWidth="1.5" />
          <line x1="110" y1="329" x2="110" y2="333" stroke="white" strokeWidth="1.5" />
          <line x1="190" y1="329" x2="190" y2="333" stroke="white" strokeWidth="1.5" />

          {!compact && (
            <>
              {/* Zone labels */}
              <text x="150" y="52" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="bold">DEFENCE</text>
              <text x="150" y="176" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="bold">MIDFIELD</text>
              <text x="150" y="305" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="bold">FORWARD</text>
            </>
          )}
        </svg>

        {/* Player labels */}
        {positionedPlayers.map((player, i) => {
          // Format as "F.Surname"
          const parts = player.name.split(' ')
          const shortName = parts.length > 1
            ? `${parts[0].charAt(0)}.${parts[parts.length - 1]}`
            : player.name

          return compact ? (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${player.x}%`,
                top: `${player.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span
                className={`whitespace-nowrap text-[8px] font-semibold px-1.5 py-0.5 rounded shadow ${
                  player.isCurrentUser
                    ? 'bg-yellow-400 text-gray-900'
                    : 'bg-white text-gray-900'
                }`}
              >
                {shortName}
              </span>
            </div>
          ) : (
            <div
              key={i}
              className="absolute flex flex-col items-center"
              style={{
                left: `${player.x}%`,
                top: `${player.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2 ${
                  player.isCurrentUser
                    ? 'bg-yellow-400 border-yellow-200 text-gray-900'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              >
                {player.jerseyNumber ? `#${player.jerseyNumber}` : player.name.charAt(0)}
              </div>
              <span className="text-white text-[9px] font-medium mt-0.5 bg-black bg-opacity-50 px-1 rounded whitespace-nowrap max-w-[60px] truncate">
                {shortName}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bench */}
      {benchPlayers.length > 0 && (
        <div className="mt-3 p-3 bg-gray-100 rounded-lg">
          <p className="text-xs font-semibold text-gray-600 mb-2">INTERCHANGE</p>
          <div className="flex flex-wrap gap-2">
            {benchPlayers.map((player, i) => (
              <div
                key={i}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  player.isCurrentUser
                    ? 'bg-yellow-100 border border-yellow-400 text-yellow-800'
                    : 'bg-white border border-gray-300 text-gray-700'
                }`}
              >
                {player.jerseyNumber && <span className="font-bold mr-1">#{player.jerseyNumber}</span>}
                {player.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
