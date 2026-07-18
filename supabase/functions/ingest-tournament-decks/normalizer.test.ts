import { describe, expect, it } from 'vitest'
import {
  evaluateDeckCompleteness,
  normalizeCardKey,
  normalizePlaintextDeck,
  normalizeStructuredDeck,
} from '../_shared/tournamentDeckNormalizer.ts'

describe('tournament Deck normalization', () => {
  it('maps structured TopDeck sections, quantities, partners, and boards', () => {
    const result = normalizeStructuredDeck({
      Commanders: {
        'Tymna the Weaver': 1,
        'Kraum, Ludevic’s Opus': { quantity: 1 },
      },
      Mainboard: {
        Island: 4,
        'Sink into Stupor / Soporific Springs': 1,
      },
      Sideboard: [{ name: 'Red Elemental Blast', quantity: 1 }],
    })
    expect(result.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ board: 'commander', name: 'Tymna the Weaver', quantity: 1 }),
      expect.objectContaining({ board: 'commander', name: 'Kraum, Ludevic’s Opus', quantity: 1 }),
      expect.objectContaining({ board: 'mainboard', name: 'Island', quantity: 4 }),
      expect.objectContaining({
        board: 'mainboard',
        name: 'Sink into Stupor // Soporific Springs',
      }),
      expect.objectContaining({ board: 'sideboard', name: 'Red Elemental Blast' }),
    ]))
  })

  it('ignores TopDeck metadata and non-deck play-aid sections', () => {
    const result = normalizeStructuredDeck({
      Commanders: { 'Etali, Primal Conqueror / Etali, Primal Sickness': 1 },
      Mainboard: { Forest: 99 },
      metadata: {
        game: 'Magic: The Gathering',
        format: 'Commander',
        importedFrom: 'TopDeck',
      },
      Stickers: { 'Ancestral Hot Dog Minotaur': 1 },
      Tokens: { Treasure: 1 },
    })

    expect(result.cards).toEqual([
      expect.objectContaining({
        board: 'commander',
        name: 'Etali, Primal Conqueror // Etali, Primal Sickness',
      }),
      expect.objectContaining({
        board: 'mainboard',
        name: 'Forest',
        quantity: 99,
      }),
    ])
    expect(result.issues).toEqual([])
  })

  it('reports unknown structured sections without parsing metadata as cards', () => {
    const result = normalizeStructuredDeck({
      Mainboard: { Island: 99 },
      ProviderDetails: { game: 'Magic', format: 'Commander' },
    })

    expect(result.cards).toEqual([
      expect.objectContaining({ name: 'Island', board: 'mainboard' }),
    ])
    expect(result.cards.map((card) => card.name)).not.toContain('game')
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'unsupported_board' }),
    ])
  })

  it('uses the established plaintext heading and annotation conventions', () => {
    const result = normalizePlaintextDeck(`
      ~~Commanders~~
      1 Tymna the Weaver
      1 Kraum, Ludevic's Opus
      **Mainboard**
      4 Island (FDN) 275
      1 Sink into Stupor / Soporific Springs
      Sideboard:
      1 Pyroblast
    `)
    expect(result.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ board: 'commander', name: 'Tymna the Weaver' }),
      expect.objectContaining({ board: 'mainboard', name: 'Island', quantity: 4 }),
      expect.objectContaining({ board: 'sideboard', name: 'Pyroblast' }),
    ]))
  })

  it('combines duplicate normalized names and reports the issue', () => {
    const result = normalizePlaintextDeck('1 Island\n2 island')
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]?.quantity).toBe(3)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate_normalized_card' }),
    ]))
    expect(normalizeCardKey(' Fire // Ice ')).toBe('fire // ice')
  })

  it('accepts supported partner pairs and reports partial and unavailable lists', () => {
    const complete = evaluateDeckCompleteness([
      { board: 'commander', name: 'Tymna', quantity: 1 },
      { board: 'commander', name: 'Kraum', quantity: 1 },
      { board: 'mainboard', name: 'Island', quantity: 98 },
    ], 0, [])
    expect(complete.status).toBe('complete')

    const partial = evaluateDeckCompleteness([
      { board: 'mainboard', name: 'Island', quantity: 99 },
    ], 1, [])
    expect(partial.status).toBe('partial')
    expect(partial.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['missing_commander', 'unresolved_cards']),
    )
    expect(evaluateDeckCompleteness([], 0, []).status).toBe('unavailable')
  })
})
