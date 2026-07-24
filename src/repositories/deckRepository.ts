import type { StoredDeckLibrary } from '../models/deckLibrary';

/**
 * A repository describes the persistence operations the deck store needs
 * without revealing whether data comes from localStorage or a remote service.
 *
 * The MVP remains synchronous so the existing browser startup path does not
 * need broad asynchronous changes. A future cloud repository can introduce an
 * explicit async hydration action at this boundary without changing components
 * or deck-building rules.
 */
export interface DeckRepository {
  loadLibrary(): StoredDeckLibrary;
  saveLibrary(library: StoredDeckLibrary): boolean;
  clearLibrary(): boolean;
}
