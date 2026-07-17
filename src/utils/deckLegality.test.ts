import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Deck } from '../models/deck'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'
import { validateCardAddition } from './deckLegality'

function createCard(
  id: string,
  name: string,
  oracleId: string,
  typeLine = 'Artifact',
  colorIdentity: string[] = [],
): ScryfallCard {
  return {
    id,
    oracle_id: oracleId,
    name,
    type_line: typeLine,
    color_identity: colorIdentity,
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })
  setActivePinia(createPinia())
})

describe('deck legality identity checks', () => {
  it('rejects a different printing of the same non-basic card', () => {
    const commander = createCard(
      'commander-printing',
      'Commander',
      'commander-oracle',
      'Legendary Creature',
      ['U'],
    )
    const firstPrinting = createCard(
      'printing-1',
      'Arcane Signet',
      'arcane-signet-oracle',
    )
    const secondPrinting = createCard(
      'printing-2',
      'Arcane Signet',
      'arcane-signet-oracle',
    )
    const deck: Deck = {
      name: 'Test Deck',
      commander,
      cards: [{ card: firstPrinting, quantity: 1 }],
    }

    expect(validateCardAddition(secondPrinting, deck).allowed).toBe(false)
  })

  it('combines different printings of the same basic land', () => {
    const store = useDeckStore()
    const commander = createCard(
      'commander-printing',
      'Commander',
      'commander-oracle',
      'Legendary Creature',
      ['U'],
    )
    const firstIsland = createCard(
      'island-printing-1',
      'Island',
      'island-oracle',
      'Basic Land — Island',
      ['U'],
    )
    const secondIsland = createCard(
      'island-printing-2',
      'Island',
      'island-oracle',
      'Basic Land — Island',
      ['U'],
    )

    store.setCommander(commander)
    store.addCard(firstIsland)
    store.addCard(secondIsland)

    expect(store.deck.cards).toHaveLength(1)
    expect(store.deck.cards[0]?.quantity).toBe(2)
  })

  it('keeps color identity rejection overridable', () => {
    const commander = createCard(
      'commander-printing',
      'Commander',
      'commander-oracle',
      'Legendary Creature',
      ['U'],
    )
    const redCard = createCard(
      'red-printing',
      'Red Card',
      'red-card-oracle',
      'Instant',
      ['R'],
    )
    const deck: Deck = {
      name: 'Test Deck',
      commander,
      cards: [],
    }

    expect(validateCardAddition(redCard, deck)).toMatchObject({
      allowed: false,
      overridable: true,
    })
  })
})
