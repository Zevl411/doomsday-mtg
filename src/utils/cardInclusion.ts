import type {
  CommanderCardInclusion,
  NormalizedTournamentDeckCard,
} from '../models/tournament'

export type InclusionTier = 'Core' | 'Common' | 'Flexible' | 'Rare'

export function getInclusionTier(rate: number): InclusionTier {
  if (rate >= 0.8) return 'Core'
  if (rate >= 0.5) return 'Common'
  if (rate >= 0.2) return 'Flexible'
  return 'Rare'
}

export function compareDeckToAggregate(
  cards: NormalizedTournamentDeckCard[],
  aggregate: CommanderCardInclusion[],
) {
  const deckKeys = new Set(
    cards.filter((card) => card.board === 'mainboard')
      .map((card) => card.normalizedCardKey),
  )
  const aggregateKeys = new Set(aggregate.map((card) => card.normalizedCardKey))
  const shared = [...deckKeys].filter((key) => aggregateKeys.has(key)).length
  const union = new Set([...deckKeys, ...aggregateKeys]).size
  return {
    sharedCardCount: shared,
    similarity: union ? shared / union : 0,
    missingCoreCards: aggregate.filter((card) =>
      getInclusionTier(card.inclusionRate) === 'Core' &&
      !deckKeys.has(card.normalizedCardKey)
    ),
    rareCards: cards.filter((card) =>
      card.board === 'mainboard' &&
      getInclusionTier(
        aggregate.find((item) =>
          item.normalizedCardKey === card.normalizedCardKey
        )?.inclusionRate ?? 0,
      ) === 'Rare'
    ),
  }
}
