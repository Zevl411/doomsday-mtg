import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { saveDeck } from '../utils/deckStorage'
import { getTotalDeckCardCount } from '../utils/deckValidation'
import { useDeckStore } from './deck'

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

const commander = createCard(
  'commander-printing',
  'Commander',
  'commander-oracle',
  'Legendary Creature',
  ['U'],
)
const artifact = createCard(
  'artifact-printing',
  'Artifact',
  'artifact-oracle',
)
const island = createCard(
  'island-printing',
  'Island',
  'island-oracle',
  'Basic Land — Island',
  ['U'],
)

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('deck store', () => {
  it('starts with the default empty deck', () => {
    const store = useDeckStore()

    expect(store.deck).toEqual({
      commander: null,
      cards: [],
      sideboard: [],
      maybeboard: [],
      considering: [],
      name: 'Untitled Deck',
    })
  })

  it('loads a valid saved deck', () => {
    const savedDeck: Deck = {
      commander,
      cards: [{ card: artifact, quantity: 1 }],
      sideboard: [],
      maybeboard: [],
      considering: [],
      name: 'Saved Deck',
    }
    saveDeck(savedDeck)
    setActivePinia(createPinia())

    expect(useDeckStore().deck).toEqual(savedDeck)
  })

  it('sets and clears the commander', () => {
    const store = useDeckStore()

    store.setCommander(commander)
    expect(store.deck.commander).toEqual(commander)

    store.clearCommander()
    expect(store.deck.commander).toBeNull()
  })

  it('adds a legal card and rejects a duplicate printing', () => {
    const store = useDeckStore()
    store.setCommander(commander)

    expect(store.addCard(artifact).allowed).toBe(true)
    expect(store.addCard({ ...artifact, id: 'other-printing' }).allowed).toBe(
      false,
    )
    expect(store.deck.cards).toHaveLength(1)
  })

  it('adds, increases, and decreases a basic land quantity', () => {
    const store = useDeckStore()
    store.setCommander(commander)
    store.addCard(island)
    store.addCard({ ...island, id: 'other-island-printing' })

    expect(store.deck.cards[0]?.quantity).toBe(2)

    store.increaseQuantity(0)
    expect(store.deck.cards[0]?.quantity).toBe(3)

    store.decreaseQuantity(0)
    expect(store.deck.cards[0]?.quantity).toBe(2)
  })

  it('removes an entry when its quantity reaches zero', () => {
    const store = useDeckStore()
    store.setCommander(commander)
    store.addCard(island)

    store.decreaseQuantity(0)

    expect(store.deck.cards).toHaveLength(0)
  })

  it('removes a selected card', () => {
    const store = useDeckStore()
    store.setCommander(commander)
    store.addCard(artifact)

    store.removeCard(0)

    expect(store.deck.cards).toHaveLength(0)
  })

  it('resets the deck and clears saved data', () => {
    const store = useDeckStore()
    store.setCommander(commander)
    store.addCard(artifact)
    store.addCardToBoard(artifact, 'sideboard')
    store.addCardToBoard(artifact, 'maybeboard')
    store.addCardToBoard(artifact, 'considering')

    store.resetDeck()

    expect(store.deck.commander).toBeNull()
    expect(store.deck.cards).toHaveLength(0)
    expect(store.deck.sideboard).toHaveLength(0)
    expect(store.deck.maybeboard).toHaveLength(0)
    expect(store.deck.considering).toHaveLength(0)
    expect(localStorage.getItem('doomsday-mtg-current-deck')).toBeNull()
  })

  it('replaces and persists an imported deck', () => {
    const store = useDeckStore()
    const importedDeck: Deck = {
      name: 'Imported Deck',
      commander,
      cards: [{ card: artifact, quantity: 1 }],
      sideboard: [],
      maybeboard: [],
      considering: [],
    }

    store.replaceDeck(importedDeck)

    expect(store.deck).toEqual(importedDeck)
    expect(store.saveSucceeded).toBe(true)
    expect(localStorage.getItem('doomsday-mtg-current-deck')).toContain(
      'Imported Deck',
    )
  })

  it('tracks successful and failed persistence attempts', () => {
    const store = useDeckStore()

    store.setCommander(commander)
    expect(store.saveSucceeded).toBe(true)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    store.clearCommander()
    expect(store.saveSucceeded).toBe(false)
  })

  it('sets and clears preview state without persisting it', () => {
    const store = useDeckStore()
    store.setPreviewCard(artifact)
    store.setCommander(commander)

    const savedText = localStorage.getItem('doomsday-mtg-current-deck')

    expect(store.previewCard).toEqual(artifact)
    expect(savedText).not.toContain('previewCard')

    store.clearPreviewCard()
    expect(store.previewCard).toBeNull()
  })

  it('adds quantities to auxiliary boards and persists them', () => {
    const store = useDeckStore()

    store.addCardToBoard(artifact, 'sideboard', 2)
    store.addCardToBoard(artifact, 'sideboard', 3)

    expect(store.deck.sideboard).toEqual([
      { card: artifact, quantity: 5 },
    ])
    expect(localStorage.getItem('doomsday-mtg-current-deck')).toContain(
      '"sideboard"',
    )
  })

  it('moves cards between auxiliary boards', () => {
    const store = useDeckStore()
    store.addCardToBoard(artifact, 'maybeboard', 2)

    const result = store.moveCardBetweenBoards(
      'artifact-oracle',
      'maybeboard',
      'considering',
    )

    expect(result.allowed).toBe(true)
    expect(store.deck.maybeboard).toHaveLength(0)
    expect(store.deck.considering[0]?.quantity).toBe(2)
  })

  it('does not count auxiliary boards toward Commander deck size', () => {
    const store = useDeckStore()
    store.setCommander(commander)
    store.addCardToBoard(artifact, 'sideboard', 20)
    store.addCardToBoard(artifact, 'maybeboard', 10)
    store.addCardToBoard(artifact, 'considering', 5)

    expect(getTotalDeckCardCount(store.deck)).toBe(1)
  })
})
