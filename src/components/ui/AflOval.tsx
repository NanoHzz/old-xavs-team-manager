import { useMemo } from 'react'

interface OvalPlayer {
  name: string
  jerseyNumber?: string | null
  positionName?: string
  isCurrentUser?: boolean
  selectionType?: string
}

interface AflOvalProps {
  players: OvalPlayer[]
  className?: string
}

// Map position categories to approximate zones on the oval
// AFL ground has: Full Back, Back Pocket, Centre Half Back, Half Back Flank,
// Wing, Centre, Half Forward Flank, Centre Half Forward, Forward Pocket, Full Forward, Ruck, Ruck Rover, Rover
const POSITION_ZONES: Record<string, { x: number; y: number }> = {
  // Defence (bottom of oval)
  'Full Back': { x: 50, y: 88 },
  'FB': { x: 50, y: 88 },
  'Back Pocket (L)': { x: 25, y: 82 },
  'BPL': { x: 25, y: 82 },
  'Back Pocket (R)': { x: 75, y: 82 },
  'BPR': { x: 75, y: 82 },
  'Back Pocket': { x: 25, y: 82 },
  'BP': { x: 25, y: 82 },
  'Centre Half Back': { x: 50, y: 72 },
  'CHB': { x: 50, y: 72 },
  'Half Back Flank (L)': { x: 22, y: 68 },
  'HBFL': { x: 22, y: 68 },
  'Half Back Flank (R)': { x: 78, y: 68 },
  'HBFR': { x: 78, y: 68 },
  'Half Back Flank': { x: 22, y: 68 },
  'HBF': { x: 22, y: 68 },

  // Midfield (middle of oval)
  'Wing (L)': { x: 12, y: 50 },
  'WL': { x: 12, y: 50 },
  'Wing (R)': { x: 88, y: 50 },
  'WR': { x: 88, y: 50 },
  'Wing': { x: 12, y: 50 },
  'W': { x: 12, y: 50 },
  'Centre': { x: 50, y: 50 },
  'C': { x: 50, y: 50 },
  'Ruck': { x: 50, y: 45 },
  'R': { x: 50, y: 45 },
  'RK': { x: 50, y: 45 },
  'Ruck Rover': { x: 42, y: 50 },
  'RR': { x: 42, y: 50 },
  'Rover': { x: 58, y: 50 },
  'ROV': { x: 58, y: 50 },

  // Forward (top of oval)
  'Half Forward Flank (L)': { x: 22, y: 32 },
  'HFFL': { x: 22, y: 32 },
  'Half Forward Flank (R)': { x: 78, y: 32 },
  'HFFR': { x: 78, y: 32 },
  'Half Forward Flank': { x: 22, y: 32 },
  'HFF': { x: 22, y: 32 },
  'Centre Half Forward': { x: 50, y: 28 },
  'CHF': { x: 50, y: 28 },
  'Forward Pocket (L)': { x: 25, y: 18 },
  'FPL': { x: 25, y: 18 },
  'Forward Pocket (R)': { x: 75, y: 18 },
  'FPR': { x: 75, y: 18 },
  'Forward Pocket': { x: 25, y: 18 },
  'FP': { x: 25, y: 18 },
  'Full Forward': { x: 50, y: 12 },
  'FF': { x: 50, y: 12 },
}

// Fuzzy match position name to a zone
function getPositionCoords(positionName: string): { x: number; y: number } {
  // Exact match first
  if (POSITION_ZONES[positionName]) return POSITION_ZONES[positionName]

  const lower = positionName.toLowerCase()

  // Fuzzy matching for common patterns
  if (lower.includes('full back')) return { x: 50, y: 88 }
  if (lower.includes('full forward')) return { x: 50, y: 12 }
  if (lower.includes('back pocket')) return { x: 25, y: 82 }
  if (lower.includes('forward pocket')) return { x: 25, y: 18 }
  if (lower.includes('centre half back') || lower.includes('center half back')) return { x: 50, y: 72 }
  if (lower.includes('centre half forward') || lower.includes('center half forward')) return { x: 50, y: 28 }
  if (lower.includes('half back')) return { x: 22, y: 68 }
  if (lower.includes('half forward')) return { x: 22, y: 32 }
  if (lower.includes('wing')) return { x: 12, y: 50 }
  if (lower.includes('ruck rover')) return { x: 42, y: 50 }
  if (lower.includes('rover')) return { x: 58, y: 50 }
  if (lower.includes('ruck')) return { x: 50, y: 45 }
  if (lower.includes('centre') || lower.includes('center')) return { x: 50, y: 50 }
  if (lower.includes('interchange') || lower.includes('bench')) return { x: 50, y: 96 }

  // Default to centre if unknown
  return { x: 50, y: 50 }
}

export function AflOval({ players, className = '' }: AflOvalProps) {
  // Group players by zone and offset duplicates
  const positionedPlayers = useMemo(() => {
    const zoneCount: Record<string, number> = {}

    return players
      .filter(p => p.selectionType === 'on_field')
      .map(player => {
        const pos = player.positionName || 'Unknown'
        const coords = getPositionCoords(pos)
        const key = `${coords.x}-${coords.y}`
        const count = zoneCount[key] || 0
        zoneCount[key] = count + 1

        // Offset duplicates slightly
        const offsetX = count > 0 ? (count % 2 === 0 ? count * 6 : -count * 6) : 0

        return {
          ...player,
          x: Math.min(95, Math.max(5, coords.x + offsetX)),
          y: coords.y,
        }
      })
  }, [players])

  const benchPlayers = players.filter(p => p.selectionType !== 'on_field')

  return (
    <div className={className}>
      {/* The Oval */}
      <div className="relative w-full" style={{ paddingBottom: '140%' }}>
        <svg
          viewBox="0 0 300 420"
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grass background */}
          <rect x="0" y="0" width="300" height="420" rx="0" fill="#2d8a4e" />

          {/* Outer oval boundary */}
          <ellipse cx="150" cy="210" rx="140" ry="195" fill="none" stroke="white" strokeWidth="2" />

          {/* Centre circle */}
          <circle cx="150" cy="210" r="30" fill="none" stroke="white" strokeWidth="1.5" />

          {/* Centre square */}
          <rect x="120" y="180" width="60" height="60" fill="none" stroke="white" strokeWidth="1.5" />

          {/* 50m arcs */}
          <path d="M 50 120 Q 150 160 250 120" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
          <path d="M 50 300 Q 150 260 250 300" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" />

          {/* Goal squares */}
          {/* Forward end */}
          <rect x="125" y="18" width="50" height="25" fill="none" stroke="white" strokeWidth="1.5" />
          {/* Back end */}
          <rect x="125" y="377" width="50" height="25" fill="none" stroke="white" strokeWidth="1.5" />

          {/* Goal posts (small marks) */}
          <line x1="125" y1="15" x2="125" y2="20" stroke="white" strokeWidth="2" />
          <line x1="175" y1="15" x2="175" y2="20" stroke="white" strokeWidth="2" />
          <line x1="125" y1="400" x2="125" y2="405" stroke="white" strokeWidth="2" />
          <line x1="175" y1="400" x2="175" y2="405" stroke="white" strokeWidth="2" />

          {/* Behind posts */}
          <line x1="110" y1="18" x2="110" y2="22" stroke="white" strokeWidth="1.5" />
          <line x1="190" y1="18" x2="190" y2="22" stroke="white" strokeWidth="1.5" />
          <line x1="110" y1="398" x2="110" y2="402" stroke="white" strokeWidth="1.5" />
          <line x1="190" y1="398" x2="190" y2="402" stroke="white" strokeWidth="1.5" />

          {/* Zone labels */}
          <text x="150" y="55" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="bold">FORWARD</text>
          <text x="150" y="215" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="bold">MIDFIELD</text>
          <text x="150" y="375" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="bold">DEFENCE</text>
        </svg>

        {/* Player dots */}
        {positionedPlayers.map((player, i) => (
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
              {player.name.split(' ').pop()}
            </span>
          </div>
        ))}
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
