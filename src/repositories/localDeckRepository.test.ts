import { beforeEach, describe, expect, it } from 'vitest'
import { DECK_LIBRARY_VERSION } from '../models/deckLibrary'
import { createEmptyDeck } from '../models/createDeck'
import { GUEST_DRAFT_STORAGE_KEY } from '../utils/deckStorage'
import {
  guestDraftRepository,
  memoryDeckRepository,
} from './localDeckRepository'

beforeEach(() => localStorage.clear())

describe('guestDraftRepository', () => {
  it('persists only the active guest draft', () => {
    const first = createEmptyDeck('First')
    const active = createEmptyDeck('Active')

    expect(
      guestDraftRepository.saveLibrary({
        version: DECK_LIBRARY_VERSION,
        activeDeckId: active.id,
        decks: [first, active],
      }),
    ).toBe(true)
    expect(guestDraftRepository.loadLibrary().decks).toEqual([active])
  })

  it('clears the temporary guest draft', () => {
    localStorage.setItem(GUEST_DRAFT_STORAGE_KEY, '{}')

    expect(guestDraftRepository.clearLibrary()).toBe(true)
    expect(localStorage.getItem(GUEST_DRAFT_STORAGE_KEY)).toBeNull()
  })
})

describe('memoryDeckRepository', () => {
  it('never writes authenticated deck data to localStorage', () => {
    const cloudDeck = createEmptyDeck('Cloud')

    expect(
      memoryDeckRepository.saveLibrary({
        version: DECK_LIBRARY_VERSION,
        activeDeckId: cloudDeck.id,
        decks: [cloudDeck],
      }),
    ).toBe(true)
    expect(localStorage.length).toBe(0)
    expect(memoryDeckRepository.loadLibrary().decks).toEqual([])
  })
})
