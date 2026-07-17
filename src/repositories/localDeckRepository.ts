import { DECK_LIBRARY_VERSION } from '../models/deckLibrary'
import type { DeckRepository } from './deckRepository'
import {
  clearGuestDraft,
  loadGuestDraft,
  saveGuestDraft,
} from '../utils/deckStorage'

/** Guest mode persists exactly one refresh-safe temporary draft. */
export const guestDraftRepository: DeckRepository = {
  loadLibrary() {
    const deck = loadGuestDraft()
    return {
      version: DECK_LIBRARY_VERSION,
      activeDeckId: deck?.id ?? null,
      decks: deck ? [deck] : [],
    }
  },

  saveLibrary(library) {
    const active =
      library.decks.find((deck) => deck.id === library.activeDeckId) ??
      library.decks[0] ??
      null
    return saveGuestDraft(active)
  },

  clearLibrary: clearGuestDraft,
}

/** Cloud libraries remain in memory and are never mirrored to localStorage. */
export const memoryDeckRepository: DeckRepository = {
  loadLibrary: () => ({
    version: DECK_LIBRARY_VERSION,
    activeDeckId: null,
    decks: [],
  }),
  saveLibrary: () => true,
  clearLibrary: () => true,
}
