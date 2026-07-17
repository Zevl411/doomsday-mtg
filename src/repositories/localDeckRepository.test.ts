import { describe, expect, it } from 'vitest'
import {
  DECK_LIBRARY_VERSION,
  type StoredDeckLibrary,
} from '../models/deckLibrary'
import { createEmptyDeck } from '../models/createDeck'
import { DECK_LIBRARY_STORAGE_KEY } from '../utils/deckStorage'
import { localDeckRepository } from './localDeckRepository'

describe('localDeckRepository', () => {
  it('loads and saves through the browser storage adapter', () => {
    const deck = createEmptyDeck('Repository Deck')
    const library: StoredDeckLibrary = {
      version: DECK_LIBRARY_VERSION,
      activeDeckId: deck.id,
      decks: [deck],
    }

    expect(localDeckRepository.saveLibrary(library)).toBe(true)
    expect(localDeckRepository.loadLibrary()).toEqual(library)
  })

  it('clears only the persisted deck library', () => {
    localStorage.setItem(DECK_LIBRARY_STORAGE_KEY, 'saved library')

    expect(localDeckRepository.clearLibrary()).toBe(true)
    expect(localStorage.getItem(DECK_LIBRARY_STORAGE_KEY)).toBeNull()
  })
})
