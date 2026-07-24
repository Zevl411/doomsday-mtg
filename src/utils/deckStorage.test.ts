import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DECK_LIBRARY_VERSION,
  type StoredDeckLibrary,
} from '../models/deckLibrary'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import {
  DECK_LIBRARY_STORAGE_KEY,
  GUEST_DRAFT_STORAGE_KEY,
  LEGACY_DECK_STORAGE_KEY,
  LEGACY_LIBRARY_STORAGE_KEY,
  clearDeckLibrary,
  clearLocalDecksAfterAccountTransfer,
  isUsableDeck,
  loadDeckLibrary,
  loadGuestDraft,
  loadLocalDecksForAccountTransfer,
  saveGuestDraft,
  saveDeckLibrary,
} from './deckStorage'

const card: ScryfallCard = {
  id: 'card-printing',
  name: 'Test Card',
  type_line: 'Artifact',
  color_identity: [],
  cmc: 3,
  mana_cost: '{3}',
  set: 'tst',
  set_name: 'Test Set',
  collector_number: '42',
  released_at: '2026-01-01',
  rarity: 'rare',
  lang: 'en',
  artist: 'Test Artist',
  tcgplayer_id: 12345,
  prices: {
    usd: '1.25',
    usd_foil: '4.50',
    usd_etched: null,
  },
  purchase_uris: {
    tcgplayer: 'https://www.tcgplayer.com/product/12345',
  },
}

function createStoredDeck(id = 'deck-one', quantity = 1): Deck {
  return {
    id,
    name: 'Stored Deck',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    commander: null,
    partnerCommander: null,
    cards: [{ card: structuredClone(card), quantity }],
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
    deck.cards[0]!.foil = true
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

  it('fails safely for an unsupported library version', () => {
    localStorage.setItem(
      DECK_LIBRARY_STORAGE_KEY,
      JSON.stringify({
        version: 99,
        activeDeckId: null,
        decks: [createStoredDeck()],
      }),
    )

    expect(loadDeckLibrary()).toEqual({
      version: DECK_LIBRARY_VERSION,
      activeDeckId: null,
      decks: [],
    })
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

  it('moves the previous unscoped library into the guest namespace once', () => {
    const deck = createStoredDeck()
    localStorage.setItem(
      LEGACY_LIBRARY_STORAGE_KEY,
      JSON.stringify({
        version: DECK_LIBRARY_VERSION,
        activeDeckId: deck.id,
        decks: [deck],
      }),
    )

    expect(loadDeckLibrary().decks).toEqual([deck])
    expect(localStorage.getItem(LEGACY_LIBRARY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(DECK_LIBRARY_STORAGE_KEY)).not.toBeNull()
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

  it('accepts legacy-compatible cards without oracle IDs', () => {
    const deck = createStoredDeck()
    delete deck.cards[0]?.card.oracle_id

    expect(isUsableDeck(deck)).toBe(true)
  })

  it('rejects malformed optional nested card data', () => {
    const deck = createStoredDeck()
    const malformedCard = deck.cards[0]?.card as unknown as Record<
      string,
      unknown
    >
    malformedCard.card_faces = 'not-an-array'

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

describe('guest draft storage', () => {
  it('round-trips one versioned guest deck', () => {
    const deck = createStoredDeck()
    expect(saveGuestDraft(deck)).toBe(true)
    expect(loadGuestDraft()).toEqual(deck)
  })

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    'rejects an invalid quantity of %s',
    (quantity) => {
      const deck = createStoredDeck('invalid-quantity', quantity)
      localStorage.setItem(
        GUEST_DRAFT_STORAGE_KEY,
        JSON.stringify({ version: 1, deck }),
      )
      expect(loadGuestDraft()).toBeNull()
    },
  )

  it('rejects malformed JSON and invalid timestamps without crashing', () => {
    localStorage.setItem(GUEST_DRAFT_STORAGE_KEY, '{broken')
    expect(loadGuestDraft()).toBeNull()

    const deck = createStoredDeck()
    deck.updatedAt = 'not-a-date'
    localStorage.setItem(
      GUEST_DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 1, deck }),
    )
    expect(loadGuestDraft()).toBeNull()
  })

  it('keeps a former multi-Deck library available for account transfer', () => {
    const first = createStoredDeck('first')
    const active = createStoredDeck('active')
    saveDeckLibrary({
      version: DECK_LIBRARY_VERSION,
      activeDeckId: active.id,
      decks: [first, active],
    })

    expect(loadGuestDraft()?.id).toBe(active.id)
    expect(loadDeckLibrary().decks).toHaveLength(2)
    expect(loadLocalDecksForAccountTransfer()).toEqual({
      decks: [first, active],
      preferredActiveId: active.id,
    })
  })

  it('clears every local Deck key after cloud confirmation', () => {
    const deck = createStoredDeck()
    saveGuestDraft(deck)
    saveDeckLibrary({
      version: DECK_LIBRARY_VERSION,
      activeDeckId: deck.id,
      decks: [deck],
    })
    localStorage.setItem(LEGACY_LIBRARY_STORAGE_KEY, '{}')
    localStorage.setItem(LEGACY_DECK_STORAGE_KEY, '{}')

    expect(clearLocalDecksAfterAccountTransfer()).toBe(true)
    expect(localStorage.getItem(GUEST_DRAFT_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(DECK_LIBRARY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_LIBRARY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_DECK_STORAGE_KEY)).toBeNull()
  })
})
