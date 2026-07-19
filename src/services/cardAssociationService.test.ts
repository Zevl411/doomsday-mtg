import { describe, expect, it } from 'vitest'
import type { CardAssociation } from '../models/cardAssociation'
import {
  associationStrength,
  cardAssociationService,
  isStatisticallySignificant,
} from './cardAssociationService'

function association(
  values: Partial<CardAssociation> = {},
): CardAssociation {
  return {
    commanderKey: 'kinnan',
    sourceOracleId: '00000000-0000-4000-8000-000000000001',
    sourceCardName: 'A',
    associatedOracleId: '00000000-0000-4000-8000-000000000002',
    associatedCardName: 'B',
    support: 0.3,
    confidence: 0.6,
    lift: 1.5,
    occurrenceCount: 12,
    deckCount: 12,
    firstSeenAt: null,
    lastSeenAt: null,
    sampleSize: 40,
    ...values,
  }
}

describe('card association analysis', () => {
  it('hides associations protected by small-sample thresholds', () => {
    expect(cardAssociationService.analyze([
      association({ sampleSize: 4, occurrenceCount: 2 }),
    ])).toEqual([])
  })

  it('hides weak confidence and below-baseline lift', () => {
    expect(cardAssociationService.analyze([
      association({ confidence: 0.02 }),
      association({ lift: 0.9 }),
    ])).toEqual([])
  })

  it('normalizes surviving scores relative to the strongest observation', () => {
    const result = cardAssociationService.analyze([
      association(),
      association({
        associatedOracleId: '00000000-0000-4000-8000-000000000003',
        associatedCardName: 'C',
        support: 0.1,
        confidence: 0.2,
        lift: 1.1,
        deckCount: 5,
        occurrenceCount: 5,
      }),
    ])
    expect(result[0]?.normalizedScore).toBe(1)
    expect(result[1]?.normalizedScore).toBeGreaterThan(0)
    expect(result[1]?.normalizedScore).toBeLessThan(1)
  })

  it('calculates significance and descriptive labels deterministically', () => {
    expect(isStatisticallySignificant(association())).toBe(true)
    expect(associationStrength(association())).toBe('strong')
    expect(associationStrength(association({
      confidence: 0.3,
      lift: 1.25,
      deckCount: 6,
    }))).toBe('moderate')
    expect(associationStrength(association({
      confidence: 0.1,
      lift: 1.05,
      deckCount: 3,
    }))).toBe('emerging')
  })
})
