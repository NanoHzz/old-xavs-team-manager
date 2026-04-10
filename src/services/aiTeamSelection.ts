/**
 * AI Team Selection Algorithm
 *
 * Generates an optimal team selection based on:
 * - Player overall ratings (overall, fitness, form)
 * - Position preferences (primary, secondary, third) cross-referenced with position category
 * - Availability status (available > maybe)
 * - Fairness / rotation (games played in recent rounds)
 * - Opposition strength rating (1-5 stars)
 *
 * Modes:
 *   opposition_rating >= 4 → STRONGEST (pick best team)
 *   opposition_rating <= 2 → ROTATION (prioritise fairness)
 *   else                   → BALANCED (mix of both)
 */

import type { Member, Position } from '../types'

// ── Types ──────────────────────────────────────────────────────────────

export interface PlayerSelectionData {
  member: Member
  availability: 'available' | 'maybe'
  overallRating: number   // 1-10
  fitnessRating: number   // 1-10
  formRating: number      // 1-10
  recentGamesPlayed: number // games in last N rounds
  totalGamesPlayed: number
}

export interface SelectionResult {
  memberId: string
  positionId: string
  selectionType: 'on_field' | 'bench'
  score: number
}

type SelectionMode = 'STRONGEST' | 'ROTATION' | 'BALANCED'

// ── Position mapping ────────────────────────────────────────────────────

type PositionGroup = 'Backs' | 'Midfield' | 'Forward' | 'Ruck'

/** Map DB position categories to group */
function positionCategoryToGroup(posCategory: string): PositionGroup | null {
  switch (posCategory) {
    case 'Defence': return 'Backs'
    case 'Midfield': return 'Midfield'
    case 'Forward': return 'Forward'
    case 'Ruck': return 'Ruck'
    default: return null // Bench positions
  }
}

/** Map member primary_position value to group */
function memberPositionToGroup(pos: string | null): PositionGroup | null {
  if (!pos) return null
  switch (pos) {
    case 'key_back':
    case 'back_pocket':
    case 'half_back':
    case 'back_general':   // legacy
      return 'Backs'
    case 'middle':
    case 'wing':
    case 'mid_centre':     // legacy
    case 'mid_wing':       // legacy
      return 'Midfield'
    case 'half_forward':
    case 'forward_pocket':
    case 'key_forward':
    case 'forward_general': // legacy
    case 'forward_small':   // legacy
      return 'Forward'
    case 'ruck':
      return 'Ruck'
    default:
      return null
  }
}

// ── Scoring ─────────────────────────────────────────────────────────────

function getSelectionMode(oppositionRating: number | null): SelectionMode {
  if (!oppositionRating) return 'BALANCED'
  if (oppositionRating >= 4) return 'STRONGEST'
  if (oppositionRating <= 2) return 'ROTATION'
  return 'BALANCED'
}

/**
 * Compute a composite strength score for a player.
 * Uses overall rating, fitness, form, availability, and fairness.
 * Position fit is handled separately via preference scoring.
 */
function computeStrengthScore(
  player: PlayerSelectionData,
  mode: SelectionMode,
  maxRecentGames: number
): number {
  const overall = player.overallRating / 10
  const fitness = player.fitnessRating / 10
  const form = player.formRating / 10

  // Availability bonus
  const availBonus = player.availability === 'available' ? 1.0 : 0.7

  // Fairness factor: 0 = hasn't played recently, 1 = played every recent game
  const playRate = maxRecentGames > 0
    ? player.recentGamesPlayed / maxRecentGames
    : 0.5

  // In rotation mode, players who've played LESS get a boost
  // In strongest mode, recent play (form/match fitness) is slightly positive
  let fairnessComponent: number
  if (mode === 'ROTATION') {
    fairnessComponent = 1 - playRate
  } else if (mode === 'STRONGEST') {
    fairnessComponent = 0.5 + (playRate * 0.2)
  } else {
    fairnessComponent = 0.7 - (playRate * 0.3)
  }

  // Weighted composite - adjust weights based on mode
  let score: number
  if (mode === 'STRONGEST') {
    score = (
      0.40 * overall +
      0.20 * fitness +
      0.20 * form +
      0.05 * availBonus +
      0.15 * fairnessComponent
    )
  } else if (mode === 'ROTATION') {
    score = (
      0.20 * overall +
      0.10 * fitness +
      0.10 * form +
      0.10 * availBonus +
      0.50 * fairnessComponent
    )
  } else {
    // BALANCED
    score = (
      0.30 * overall +
      0.15 * fitness +
      0.15 * form +
      0.08 * availBonus +
      0.32 * fairnessComponent
    )
  }

  return score
}

// ── Position preference matching ────────────────────────────────────────

function getPositionPreferenceScore(
  player: PlayerSelectionData,
  position: Position
): number {
  const posGroup = positionCategoryToGroup(position.category || '')

  // Check if player's primary/secondary/third position maps to this group
  const primaryGroup = memberPositionToGroup(player.member.primary_position)
  const secondaryGroup = memberPositionToGroup(player.member.secondary_position)
  const thirdGroup = memberPositionToGroup(player.member.third_position)

  if (primaryGroup && posGroup && primaryGroup === posGroup) return 1.0
  if (secondaryGroup && posGroup && secondaryGroup === posGroup) return 0.7
  if (thirdGroup && posGroup && thirdGroup === posGroup) return 0.4
  return 0.1 // no preference match but can still play
}

// ── Main algorithm ──────────────────────────────────────────────────────

export function generateTeamSelection(
  players: PlayerSelectionData[],
  positions: Position[],
  oppositionRating: number | null,
  lockedPositions: Map<string, string> // positionId -> memberId (coach-locked)
): SelectionResult[] {
  const mode = getSelectionMode(oppositionRating)

  // Separate on-field positions from bench
  const fieldPositions = positions
    .filter(p => p.category !== 'Bench')
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  const benchPositions = positions
    .filter(p => p.category === 'Bench')
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  // Max recent games for fairness normalisation
  const maxRecentGames = Math.max(1, ...players.map(p => p.recentGamesPlayed))

  const results: SelectionResult[] = []
  const assignedMembers = new Set<string>()
  const assignedPositionIds = new Set<string>()

  // Step 1: Honour locked positions
  for (const [posId, memberId] of lockedPositions) {
    const player = players.find(p => p.member.id === memberId)
    const position = positions.find(p => p.id === posId)
    if (player && position) {
      results.push({
        memberId,
        positionId: posId,
        selectionType: position.category === 'Bench' ? 'bench' : 'on_field',
        score: computeStrengthScore(player, mode, maxRecentGames),
      })
      assignedMembers.add(memberId)
      assignedPositionIds.add(posId)
    }
  }

  // Step 2: Fill on-field positions
  for (const position of fieldPositions) {
    if (assignedPositionIds.has(position.id)) continue

    // Score all unassigned players for this position
    const candidates = players
      .filter(p => !assignedMembers.has(p.member.id))
      .map(p => {
        const strengthScore = computeStrengthScore(p, mode, maxRecentGames)
        const prefScore = getPositionPreferenceScore(p, position)
        // Combined: strength matters most, preferred position is a strong factor
        const combinedScore = strengthScore * 0.6 + prefScore * 0.4
        return { player: p, score: combinedScore }
      })
      .sort((a, b) => b.score - a.score)

    if (candidates.length > 0) {
      const best = candidates[0]
      results.push({
        memberId: best.player.member.id,
        positionId: position.id,
        selectionType: 'on_field',
        score: best.score,
      })
      assignedMembers.add(best.player.member.id)
      assignedPositionIds.add(position.id)
    }
  }

  // Step 3: Fill bench positions
  const remainingPlayers = players
    .filter(p => !assignedMembers.has(p.member.id))
    .map(p => ({
      player: p,
      score: computeStrengthScore(p, mode, maxRecentGames),
    }))
    .sort((a, b) => b.score - a.score)

  for (const benchPos of benchPositions) {
    if (assignedPositionIds.has(benchPos.id)) continue

    const nextPlayer = remainingPlayers.shift()
    if (nextPlayer) {
      results.push({
        memberId: nextPlayer.player.member.id,
        positionId: benchPos.id,
        selectionType: 'bench',
        score: nextPlayer.score,
      })
      assignedMembers.add(nextPlayer.player.member.id)
      assignedPositionIds.add(benchPos.id)
    }
  }

  return results
}

export { getSelectionMode }
export type { SelectionMode }
