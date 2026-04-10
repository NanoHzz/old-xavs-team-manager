import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { MapPin } from 'lucide-react'
import type { Position } from '../../types'

interface PositionWithCategory extends Position {
  category: string | null
  isSelected?: boolean
  preferenceOrder?: number
}

export default function PreferencesPage() {
  const { currentTeam, currentMember, currentClub } = useTeam()

  const [positions, setPositions] = useState<PositionWithCategory[]>([])
  const [selectedPreferences, setSelectedPreferences] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentTeam || !currentMember || !currentClub) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch all positions for the club
        const { data: positionsData, error: posError } = await supabase
          .from('positions')
          .select('*')
          .eq('team_id', currentTeam.id)
          .order('name')

        if (posError) throw posError

        // Fetch existing preferences
        const { data: prefData } = await supabase
          .from('position_preferences')
          .select('*')
          .eq('member_id', currentMember.id)

        // Build category mapping
        const categoryMap: Record<string, string> = {
          FB: 'Defence',
          HB: 'Defence',
          BP: 'Defence',
          C: 'Midfield',
          HF: 'Forward',
          FF: 'Forward',
          CHB: 'Defence',
          CHF: 'Forward',
          R: 'Ruck',
          RK: 'Ruck',
          Sub: 'Bench',
        }

        // Build preferences map
        const prefMap = new Map<string, number>()
        prefData?.forEach(pref => {
          prefMap.set(pref.position_id, pref.preference_rank ?? 0)
        })
        setSelectedPreferences(prefMap)

        // Enhance positions with category, filter out Bench and Interchange
        const enhancedPositions = (positionsData || [])
          .filter(pos => pos.category !== 'Bench' && !pos.name.startsWith('Interchange'))
          .map(pos => ({
            ...pos,
            category: (pos.abbreviation ? categoryMap[pos.abbreviation] : null) || 'Other',
            isSelected: prefMap.has(pos.id),
            preferenceOrder: prefMap.get(pos.id),
          }))

        setPositions(enhancedPositions)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentTeam, currentMember, currentClub])

  const handlePositionToggle = (positionId: string) => {
    const newPrefs = new Map(selectedPreferences)

    if (newPrefs.has(positionId)) {
      // Deselect
      newPrefs.delete(positionId)
    } else if (newPrefs.size < 3) {
      // Select with next available rank
      const nextRank = newPrefs.size + 1
      newPrefs.set(positionId, nextRank)
    }

    setSelectedPreferences(newPrefs)
    updatePositionsState(newPrefs)
  }

  const updatePositionsState = (prefs: Map<string, number>) => {
    setPositions(positions =>
      positions.map(pos => ({
        ...pos,
        isSelected: prefs.has(pos.id),
        preferenceOrder: prefs.get(pos.id),
      }))
    )
  }

  const handleSave = async () => {
    if (!currentMember) return

    setSaving(true)
    try {
      // Delete existing preferences
      const { error: deleteError } = await supabase
        .from('position_preferences')
        .delete()
        .eq('member_id', currentMember.id)

      if (deleteError) throw deleteError

      // Insert new preferences
      if (selectedPreferences.size > 0) {
        const prefsToInsert = Array.from(selectedPreferences.entries()).map(([posId, order]) => ({
          member_id: currentMember.id,
          position_id: posId,
          preference_rank: order,
        }))

        const { error: insertError } = await supabase
          .from('position_preferences')
          .insert(prefsToInsert)

        if (insertError) throw insertError
      }
    } finally {
      setSaving(false)
    }
  }

  const groupedPositions = positions.reduce(
    (acc, pos) => {
      const category = pos.category || 'Other'
      if (!acc[category]) acc[category] = []
      acc[category].push(pos)
      return acc
    },
    {} as Record<string, PositionWithCategory[]>
  )

  const categoryOrder = ['Defence', 'Midfield', 'Forward', 'Ruck', 'Other']

  if (loading) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Position Preferences</h1>
        <LoadingSpinner />
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Position Preferences</h1>
        <Card>
          <EmptyState
            icon={<MapPin className="w-12 h-12" />}
            title="No positions available"
            description="There are no positions configured for your club."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Position Preferences</h1>
        <p className="text-gray-500 text-sm mt-1">Select up to 3 preferred positions in order</p>
      </div>

      {selectedPreferences.size > 0 && (
        <Card className="bg-blue-50 border border-blue-200">
          <div className="text-sm text-blue-900">
            <p className="font-medium">Selected: {selectedPreferences.size} of 3</p>
            <p className="text-xs mt-1">
              {Array.from(selectedPreferences.entries())
                .sort(([, a], [, b]) => a - b)
                .map(([posId]) => {
                  const pos = positions.find(p => p.id === posId)
                  return pos?.name
                })
                .join(' → ')}
            </p>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {categoryOrder.map(category => {
          const categoryPositions = groupedPositions[category]
          if (!categoryPositions) return null

          return (
            <Card key={category} title={category}>
              <div className="grid grid-cols-2 gap-2">
                {categoryPositions.map(pos => (
                  <button
                    key={pos.id}
                    onClick={() => handlePositionToggle(pos.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      pos.isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{pos.name}</p>
                        <p className="text-xs text-gray-500">{pos.abbreviation}</p>
                      </div>
                      {pos.isSelected && (
                        <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold">
                          {pos.preferenceOrder}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

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
