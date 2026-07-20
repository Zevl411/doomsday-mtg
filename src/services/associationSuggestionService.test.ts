import { describe, expect, it } from 'vitest'
import type { AssociationSuggestionRow } from '../models/associationSuggestion'
import {
  associationSuggestionService,
  formatSuggestionEvidence,
} from './associationSuggestionService'

const sourceA = '00000000-0000-4000-8000-000000000001'
const sourceB = '00000000-0000-4000-8000-000000000002'
const suggested = '00000000-0000-4000-8000-000000000003'

function row(
  values: Partial<AssociationSuggestionRow> = {},
): AssociationSuggestionRow {
  return {
    commanderKey: 'kinnan',
    sourceOracleId: sourceA,
    sourceCardName: 'Card X',
    suggestedOracleId: suggested,
    suggestedCardName: 'Card D',
    support: 0.42,
    confidence: 0.7,
    lift: 1.4,
    occurrenceCount: 42,
    jointDeckCount: 42,
    sourceDeckCount: 60,
    sampleSize: 100,
    ...values,
  }
}

describe('association-based suggestion evidence aggregation', () => {
  it('requires the configured number of distinct supporting cards', () => {
    expect(associationSuggestionService.buildSuggestions(
      [row()],
      [],
      { minimumSupportingCards: 2 },
    )).toEqual([])

    expect(associationSuggestionService.buildSuggestions([
      row(),
      row({
        sourceOracleId: sourceB,
        sourceCardName: 'Card Y',
      }),
    ], [], { minimumSupportingCards: 2 })).toHaveLength(1)
  })

  it('never suggests a card already owned by the personal Deck', () => {
    expect(associationSuggestionService.buildSuggestions(
      [row(), row({ sourceOracleId: sourceB })],
      [suggested],
      { minimumSupportingCards: 2 },
    )).toEqual([])
  })

  it('deduplicates source evidence and normalizes ordering scores', () => {
    const otherSuggested = '00000000-0000-4000-8000-000000000004'
    const result = associationSuggestionService.buildSuggestions([
      row(),
      row({ confidence: 0.5, jointDeckCount: 30 }),
      row({ sourceOracleId: sourceB, sourceCardName: 'Card Y' }),
      row({
        sourceOracleId: sourceA,
        suggestedOracleId: otherSuggested,
        suggestedCardName: 'Card E',
        confidence: 0.2,
        jointDeckCount: 8,
      }),
      row({
        sourceOracleId: sourceB,
        sourceCardName: 'Card Y',
        suggestedOracleId: otherSuggested,
        suggestedCardName: 'Card E',
        confidence: 0.2,
        jointDeckCount: 8,
      }),
    ], [], { minimumSupportingCards: 2 })

    expect(result[0]?.suggestedCardName).toBe('Card D')
    expect(result[0]?.supportingCardCount).toBe(2)
    expect(result[0]?.aggregateScore).toBe(1)
    expect(result[1]?.aggregateScore).toBeGreaterThan(0)
    expect(result[1]?.aggregateScore).toBeLessThan(1)
  })

  it('attaches Scryfall cards by Oracle identity without name inference', () => {
    const suggestions = associationSuggestionService.buildSuggestions([
      row(),
      row({ sourceOracleId: sourceB }),
    ], [], { minimumSupportingCards: 2 })
    const attached = associationSuggestionService.attachCards(suggestions, [{
      id: 'printing',
      oracle_id: suggested,
      name: 'Localized Display Name',
      type_line: 'Artifact',
      color_identity: [],
    }])
    expect(attached[0]?.suggestedCard?.id).toBe('printing')
  })

  it('formats exact tournament evidence without strategic reasoning', () => {
    expect(formatSuggestionEvidence('Card X', 42, 57)).toBe(
      'Among 57 eligible tournament Decks containing Card X, 42 also contained this card.',
    )
  })
})
