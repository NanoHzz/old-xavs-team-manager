import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTeam } from '../../contexts/TeamContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { Season, Round } from '../../types'
import { format, addDays, parse, isBefore } from 'date-fns'
import { localDateTimeToISO, isoToLocalDateTime, formatDateTime } from '../../lib/utils'
import { ChevronDown, ChevronUp, Plus, Trash2, Edit2, X } from 'lucide-react'

interface RoundWithStatus extends Round {
  isEditing?: boolean
}

interface GeneratedRound {
  round_number: number
  date_time: string
  opposition: string | null
  venue: string | null
  is_bye: boolean
}

export default function RoundsPage() {
  const { currentTeam } = useTeam()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [rounds, setRounds] = useState<RoundWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateSeason, setShowCreateSeason] = useState(false)
  const [showAddRound, setShowAddRound] = useState(false)
  const [showGenerateRounds, setShowGenerateRounds] = useState(false)
  const [expandedRound, setExpandedRound] = useState<string | null>(null)

  // Form states
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  })

  const [roundForm, setRoundForm] = useState({
    roundNumber: '',
    opposition: '',
    venue: '',
    matchDate: '',
    matchTime: '',
  })

  const [generateForm, setGenerateForm] = useState({
    startDate: '',
    endDate: '',
    dayOfWeek: '6', // 0=Sun, 6=Sat
    defaultTime: '14:00',
    startRoundNumber: 1,
  })

  const [generatedRounds, setGeneratedRounds] = useState<GeneratedRound[]>([])

  const [editingRound, setEditingRound] = useState<RoundWithStatus | null>(null)
  const [_editingByeRound, _setEditingByeRound] = useState<string | null>(null)

  // Generate rounds based on form
  const handleGenerateRounds = () => {
    if (!generateForm.startDate || !generateForm.endDate) {
      setError('Please select both start and end dates')
      return
    }

    try {
      const startDate = parse(generateForm.startDate, 'yyyy-MM-dd', new Date())
      const endDate = parse(generateForm.endDate, 'yyyy-MM-dd', new Date())
      const targetDayOfWeek = parseInt(generateForm.dayOfWeek)

      const rounds: GeneratedRound[] = []
      let currentDate = new Date(startDate)
      let roundNum = generateForm.startRoundNumber

      // Find the first occurrence of the target day of week
      while (currentDate.getDay() !== targetDayOfWeek) {
        currentDate = addDays(currentDate, 1)
      }

      // Generate rounds for each occurrence of the target day
      while (isBefore(currentDate, addDays(endDate, 1))) {
        const dateTimeStr = format(currentDate, 'yyyy-MM-dd') + `T${generateForm.defaultTime}:00`
        rounds.push({
          round_number: roundNum,
          date_time: dateTimeStr,
          opposition: null,
          venue: null,
          is_bye: false,
        })
        roundNum++
        currentDate = addDays(currentDate, 7)
      }

      setGeneratedRounds(rounds)
      setError(null)
    } catch (err) {
      console.error('Error generating rounds:', err)
      setError('Failed to generate rounds')
    }
  }

  // Save all generated rounds to database
  const handleSaveGeneratedRounds = async () => {
    if (!currentTeam || !activeSeason || generatedRounds.length === 0) return

    setSaving(true)
    try {
      const newRounds = generatedRounds.map(r => ({
        season_id: activeSeason.id,
        round_number: r.round_number,
        date_time: localDateTimeToISO(r.date_time),
        opposition: r.opposition,
        venue: r.venue,
        is_bye: r.is_bye,
      }))

      const { data, error } = await supabase
        .from('rounds')
        .insert(newRounds)
        .select()

      if (error) throw error

      setRounds([...rounds, ...(data || [])])
      setGeneratedRounds([])
      setGenerateForm({
        startDate: '',
        endDate: '',
        dayOfWeek: '6',
        defaultTime: '14:00',
        startRoundNumber: 1,
      })
      setShowGenerateRounds(false)
    } catch (err) {
      console.error('Error saving rounds:', err)
      setError('Failed to save rounds')
    } finally {
      setSaving(false)
    }
  }

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
      // Fetch seasons for this team
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('start_date', { ascending: false })

      if (seasonsError) throw seasonsError
      setSeasons(seasonsData || [])

      // Set active season (most recent active, or first)
      const active = seasonsData?.find(s => s.is_active) || seasonsData?.[0]
      if (active) {
        setActiveSeason(active)
      }

      // Fetch rounds for active season
      const seasonId = active?.id
      if (seasonId) {
        const { data: roundsData, error: roundsError } = await supabase
          .from('rounds')
          .select('*')
          .eq('season_id', seasonId)
          .order('round_number', { ascending: true })

        if (roundsError) throw roundsError
        setRounds(roundsData || [])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load seasons and rounds')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSeason = async () => {
    if (!currentTeam || !seasonForm.name || !seasonForm.startDate || !seasonForm.endDate) return

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('seasons')
        .insert({
          team_id: currentTeam.id,
          name: seasonForm.name,
          start_date: seasonForm.startDate,
          end_date: seasonForm.endDate,
          is_active: true,
        })
        .select()

      if (error) throw error

      setSeasons([...(data || []), ...seasons])
      if (data && data.length > 0) {
        setActiveSeason(data[0])
      }
      setSeasonForm({ name: '', startDate: '', endDate: '' })
      setShowCreateSeason(false)
      setRounds([]) // New season has no rounds
    } catch (err) {
      console.error('Error creating season:', err)
      setError('Failed to create season')
    } finally {
      setSaving(false)
    }
  }

  const handleAddRound = async () => {
    if (!currentTeam || !activeSeason || !roundForm.roundNumber || !roundForm.matchDate) return

    setSaving(true)
    try {
      const naiveDateTime = `${roundForm.matchDate}${roundForm.matchTime ? `T${roundForm.matchTime}` : 'T00:00:00'}`

      const { data, error } = await supabase
        .from('rounds')
        .insert({
          season_id: activeSeason.id,
          round_number: parseInt(roundForm.roundNumber),
          date_time: localDateTimeToISO(naiveDateTime),
          opposition: roundForm.opposition || null,
          venue: roundForm.venue || null,
        })
        .select()

      if (error) throw error

      setRounds([...rounds, ...(data || [])])
      setRoundForm({ roundNumber: '', opposition: '', venue: '', matchDate: '', matchTime: '' })
      setShowAddRound(false)
    } catch (err) {
      console.error('Error adding round:', err)
      setError('Failed to add round')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateRound = async (round: RoundWithStatus) => {
    if (!editingRound) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('rounds')
        .update({
          round_number: editingRound.round_number,
          opposition: editingRound.opposition,
          venue: editingRound.venue,
          date_time: editingRound.date_time ? localDateTimeToISO(editingRound.date_time) : null,
          is_bye: editingRound.is_bye || false,
        })
        .eq('id', round.id)

      if (error) throw error

      setRounds(
        rounds.map(r => (r.id === round.id ? { ...editingRound, isEditing: false } : r))
      )
      setEditingRound(null)
    } catch (err) {
      console.error('Error updating round:', err)
      setError('Failed to update round')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRound = async (roundId: string) => {
    if (!confirm('Delete this round?')) return

    setSaving(true)
    try {
      const { error } = await supabase.from('rounds').delete().eq('id', roundId)

      if (error) throw error

      setRounds(rounds.filter(r => r.id !== roundId))
    } catch (err) {
      console.error('Error deleting round:', err)
      setError('Failed to delete round')
    } finally {
      setSaving(false)
    }
  }

  // Switch active season
  const handleSeasonChange = async (season: Season) => {
    setActiveSeason(season)
    setLoading(true)
    try {
      const { data: roundsData, error: roundsError } = await supabase
        .from('rounds')
        .select('*')
        .eq('season_id', season.id)
        .order('round_number', { ascending: true })

      if (roundsError) throw roundsError
      setRounds(roundsData || [])
    } catch (err) {
      console.error('Error fetching rounds:', err)
      setError('Failed to load rounds')
    } finally {
      setLoading(false)
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
      <h1 className="text-2xl font-bold mb-4">Rounds & Seasons</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Season Management */}
      <Card title="Current Season" className="mb-6">
        {activeSeason ? (
          <div className="space-y-2">
            <p className="font-semibold">{activeSeason.name}</p>
            <p className="text-sm text-gray-600">
              {format(new Date(activeSeason.start_date), 'MMM d, yyyy')} -{' '}
              {format(new Date(activeSeason.end_date), 'MMM d, yyyy')}
            </p>
            {/* Season switcher if multiple */}
            {seasons.length > 1 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {seasons.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSeasonChange(s)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      s.id === activeSeason.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">No active season</p>
        )}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCreateSeason(!showCreateSeason)}
          >
            <Plus className="w-4 h-4" />
            Create New Season
          </Button>
        </div>
      </Card>

      {/* Create Season Form */}
      {showCreateSeason && (
        <Card className="mb-6">
          <div className="p-4 space-y-4">
            <Input
              label="Season Name"
              placeholder="e.g., 2026 AFL Season"
              value={seasonForm.name}
              onChange={e => setSeasonForm({ ...seasonForm, name: e.target.value })}
            />
            <Input
              label="Start Date"
              type="date"
              value={seasonForm.startDate}
              onChange={e => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={seasonForm.endDate}
              onChange={e => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateSeason}
                disabled={saving || !seasonForm.name}
                loading={saving}
              >
                Create Season
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateSeason(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Rounds Management */}
      {activeSeason && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Rounds</h2>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowGenerateRounds(!showGenerateRounds)}
              >
                <Plus className="w-4 h-4" />
                Generate Rounds
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddRound(!showAddRound)}
              >
                <Plus className="w-4 h-4" />
                Add Round
              </Button>
            </div>
          </div>

          {/* Add Single Round Form */}
          {showAddRound && (
            <Card>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Round Number"
                    type="number"
                    placeholder="1"
                    value={roundForm.roundNumber}
                    onChange={e =>
                      setRoundForm({ ...roundForm, roundNumber: e.target.value })
                    }
                  />
                  <Input
                    label="Opposition"
                    placeholder="e.g., Richmond Tigers"
                    value={roundForm.opposition}
                    onChange={e =>
                      setRoundForm({ ...roundForm, opposition: e.target.value })
                    }
                  />
                  <Input
                    label="Venue"
                    placeholder="e.g., MCG"
                    value={roundForm.venue}
                    onChange={e =>
                      setRoundForm({ ...roundForm, venue: e.target.value })
                    }
                  />
                  <div />
                  <Input
                    label="Match Date"
                    type="date"
                    value={roundForm.matchDate}
                    onChange={e =>
                      setRoundForm({ ...roundForm, matchDate: e.target.value })
                    }
                  />
                  <Input
                    label="Match Time"
                    type="time"
                    value={roundForm.matchTime}
                    onChange={e =>
                      setRoundForm({ ...roundForm, matchTime: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddRound}
                    disabled={saving || !roundForm.roundNumber || !roundForm.matchDate}
                    loading={saving}
                  >
                    Add Round
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddRound(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Generate Rounds Form */}
          {showGenerateRounds && (
            <Card>
              <div className="p-4 space-y-4">
                {generatedRounds.length === 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Start Date"
                        type="date"
                        value={generateForm.startDate}
                        onChange={e =>
                          setGenerateForm({ ...generateForm, startDate: e.target.value })
                        }
                      />
                      <Input
                        label="End Date"
                        type="date"
                        value={generateForm.endDate}
                        onChange={e =>
                          setGenerateForm({ ...generateForm, endDate: e.target.value })
                        }
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day of Week
                        </label>
                        <select
                          value={generateForm.dayOfWeek}
                          onChange={e =>
                            setGenerateForm({ ...generateForm, dayOfWeek: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </select>
                      </div>
                      <Input
                        label="Default Time"
                        type="time"
                        value={generateForm.defaultTime}
                        onChange={e =>
                          setGenerateForm({ ...generateForm, defaultTime: e.target.value })
                        }
                      />
                      <Input
                        label="Start Round Number"
                        type="number"
                        value={generateForm.startRoundNumber}
                        onChange={e =>
                          setGenerateForm({
                            ...generateForm,
                            startRoundNumber: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleGenerateRounds}
                        disabled={!generateForm.startDate || !generateForm.endDate}
                      >
                        Preview Rounds
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowGenerateRounds(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Generated {generatedRounds.length} rounds - edit as needed, then save
                      </p>
                    </div>

                    {generatedRounds.map((round, idx) => (
                      <div
                        key={idx}
                        className="p-3 border border-gray-200 rounded-lg space-y-3"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-sm">
                            Round {round.round_number}
                          </span>
                          <button
                            onClick={() =>
                              setGeneratedRounds(
                                generatedRounds.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Opposition"
                            value={round.opposition || ''}
                            onChange={e => {
                              const newRounds = [...generatedRounds]
                              newRounds[idx].opposition = e.target.value || null
                              setGeneratedRounds(newRounds)
                            }}
                          />
                          <Input
                            placeholder="Venue"
                            value={round.venue || ''}
                            onChange={e => {
                              const newRounds = [...generatedRounds]
                              newRounds[idx].venue = e.target.value || null
                              setGeneratedRounds(newRounds)
                            }}
                          />
                          <Input
                            placeholder="Date & Time"
                            type="datetime-local"
                            value={round.date_time ? isoToLocalDateTime(round.date_time) : ''}
                            onChange={e => {
                              const newRounds = [...generatedRounds]
                              newRounds[idx].date_time = e.target.value
                              setGeneratedRounds(newRounds)
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`bye-${idx}`}
                              checked={round.is_bye}
                              onChange={e => {
                                const newRounds = [...generatedRounds]
                                newRounds[idx].is_bye = e.target.checked
                                setGeneratedRounds(newRounds)
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label
                              htmlFor={`bye-${idx}`}
                              className="text-sm font-medium text-gray-700"
                            >
                              BYE Round
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveGeneratedRounds}
                        disabled={saving}
                        loading={saving}
                      >
                        Save All Rounds
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setGeneratedRounds([])
                          setGenerateForm({
                            startDate: '',
                            endDate: '',
                            dayOfWeek: '6',
                            defaultTime: '14:00',
                            startRoundNumber: 1,
                          })
                        }}
                      >
                        Clear & Edit Form
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowGenerateRounds(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Rounds List */}
          <div className="space-y-3">
            {rounds.length === 0 ? (
              <Card>
                <div className="text-center py-8 text-gray-500">
                  No rounds added yet
                </div>
              </Card>
            ) : (
              rounds
                .sort((a, b) => a.round_number - b.round_number)
                .map(round => (
                  <Card key={round.id} className="overflow-hidden">
                    <div
                      onClick={() =>
                        setExpandedRound(
                          expandedRound === round.id ? null : round.id
                        )
                      }
                      className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">
                          Round {round.round_number}
                          {round.is_bye && (
                            <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              BYE
                            </span>
                          )}
                        </h3>
                        {round.opposition && (
                          <p className="text-sm text-gray-600">vs {round.opposition}</p>
                        )}
                        {round.date_time && (
                          <p className="text-sm text-gray-500">
                            {formatDateTime(round.date_time)}
                          </p>
                        )}
                        {round.venue && (
                          <p className="text-xs text-gray-400">{round.venue}</p>
                        )}
                      </div>
                      {expandedRound === round.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>

                    {expandedRound === round.id && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                        {editingRound?.id === round.id ? (
                          <div className="space-y-3">
                            <Input
                              label="Round Number"
                              type="number"
                              value={editingRound.round_number}
                              onChange={e =>
                                setEditingRound({
                                  ...editingRound,
                                  round_number: parseInt(e.target.value),
                                })
                              }
                            />
                            <Input
                              label="Opposition"
                              value={editingRound.opposition || ''}
                              onChange={e =>
                                setEditingRound({
                                  ...editingRound,
                                  opposition: e.target.value || null,
                                })
                              }
                            />
                            <Input
                              label="Venue"
                              value={editingRound.venue || ''}
                              onChange={e =>
                                setEditingRound({
                                  ...editingRound,
                                  venue: e.target.value || null,
                                })
                              }
                            />
                            <Input
                              label="Date & Time"
                              type="datetime-local"
                              value={editingRound.date_time ? isoToLocalDateTime(editingRound.date_time) : ''}
                              onChange={e =>
                                setEditingRound({
                                  ...editingRound,
                                  date_time: e.target.value || null,
                                })
                              }
                            />
                            <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                              <input
                                type="checkbox"
                                id={`edit-bye-${round.id}`}
                                checked={editingRound.is_bye || false}
                                onChange={e =>
                                  setEditingRound({
                                    ...editingRound,
                                    is_bye: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label
                                htmlFor={`edit-bye-${round.id}`}
                                className="text-sm font-medium text-gray-700"
                              >
                                This is a BYE round
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUpdateRound(round)}
                                disabled={saving}
                                loading={saving}
                              >
                                Save
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingRound(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {round.opposition && (
                              <div>
                                <p className="text-sm font-medium text-gray-600">
                                  Opposition
                                </p>
                                <p>{round.opposition}</p>
                              </div>
                            )}
                            {round.venue && (
                              <div>
                                <p className="text-sm font-medium text-gray-600">Venue</p>
                                <p>{round.venue}</p>
                              </div>
                            )}
                            {round.date_time && (
                              <div>
                                <p className="text-sm font-medium text-gray-600">Date & Time</p>
                                <p>{formatDateTime(round.date_time)}</p>
                              </div>
                            )}
                            <div className="flex gap-2 pt-4 border-t border-gray-300">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingRound(round)}
                                disabled={saving}
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteRound(round.id)}
                                disabled={saving}
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
