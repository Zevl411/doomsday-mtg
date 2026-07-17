import type { DeckRepository } from './deckRepository'
import {
  clearDeckLibrary,
  loadDeckLibrary,
  saveDeckLibrary,
} from '../utils/deckStorage'

/**
 * The local repository is the MVP persistence implementation. It delegates
 * serialization, validation, and legacy migration to the focused storage
 * utility, which remains the only module that accesses localStorage directly.
 */
export const localDeckRepository: DeckRepository = {
  loadLibrary: loadDeckLibrary,
  saveLibrary: saveDeckLibrary,
  clearLibrary: clearDeckLibrary,
}
