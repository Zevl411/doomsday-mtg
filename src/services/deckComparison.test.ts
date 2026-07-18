import { describe, expect, it } from 'vitest'
import { createEmptyDeck } from '../models/createDeck'
import type { CommanderCardInclusion } from '../models/tournament'
import {
  buildDeckComparisonSummary,
  getAnalyticalCardIdentity,
  getSampleStatus,
  getTournamentMainboardIdentityKeys,
} from './deckComparison'

const inclusion = (
  name: string,
  rate: number,
  oracleId = name.toLowerCase(),
): CommanderCardInclusion => ({
  normalizedCardKey: name.toLowerCase(),
  oracleId,
  cardName: name,
  colorIdentity: [],
  deckCount: Math.round(rate * 10),
  totalEligibleDecks: 10,
  inclusionRate: rate,
  averageQuantity: 1,
  top16DeckCount: 1,
  top16InclusionRate: rate,
  firstPlaceDeckCount: 1,
  firstPlaceInclusionRate: rate,
})

describe('deck comparison service', () => {
  it('uses Oracle IDs across printings and canonical-name fallback otherwise', () => {
    expect(getAnalyticalCardIdentity({
      oracleId: 'ABC',
      cardName: 'Different Printing',
    })).toBe('oracle:abc')
    expect(getAnalyticalCardIdentity({
      cardName: 'Fire / Ice',
    })).toBe('name:fire // ice')
  })

  it('deduplicates mainboard identities while retaining quantities', () => {
    const deck = createEmptyDeck('Test')
    deck.cards = [
      { card: { id: 'a', oracle_id: 'same', name: 'One', type_line: '', color_identity: [] }, quantity: 1 },
      { card: { id: 'b', oracle_id: 'same', name: 'Two', type_line: '', color_identity: [] }, quantity: 2 },
    ]
    const summary = buildDeckComparisonSummary(deck, [inclusion('One', 0.8, 'same')], {})
    expect(summary.userMainboardUniqueCards).toBe(1)
    expect(summary.cards[0]?.userQuantity).toBe(3)
  })

  it('excludes Commander and auxiliary boards from user comparison', () => {
    const deck = createEmptyDeck('Boards')
    deck.commander = { id: 'c', oracle_id: 'commander', name: 'Commander', type_line: '', color_identity: [] }
    deck.sideboard = [{ card: { id: 's', oracle_id: 'side', name: 'Side', type_line: '', color_identity: [] }, quantity: 1 }]
    const summary = buildDeckComparisonSummary(deck, [], {})
    expect(summary.userMainboardUniqueCards).toBe(0)
  })

  it('assigns descriptive categories and calculates aggregate overlap', () => {
    const deck = createEmptyDeck('Categories')
    deck.commander = { id: 'c', name: 'Kinnan', type_line: '', color_identity: [] }
    deck.cards = [
      { card: { id: '1', oracle_id: 'core', name: 'Core', type_line: '', color_identity: [] }, quantity: 1 },
      { card: { id: '2', oracle_id: 'rare', name: 'Rare', type_line: '', color_identity: [] }, quantity: 1 },
      { card: { id: '3', name: 'Unresolved', type_line: '', color_identity: [] }, quantity: 1 },
    ]
    const summary = buildDeckComparisonSummary(deck, [
      inclusion('Core', 0.8, 'core'),
      inclusion('Missing Core', 0.9, 'missing'),
      inclusion('Common', 0.6, 'common'),
      inclusion('Flexible', 0.2, 'flex'),
      inclusion('Rare', 0.1, 'rare'),
    ], {})
    expect(summary.cards.map((card) => card.category)).toEqual(
      expect.arrayContaining([
        'shared-core', 'absent-core', 'absent-common', 'absent-flexible',
        'user-uncommon', 'unresolved',
      ]),
    )
    expect(summary.sharedCardCount).toBe(1)
    expect(summary.aggregateUniqueCards).toBe(4)
    expect(summary.aggregateOverlapRate).toBe(0.25)
    expect(summary.unresolvedUserCardCount).toBe(1)
  })

  it('returns zero for an empty aggregate and centralizes sample thresholds', () => {
    const summary = buildDeckComparisonSummary(createEmptyDeck(), [], {})
    expect(summary.aggregateOverlapRate).toBe(0)
    expect([getSampleStatus(0), getSampleStatus(1), getSampleStatus(5), getSampleStatus(20)])
      .toEqual(['unavailable', 'insufficient', 'limited', 'sufficient'])
  })

  it('uses only distinct tournament mainboard identities', () => {
    expect(getTournamentMainboardIdentityKeys([
      { id: '1', board: 'mainboard', oracleId: 'x', normalizedCardKey: 'x', cardName: 'X', quantity: 1, colorIdentity: [], colors: [], isBasicLand: false },
      { id: '2', board: 'mainboard', oracleId: 'x', normalizedCardKey: 'x', cardName: 'X', quantity: 2, colorIdentity: [], colors: [], isBasicLand: false },
      { id: '3', board: 'sideboard', oracleId: 'y', normalizedCardKey: 'y', cardName: 'Y', quantity: 1, colorIdentity: [], colors: [], isBasicLand: false },
    ])).toEqual(['oracle:x'])
  })
})
