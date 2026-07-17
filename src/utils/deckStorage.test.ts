import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DECK_LIBRARY_VERSION,
  type StoredDeckLibrary,
} from '../models/deckLibrary'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import {
  DECK_LIBRARY_STORAGE_KEY,
  LEGACY_DECK_STORAGE_KEY,
  clearDeckLibrary,
  isUsableDeck,
  loadDeckLibrary,
  saveDeckLibrary,
} from './deckStorage'

const card: ScryfallCard = {
  id: 'card-printing',
  name: 'Test Card',
  type_line: 'Artifact',
  color_identity: [],
}

function createStoredDeck(id = 'deck-one', quantity = 1): Deck {
  return {
    id,
    name: 'Stored Deck',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    commander: null,
    cards: [{ card, quantity }],
    sideboard: [],
    maybeboard: [],
    considering: [],
  }
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('deck-library storage', () => {
  it('returns an empty versioned library when storage is empty', () => {
    expect(loadDeckLibrary()).toEqual({
      version: DECK_LIBRARY_VERSION,
      activeDeckId: null,
      decks: [],
    })
  })

  it('saves and loads a valid library', () => {
    const deck = createStoredDeck()
    const library: StoredDeckLibrary = {
      version: DECK_LIBRARY_VERSION,
      activeDeckId: deck.id,
      decks: [deck],
    }

    expect(saveDeckLibrary(library)).toBe(true)
    expect(loadDeckLibrary()).toEqual(library)
  })

  it('rejects malformed libraries and duplicate deck IDs', () => {
    const deck = createStoredDeck()
    localStorage.setItem(
      DECK_LIBRARY_STORAGE_KEY,
      JSON.stringify({
        version: DECK_LIBRARY_VERSION,
        activeDeckId: deck.id,
        decks: [deck, deck],
      }),
    )

    expect(loadDeckLibrary().decks).toEqual([])
  })

  it('normalizes a dangling active deck ID to null', () => {
    const deck = createStoredDeck()
    localStorage.setItem(
      DECK_LIBRARY_STORAGE_KEY,
      JSON.stringify({
        version: DECK_LIBRARY_VERSION,
        activeDeckId: 'missing',
        decks: [deck],
      }),
    )

    expect(loadDeckLibrary().activeDeckId).toBeNull()
    expect(loadDeckLibrary().decks).toEqual([deck])
  })

  it('migrates one legacy deck and remains idempotent', () => {
    const legacyDeck = {
      name: 'Legacy Deck',
      commander: null,
      cards: [{ card, quantity: 1 }],
    }
    localStorage.setItem(
      LEGACY_DECK_STORAGE_KEY,
      JSON.stringify(legacyDeck),
    )

    const firstLoad = loadDeckLibrary()
    const secondLoad = loadDeckLibrary()

    expect(firstLoad.decks).toHaveLength(1)
    expect(secondLoad).toEqual(firstLoad)
    expect(firstLoad.activeDeckId).toBe(firstLoad.decks[0]?.id)
    expect(firstLoad.decks[0]).toMatchObject({
      name: 'Legacy Deck',
      sideboard: [],
      maybeboard: [],
      considering: [],
    })
    expect(firstLoad.decks[0]?.createdAt).toBeTruthy()
    expect(localStorage.getItem(LEGACY_DECK_STORAGE_KEY)).toBeNull()
  })

  it('does not remove legacy data when the migration save fails', () => {
    localStorage.setItem(
      LEGACY_DECK_STORAGE_KEY,
      JSON.stringify({
        name: 'Legacy Deck',
        commander: null,
        cards: [],
      }),
    )
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(loadDeckLibrary().decks).toHaveLength(1)
    expect(localStorage.getItem(LEGACY_DECK_STORAGE_KEY)).not.toBeNull()
  })

  it('validates positive finite integer quantities on every board', () => {
    const deck = createStoredDeck()
    expect(isUsableDeck(deck)).toBe(true)

    deck.sideboard = [{ card, quantity: 0 }]
    expect(isUsableDeck(deck)).toBe(false)
  })

  it('handles malformed JSON without crashing', () => {
    localStorage.setItem(DECK_LIBRARY_STORAGE_KEY, '{not valid JSON')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(loadDeckLibrary().decks).toEqual([])
  })

  it('clears only the library storage key', () => {
    saveDeckLibrary({
      version: DECK_LIBRARY_VERSION,
      activeDeckId: null,
      decks: [],
    })

    expect(clearDeckLibrary()).toBe(true)
    expect(localStorage.getItem(DECK_LIBRARY_STORAGE_KEY)).toBeNull()
  })
})
