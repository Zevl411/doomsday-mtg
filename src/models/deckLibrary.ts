import type { Deck } from './deck';

export const DECK_LIBRARY_VERSION = 1;

/**
 * The version makes future localStorage migrations explicit instead of
 * guessing which shape an untrusted JSON value uses.
 */
export interface StoredDeckLibrary {
  version: typeof DECK_LIBRARY_VERSION;
  activeDeckId: string | null;
  decks: Deck[];
}
