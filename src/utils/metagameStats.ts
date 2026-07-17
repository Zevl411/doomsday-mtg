import type { CommanderMetagameStats } from '../models/tournament'

export interface MetagameEntryFixture {
  tournamentId: string
  commanderKey: string
  commanderName: string
  colorIdentity: string[]
  wins: number
  losses: number
  draws: number
  standing?: number
}

/** Mirrors the documented SQL formulas for deterministic fixture validation. */
export function calculateMetagameStats(
  entries: MetagameEntryFixture[],
  topFinishThreshold = 16,
): CommanderMetagameStats[] {
  const groups = new Map<string, MetagameEntryFixture[]>()
  for (const entry of entries) {
    groups.set(entry.commanderKey, [
      ...(groups.get(entry.commanderKey) ?? []),
      entry,
    ])
  }

  return [...groups.values()].map((group) => {
    const first = group[0]!
    const wins = sum(group, 'wins')
    const losses = sum(group, 'losses')
    const draws = sum(group, 'draws')
    const games = wins + losses + draws
    const top16Finishes = group.filter(
      (entry) =>
        entry.standing !== undefined &&
        entry.standing <= topFinishThreshold,
    ).length
    return {
      commanderKey: first.commanderKey,
      commanderName: first.commanderName,
      colorIdentity: first.colorIdentity,
      entries: group.length,
      tournaments: new Set(group.map((entry) => entry.tournamentId)).size,
      wins,
      losses,
      draws,
      matchWinRate: games ? wins / games : 0,
      top16Finishes,
      topCutRate: top16Finishes / group.length,
      firstPlaceFinishes: group.filter((entry) => entry.standing === 1).length,
      metaShare: group.length / entries.length,
    }
  })
}

function sum(
  entries: MetagameEntryFixture[],
  field: 'wins' | 'losses' | 'draws',
) {
  return entries.reduce((total, entry) => total + entry[field], 0)
}

