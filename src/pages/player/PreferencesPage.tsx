import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

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

export default function PreferencesPage() {
  const { currentMember } = useTeam()

  const [selected, setSelected] = useState<PositionKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load existing preferences from members table
  useEffect(() => {
    if (!currentMember) {
      setLoading(false)
      return
    }

    const existing: PositionKey[] = []
    if (currentMember.primary_position) existing.push(currentMember.primary_position as PositionKey)
    if (currentMember.secondary_position) existing.push(currentMember.secondary_position as PositionKey)
    if (currentMember.third_position) existing.push(currentMember.third_position as PositionKey)
    // fourth_position doesn't exist on member yet — we'll add it on save
    setSelected(existing)
    setLoading(false)
  }, [currentMember])

  const handleToggle = (key: PositionKey) => {
    setSelected(prev => {
      const idx = prev.indexOf(key)
      if (idx >= 0) {
        // Deselect — remove and re-rank
        return prev.filter(k => k !== key)
      }
      if (prev.length >= MAX_PREFERENCES) return prev
      return [...prev, key]
    })
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
      setTimeout(() => setSaved(false), 2000)
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
          Select up to {MAX_PREFERENCES} preferred positions in order
        </p>
      </div>

      {selected.length > 0 && (
        <Card className="bg-blue-50 border border-blue-200">
          <div className="text-sm text-blue-900">
            <p className="font-medium">Selected: {selected.length} of {MAX_PREFERENCES}</p>
            <p className="text-xs mt-1">
              {selected
                .map(key => POSITION_GROUPS.find(g => g.key === key)?.label)
                .join(' → ')}
            </p>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {POSITION_GROUPS.map(group => {
          const rank = selected.indexOf(group.key)
          const isSelected = rank >= 0

          return (
            <button
              key={group.key}
              onClick={() => handleToggle(group.key)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
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
        <p className="text-sm text-green-600 text-center">Preferences saved!</p>
      )}

      <Button
        onClick={handleSave}
        loading={saving}
        fullWidth
        variant="primary"
      >
        Save Preferences
      </Button>
    </div>
  )
}
