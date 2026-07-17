import type { ScryfallCard } from '../types/card'

// An interface describes the required shape of an object in TypeScript.
// Deck belongs to our application because it combines Scryfall card data with
// deck-building state that the Scryfall API does not own.
export interface Deck {
  commander: ScryfallCard | null
  cards: ScryfallCard[]
  name: string
}
