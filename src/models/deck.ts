import type { ScryfallCard } from '../types/card'

/**
 * One deck entry stores the canonical card data once and keeps its copy count
 * beside it. This avoids duplicating the relatively large Scryfall object.
 */
export interface DeckCard {
  card: ScryfallCard
  quantity: number
  // Finish belongs to this Deck entry rather than the shared Scryfall record.
  // Missing and false both represent the normal nonfoil treatment.
  foil?: boolean
}

/** Boards that the application currently persists and lets users edit. */
export type TrackedDeckBoard =
  | 'mainboard'
  | 'sideboard'
  | 'maybeboard'
  | 'considering'

export type DeckVisibility = 'private' | 'unlisted' | 'public'

// An interface describes the required shape of an object in TypeScript.
// Deck belongs to our application because it combines Scryfall card data with
// deck-building state that the Scryfall API does not own.
export interface Deck {
  // Deck IDs belong to DoomsdayMTG and are unrelated to Scryfall card IDs.
  id: string
  createdAt: string
  updatedAt: string
  commander: ScryfallCard | null
  // Older saved decks omit this field, so it remains optional at the type
  // boundary. Newly created and normalized decks always store null or a card.
  partnerCommander?: ScryfallCard | null
  // Quantity belongs beside the card so one entry represents all of its copies
  // instead of duplicating the same Scryfall card object throughout the array.
  // `cards` remains the mainboard name to avoid a broad application rename.
  cards: DeckCard[]
  sideboard: DeckCard[]
  maybeboard: DeckCard[]
  considering: DeckCard[]
  name: string
  // These fields are optional at the storage boundary for decks created
  // before sharing settings existed. Normalization supplies their defaults.
  description?: string
  visibility?: DeckVisibility
  creatorUsername?: string
}

/**
 * Converts the user-facing `mainboard` name to the legacy `cards` property.
 * Keeping this mapping in the domain model prevents components and stores from
 * each reimplementing the same conditional.
 */
export function getDeckBoardEntries(
  deck: Deck,
  board: TrackedDeckBoard,
): DeckCard[] {
  return board === 'mainboard' ? deck.cards : deck[board]
}
