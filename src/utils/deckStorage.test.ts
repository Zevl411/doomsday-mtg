import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import {
  clearSavedDeck,
  isUsableDeck,
  loadDeck,
  saveDeck,
} from './deckStorage'

const card: ScryfallCard = {
  id: 'card-printing',
  name: 'Test Card',
  type_line: 'Artifact',
  color_identity: [],
}

function createStoredDeck(quantity: number): Deck {
  return {
    name: 'Stored Deck',
    commander: null,
    cards: [{ card, quantity }],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('stored deck validation', () => {
  it('saves and loads a valid deck', () => {
    const deck = createStoredDeck(2)

    expect(saveDeck(deck)).toBe(true)
    expect(loadDeck()).toEqual(deck)
  })

  it('accepts a positive integer quantity', () => {
    expect(isUsableDeck(createStoredDeck(2))).toBe(true)
  })

  it.each([1.5, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid quantity %s',
    (quantity) => {
      expect(isUsableDeck(createStoredDeck(quantity))).toBe(false)
    },
  )

  it('handles malformed JSON without crashing', () => {
    const removeItem = vi.fn()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '{not valid JSON'),
      setItem: vi.fn(),
      removeItem,
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(loadDeck()).toBeNull()
    expect(removeItem).toHaveBeenCalled()
  })

  it('clears saved deck data', () => {
    saveDeck(createStoredDeck(1))

    expect(clearSavedDeck()).toBe(true)
    expect(loadDeck()).toBeNull()
  })

  it('reports storage failures without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(saveDeck(createStoredDeck(1))).toBe(false)
  })
})
