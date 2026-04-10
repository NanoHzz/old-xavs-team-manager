/**
 * AI Team Selection Algorithm
 *
 * Generates an optimal team selection based on:
 * - Player position category ratings (Backs, Midfield, Forward, Ruck)
 * - Player overall ratings (overall, fitness, form)
 * - Position preferences (primary, secondary, third)
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

export interface CategoryRatings {
  Backs: number
  Midfield: number
  Forward: number
  Ruck: number
}

export interface PlayerSelectionData {
  member: Member
  availability: 'available' | 'maybe'
  overallRating: number   // 1-10
  fitnessRating: number   // 1-10
  formRating: number      // 1-10
  categoryRatings: CategoryRatings
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

// ── Category mapping ────────────────────────────────────────────────────

/** Map DB position categories to rating categories */
function positionCategoryToRatingCategory(posCategory: string): keyof CategoryRatings | null {
  switch (posCategory) {
    case 'Defence': return 'Backs'
    case 'Midfield': return 'Midfield'
    case 'Forward': return 'Forward'
    case 'Ruck': return 'Ruck'
    default: return null // Bench positions
  }
}

/** Map member primary_position enum to rating category */
function memberPositionToCategory(pos: string | null): keyof CategoryRatings | null {
  if (!pos) return null
  if (pos.startsWith('back')) return 'Backs'
  if (pos.startsWith('mid')) return 'Midfield'
  if (pos.startsWith('forward')) return 'Forward'
  if (pos === 'ruck') return 'Ruck'
  return null
}

// ── Scoring ─────────────────────────────────────────────────────────────

function getSelectionMode(oppositionRating: number | null): SelectionMode {
  if (!oppositionRating) return 'BALANCED'
  if (oppositionRating >= 4) return 'STRONGEST'
  if (oppositionRating <= 2) return 'ROTATION'
  return 'BALANCED'
}

/**
 * Compute a composite strength score for a player at a given position.
 */
function computeStrengthScore(
  player: PlayerSelectionData,
  posCategory: keyof CategoryRatings | null,
  mode: SelectionMode,
  maxRecentGames: number
): number {
  const overall = player.overallRating / 10
  const fitness = player.fitnessRating / 10
  const form = player.formRating / 10

  // Position-specific skill
  const posSkill = posCategory
    ? (player.categoryRatings[posCategory] || 5) / 10
    : (player.overallRating / 10)

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
    fairnessComponent = 1 - playRate  // lower play rate = higher score
  } else if (mode === 'STRONGEST') {
    fairnessComponent = 0.5 + (playRate * 0.2) // slight boost for match-fit players
  } else {
    fairnessComponent = 0.7 - (playRate * 0.3) // mild rotation bias
  }

  // Weighted composite - adjust weights based on mode
  let score: number
  if (mode === 'STRONGEST') {
    score = (
      0.30 * overall +
      0.25 * posSkill +
      0.15 * fitness +
      0.15 * form +
      0.05 * availBonus +
      0.10 * fairnessComponent
    )
  } else if (mode === 'ROTATION') {
    score = (
      0.15 * overall +
      0.15 * posSkill +
      0.10 * fitness +
      0.10 * form +
      0.10 * availBonus +
      0.40 * fairnessComponent
    )
  } else {
    // BALANCED
    score = (
      0.25 * overall +
      0.20 * posSkill +
      0.12 * fitness +
      0.12 * form +
      0.06 * availBonus +
      0.25 * fairnessComponent
    )
  }

  return score
}

// ── Position preference matching ────────────────────────────────────────

function getPositionPreferenceScore(
  player: PlayerSelectionData,
  position: Position
): number {
  const posCategory = position.category
  const ratingCat = positionCategoryToRatingCategory(posCategory || '')

  // Check if player's primary/secondary/third position maps to this category
  const primaryCat = memberPositionToCategory(player.member.primary_position)
  const secondaryCat = memberPositionToCategory(player.member.secondary_position)
  const thirdCat = memberPositionToCategory(player.member.third_position)

  if (primaryCat && ratingCat && primaryCat === ratingCat) return 1.0
  if (secondaryCat && ratingCat && secondaryCat === ratingCat) return 0.7
  if (thirdCat && ratingCat && thirdCat === ratingCat) return 0.4
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
      const ratingCat = positionCategoryToRatingCategory(position.category || '')
      results.push({
        memberId,
        positionId: posId,
        selectionType: position.category === 'Bench' ? 'bench' : 'on_field',
        score: computeStrengthScore(player, ratingCat, mode, maxRecentGames),
      })
      assignedMembers.add(memberId)
      assignedPositionIds.add(posId)
    }
  }

  // Step 2: Fill on-field positions
  for (const position of fieldPositions) {
    if (assignedPositionIds.has(position.id)) continue

    const ratingCat = positionCategoryToRatingCategory(position.category || '')

    // Score all unassigned players for this position
    const candidates = players
      .filter(p => !assignedMembers.has(p.member.id))
      .map(p => {
        const strengthScore = computeStrengthScore(p, ratingCat, mode, maxRecentGames)
        const prefScore = getPositionPreferenceScore(p, position)
        // Combined: strength matters most, preference is a tiebreaker
        const combinedScore = strengthScore * 0.7 + prefScore * 0.3
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
      score: computeStrengthScore(p, null, mode, maxRecentGames),
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
