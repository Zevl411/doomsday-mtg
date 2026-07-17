import { describe, expect, it } from 'vitest'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { formatDecklist } from './decklistFormatter'

function createCard(id: string, name: string): ScryfallCard {
  return {
    id,
    name,
    type_line: 'Artifact',
    color_identity: [],
  }
}

describe('formatDecklist', () => {
  it('formats Commander, sorted deck entries, and quantities', () => {
    const deck: Deck = {
      name: 'Test Deck',
      commander: createCard('commander', "Atraxa, Praetors' Voice"),
      cards: [
        { card: createCard('sol-ring', 'Sol Ring'), quantity: 1 },
        { card: createCard('island', 'Island'), quantity: 12 },
        { card: createCard('arcane', 'Arcane Signet'), quantity: 1 },
      ],
      sideboard: [],
      maybeboard: [],
      considering: [],
    }

    expect(formatDecklist(deck)).toBe(
      [
        'Commander',
        "1 Atraxa, Praetors' Voice",
        '',
        'Mainboard',
        '1 Arcane Signet',
        '12 Island',
        '1 Sol Ring',
      ].join('\n'),
    )
  })

  it('omits the Commander section when no Commander exists', () => {
    const deck: Deck = {
      name: 'Test Deck',
      commander: null,
      cards: [{ card: createCard('sol-ring', 'Sol Ring'), quantity: 1 }],
      sideboard: [],
      maybeboard: [],
      considering: [],
    }

    expect(formatDecklist(deck)).toBe('Mainboard\n1 Sol Ring')
  })

  it('does not mutate deck entry order while sorting output', () => {
    const deck: Deck = {
      name: 'Test Deck',
      commander: null,
      cards: [
        { card: createCard('sol-ring', 'Sol Ring'), quantity: 1 },
        { card: createCard('island', 'Island'), quantity: 2 },
      ],
      sideboard: [],
      maybeboard: [],
      considering: [],
    }

    formatDecklist(deck)

    expect(deck.cards.map((entry) => entry.card.name)).toEqual([
      'Sol Ring',
      'Island',
    ])
  })

  it('preserves and sorts every non-empty tracked board', () => {
    const deck: Deck = {
      name: 'Boards',
      commander: null,
      cards: [],
      sideboard: [
        { card: createCard('z', 'Zed'), quantity: 1 },
        { card: createCard('a', 'Alpha'), quantity: 2 },
      ],
      maybeboard: [
        { card: createCard('silence', 'Silence'), quantity: 1 },
      ],
      considering: [
        { card: createCard('swan', 'Swan Song'), quantity: 3 },
      ],
    }

    expect(formatDecklist(deck)).toBe(
      [
        'Sideboard',
        '2 Alpha',
        '1 Zed',
        '',
        'Maybeboard',
        '1 Silence',
        '',
        'Considering',
        '3 Swan Song',
      ].join('\n'),
    )
  })
})
