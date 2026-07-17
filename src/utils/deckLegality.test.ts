import { beforeEach, describe, expect, it } from 'vitest'
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
  setActivePinia(createPinia())
})

describe('deck legality identity checks', () => {
  it('requires a commander before adding a card', () => {
    const card = createCard('card-printing', 'Card', 'card-oracle')
    const deck: Deck = {
      name: 'Test Deck',
      commander: null,
      cards: [],
    }

    expect(validateCardAddition(card, deck).allowed).toBe(false)
  })

  it('does not allow the commander in the main deck', () => {
    const commander = createCard(
      'commander-printing-1',
      'Commander',
      'commander-oracle',
      'Legendary Creature',
    )
    const otherPrinting = createCard(
      'commander-printing-2',
      'Commander',
      'commander-oracle',
      'Legendary Creature',
    )
    const deck: Deck = {
      name: 'Test Deck',
      commander,
      cards: [],
    }

    expect(validateCardAddition(otherPrinting, deck).allowed).toBe(false)
  })

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

  it('accepts a legal card inside the commander color identity', () => {
    const commander = createCard(
      'commander-printing',
      'Commander',
      'commander-oracle',
      'Legendary Creature',
      ['U'],
    )
    const blueCard = createCard(
      'blue-printing',
      'Blue Card',
      'blue-card-oracle',
      'Instant',
      ['U'],
    )
    const deck: Deck = {
      name: 'Test Deck',
      commander,
      cards: [],
    }

    expect(validateCardAddition(blueCard, deck).allowed).toBe(true)
  })
})
