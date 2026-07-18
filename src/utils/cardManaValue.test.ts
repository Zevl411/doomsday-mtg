import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../types/card'
import { getCardManaValue } from './cardManaValue'

function card(overrides: Partial<ScryfallCard>): ScryfallCard {
  return {
    id: 'card-id',
    name: 'Test Card',
    type_line: 'Instant',
    color_identity: [],
    ...overrides,
  }
}

describe('getCardManaValue', () => {
  it('prefers the numeric mana value when provided', () => {
    expect(getCardManaValue(card({ cmc: 7, mana_cost: '{1}{U}' }))).toBe(7)
  })

  it('derives mana value from generic, colored, and hybrid symbols', () => {
    expect(getCardManaValue(card({ mana_cost: '{2}{W/U}{U/P}{X}' }))).toBe(4)
  })

  it('adds multiple face casting costs when no numeric value exists', () => {
    expect(
      getCardManaValue(
        card({
          card_faces: [
            { name: 'First', type_line: 'Sorcery', mana_cost: '{1}{R}' },
            { name: 'Second', type_line: 'Sorcery', mana_cost: '{2}{U}' },
          ],
        }),
      ),
    ).toBe(5)
  })
})
