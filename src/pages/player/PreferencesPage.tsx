import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { X } from 'lucide-react'

/** Simplified AFL position groups */
const POSITION_GROUPS = [
  { key: 'key_back',       label: 'Key Back' },
  { key: 'back_pocket',    label: 'Back Pocket' },
  { key: 'half_back',      label: 'Half Back' },
  { key: 'ruck',           label: 'Ruck' },
  { key: 'middle',         label: 'Middle',         hint: 'Centre / Ruck Rover / Rover' },
  { key: 'wing',           label: 'Wing' },
  { key: 'half_forward',   label: 'Half Forward' },
  { key: 'forward_pocket', label: 'Forward Pocket' },
  { key: 'key_forward',    label: 'Key Forward' },
] as const

type PositionKey = (typeof POSITION_GROUPS)[number]['key']

const MAX_PREFERENCES = 4

/** Map legacy DB values to new position keys */
const LEGACY_MAP: Record<string, PositionKey> = {
  back_general: 'back_pocket',
  back_key: 'key_back',
  mid_centre: 'middle',
  mid_wing: 'wing',
  forward_general: 'forward_pocket',
  forward_small: 'forward_pocket',
  forward_key: 'key_forward',
}

/** Normalise a stored value to a valid position key (handles legacy values) */
function toPositionKey(val: string | null): PositionKey | null {
  if (!val) return null
  // Direct match
  if (POSITION_GROUPS.some(g => g.key === val)) return val as PositionKey
  // Legacy fallback
  return LEGACY_MAP[val] ?? null
}

function labelForKey(key: PositionKey): string {
  return POSITION_GROUPS.find(g => g.key === key)?.label ?? key
}

export default function PreferencesPage() {
  const { currentMember } = useTeam()

  const [selected, setSelected] = useState<PositionKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load existing preferences from DB (not just context, which may be stale)
  useEffect(() => {
    if (!currentMember) {
      setLoading(false)
      return
    }

    const loadPreferences = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('members')
          .select('primary_position, secondary_position, third_position')
          .eq('id', currentMember.id)
          .single()

        if (data) {
          const existing: PositionKey[] = []
          const raw = [data.primary_position, data.secondary_position, data.third_position]
          for (const val of raw) {
            const key = toPositionKey(val)
            if (key && !existing.includes(key)) existing.push(key)
          }
          setSelected(existing)
        }
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [currentMember])

  const handleToggle = (key: PositionKey) => {
    setSelected(prev => {
      const idx = prev.indexOf(key)
      if (idx >= 0) {
        return prev.filter(k => k !== key)
      }
      if (prev.length >= MAX_PREFERENCES) return prev
      return [...prev, key]
    })
    setSaved(false)
  }

  const handleClear = () => {
    setSelected([])
    setSaved(false)
  }

  const handleSave = async () => {
    if (!currentMember) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('members')
        .update({
          primary_position: selected[0] || null,
          secondary_position: selected[1] || null,
          third_position: selected[2] || null,
        })
        .eq('id', currentMember.id)

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Position Preferences</h1>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Position Preferences</h1>
        <p className="text-gray-500 text-sm mt-1">
          Tap to select up to {MAX_PREFERENCES} preferred positions in order of priority
        </p>
      </div>

      {/* Current selections summary */}
      {selected.length > 0 && (
        <Card className="bg-blue-50 border border-blue-200">
          <div className="flex items-start justify-between">
            <div className="text-sm text-blue-900">
              <p className="font-medium">Your preferences ({selected.length}/{MAX_PREFERENCES})</p>
              <div className="mt-2 space-y-1">
                {selected.map((key, i) => (
                  <p key={key} className="text-xs">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-600 text-white rounded-full text-xs font-bold mr-2">
                      {i + 1}
                    </span>
                    {labelForKey(key)}
                  </p>
                ))}
              </div>
            </div>
            <button
              onClick={handleClear}
              className="p-1 text-blue-400 hover:text-blue-700 transition-colors"
              title="Clear all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Position buttons */}
      <div className="space-y-2">
        {POSITION_GROUPS.map(group => {
          const rank = selected.indexOf(group.key)
          const isSelected = rank >= 0
          const isFull = selected.length >= MAX_PREFERENCES && !isSelected

          return (
            <button
              key={group.key}
              onClick={() => handleToggle(group.key)}
              disabled={isFull}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : isFull
                    ? 'border-gray-100 bg-gray-50 opacity-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{group.label}</p>
                  {'hint' in group && group.hint && (
                    <p className="text-xs text-gray-500">{group.hint}</p>
                  )}
                </div>
                {isSelected && (
                  <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold">
                    {rank + 1}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {saved && (
        <p className="text-sm text-green-600 text-center font-medium">Preferences saved!</p>
      )}

      <div className="space-y-2">
        <Button
          onClick={handleSave}
          loading={saving}
          fullWidth
          variant="primary"
        >
          Save Preferences
        </Button>

        {selected.length > 0 && (
          <Button
            onClick={async () => {
              handleClear()
              if (!currentMember) return
              setSaving(true)
              try {
                await supabase
                  .from('members')
                  .update({
                    primary_position: null,
                    secondary_position: null,
                    third_position: null,
                  })
                  .eq('id', currentMember.id)
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
              } finally {
                setSaving(false)
              }
            }}
            fullWidth
            variant="secondary"
          >
            Clear All Preferences
          </Button>
        )}
      </div>
    </div>
  )
}
