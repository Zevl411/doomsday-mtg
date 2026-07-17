import type { ScryfallCard } from '../types/card'

export interface DeckCard {
  card: ScryfallCard
  quantity: number
}

// An interface describes the required shape of an object in TypeScript.
// Deck belongs to our application because it combines Scryfall card data with
// deck-building state that the Scryfall API does not own.
export interface Deck {
  commander: ScryfallCard | null
  // Quantity belongs beside the card so one entry represents all of its copies
  // instead of duplicating the same Scryfall card object throughout the array.
  cards: DeckCard[]
  name: string
}
