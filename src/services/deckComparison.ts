import type { Deck } from '../models/deck'
import type {
  DeckComparisonCard,
  DeckComparisonCategory,
  DeckComparisonFilters,
  DeckComparisonSampleStatus,
  DeckComparisonSummary,
} from '../models/deckComparison'
import type {
  CommanderCardInclusion,
  NormalizedTournamentDeckCard,
} from '../models/tournament'
import type { ScryfallCard } from '../types/card'
import { normalizeCommanderIdentity } from '../utils/commanderIdentity'
import { getInclusionTier } from '../utils/cardInclusion'

export const MINIMUM_AGGREGATE_INCLUSION = 0.2

/**
 * Oracle identity is preferred across user, aggregate, and tournament models.
 * The canonical-name fallback keeps older unresolved rows comparable without
 * ever falling back to printing-specific Scryfall IDs.
 */
export function getAnalyticalCardIdentity(input: {
  oracleId?: string | null
  normalizedCardKey?: string
  cardName: string
}): string {
  return input.oracleId
    ? `oracle:${input.oracleId.toLowerCase()}`
    : `name:${normalizeAnalyticalName(
      input.normalizedCardKey || input.cardName,
    )}`
}

export function getUserMainboardCards(deck: Deck) {
  const cards = new Map<string, {
    card: ScryfallCard
    identityKey: string
    quantity: number
  }>()
  for (const entry of deck.cards) {
    const identityKey = getAnalyticalCardIdentity({
      oracleId: entry.card.oracle_id,
      cardName: entry.card.name,
    })
    const existing = cards.get(identityKey)
    if (existing) existing.quantity += entry.quantity
    else cards.set(identityKey, { card: entry.card, identityKey, quantity: entry.quantity })
  }
  return cards
}

/** Central board rule used when a normalized Deck is compared outside SQL. */
export function getTournamentMainboardIdentityKeys(
  cards: NormalizedTournamentDeckCard[],
): string[] {
  return [...new Set(
    cards
      .filter((card) => card.board === 'mainboard')
      .map((card) => getAnalyticalCardIdentity({
        oracleId: card.oracleId,
        normalizedCardKey: card.normalizedCardKey,
        cardName: card.cardName,
      })),
  )]
}

export function getComparisonCommander(deck: Deck) {
  const names = [deck.commander?.name, deck.partnerCommander?.name]
    .filter((name): name is string => Boolean(name))
  const identity = normalizeCommanderIdentity(names.join(' // '))
  return { key: identity.key, name: identity.displayName }
}

export function getSampleStatus(
  count: number,
): DeckComparisonSampleStatus {
  if (count >= 20) return 'sufficient'
  if (count >= 5) return 'limited'
  if (count >= 1) return 'insufficient'
  return 'unavailable'
}

/**
 * Aggregate overlap is presence-only: shared cards at or above the 20%
 * inclusion threshold divided by all cards meeting that same threshold. It is
 * descriptive sample overlap, never a Deck quality or power score.
 */
export function buildDeckComparisonSummary(
  deck: Deck,
  inclusionRows: CommanderCardInclusion[],
  filters: DeckComparisonFilters,
): DeckComparisonSummary {
  const userCards = getUserMainboardCards(deck)
  const comparisonCards: DeckComparisonCard[] = []
  const aggregateIdentityKeys = new Set<string>()

  for (const row of inclusionRows) {
    const identityKey = getAnalyticalCardIdentity({
      oracleId: row.oracleId,
      normalizedCardKey: row.normalizedCardKey,
      cardName: row.cardName,
    })
    const userCard = userCards.get(identityKey)
    if (row.inclusionRate >= MINIMUM_AGGREGATE_INCLUSION) {
      aggregateIdentityKeys.add(identityKey)
    }
    // Rare cards absent from the user Deck are outside the aggregate set and
    // add noise without describing either shared or user-specific choices.
    if (!userCard && row.inclusionRate < MINIMUM_AGGREGATE_INCLUSION) continue
    comparisonCards.push({
      ...row,
      identityKey,
      userQuantity: userCard?.quantity ?? 0,
      isInUserDeck: Boolean(userCard),
      category: getComparisonCategory(row.inclusionRate, Boolean(userCard)),
    })
  }

  const represented = new Set(comparisonCards.map((card) => card.identityKey))
  let unresolvedUserCardCount = 0
  for (const userCard of userCards.values()) {
    if (represented.has(userCard.identityKey)) continue
    const unresolved = !userCard.card.oracle_id
    if (unresolved) unresolvedUserCardCount += 1
    comparisonCards.push({
      normalizedCardKey: normalizeAnalyticalName(userCard.card.name),
      oracleId: userCard.card.oracle_id,
      cardName: userCard.card.name,
      typeLine: userCard.card.type_line,
      colorIdentity: userCard.card.color_identity,
      deckCount: 0,
      totalEligibleDecks: inclusionRows[0]?.totalEligibleDecks ?? 0,
      inclusionRate: 0,
      averageQuantity: 0,
      top16DeckCount: 0,
      top16InclusionRate: 0,
      firstPlaceDeckCount: 0,
      firstPlaceInclusionRate: 0,
      identityKey: userCard.identityKey,
      userQuantity: userCard.quantity,
      isInUserDeck: true,
      category: unresolved ? 'unresolved' : 'user-uncommon',
    })
  }

  comparisonCards.sort(compareComparisonCards)
  const sharedCardCount = [...aggregateIdentityKeys]
    .filter((key) => userCards.has(key)).length
  const aggregateUniqueCards = aggregateIdentityKeys.size
  const commander = getComparisonCommander(deck)
  const totalEligibleDecks = inclusionRows[0]?.totalEligibleDecks ?? 0

  return {
    userDeckId: deck.id,
    userDeckName: deck.name,
    commanderKey: commander.key,
    commanderName: commander.name,
    totalEligibleDecks,
    userMainboardUniqueCards: userCards.size,
    aggregateUniqueCards,
    sharedCardCount,
    aggregateOverlapRate:
      aggregateUniqueCards === 0 ? 0 : sharedCardCount / aggregateUniqueCards,
    unresolvedUserCardCount,
    sampleStatus: getSampleStatus(totalEligibleDecks),
    cards: comparisonCards,
    filters: { ...filters },
  }
}

function getComparisonCategory(
  inclusionRate: number,
  isInUserDeck: boolean,
): DeckComparisonCategory {
  const tier = getInclusionTier(inclusionRate)
  if (isInUserDeck && tier === 'Rare') return 'user-uncommon'
  if (tier === 'Core') return isInUserDeck ? 'shared-core' : 'absent-core'
  if (tier === 'Common') {
    return isInUserDeck ? 'shared-common' : 'absent-common'
  }
  if (tier === 'Flexible') {
    return isInUserDeck ? 'shared-flexible' : 'absent-flexible'
  }
  return isInUserDeck ? 'shared-rare' : 'unresolved'
}

const CATEGORY_ORDER: DeckComparisonCategory[] = [
  'absent-core',
  'shared-core',
  'absent-common',
  'shared-common',
  'user-uncommon',
  'absent-flexible',
  'shared-flexible',
  'shared-rare',
  'unresolved',
]

export function compareComparisonCards(
  left: DeckComparisonCard,
  right: DeckComparisonCard,
): number {
  return CATEGORY_ORDER.indexOf(left.category) -
    CATEGORY_ORDER.indexOf(right.category) ||
    left.cardName.localeCompare(right.cardName)
}

function normalizeAnalyticalName(name: string): string {
  return name.replace(/\s*\/{1,2}\s*/g, ' // ').trim().toLowerCase()
    .replace(/\s+/g, ' ')
}
