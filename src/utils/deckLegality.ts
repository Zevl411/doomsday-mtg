import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'

export function isWithinCommanderColorIdentity(
  card: ScryfallCard,
  commander: ScryfallCard,
): boolean {
  // every() returns true only when each card color exists in the commander.
  return card.color_identity.every((color) =>
    commander.color_identity.includes(color),
  )
}

export function canAddCardToDeck(card: ScryfallCard, deck: Deck): boolean {
  if (!deck.commander) {
    return false
  }

  if (card.id === deck.commander.id) {
    return false
  }

  // some() returns true as soon as it finds a card with the same Scryfall ID.
  const isDuplicate = deck.cards.some((deckCard) => deckCard.id === card.id)

  if (isDuplicate) {
    return false
  }

  return isWithinCommanderColorIdentity(card, deck.commander)
}
