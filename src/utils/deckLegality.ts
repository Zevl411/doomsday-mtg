import type { Deck, DeckCard } from '../models/deck'
import type { ScryfallCard } from '../types/card'

// A structured result gives the caller both the decision and an optional
// explanation, which is more useful to the UI than a boolean by itself.
export interface DeckLegalityResult {
  allowed: boolean
  // Overridable marks a rule the user may intentionally accept.
  overridable?: boolean
  reason?: string
}

export function isWithinCommanderColorIdentity(
  card: ScryfallCard,
  commander: ScryfallCard,
): boolean {
  // every() returns true only when each card color exists in the commander.
  return card.color_identity.every((color) =>
    commander.color_identity.includes(color),
  )
}

export function isBasicLand(card: ScryfallCard): boolean {
  return card.type_line.includes('Basic Land')
}

export function getColorIdentityViolations(deck: Deck): DeckCard[] {
  const commander = deck.commander

  if (!commander) {
    return []
  }

  return deck.cards.filter(
    (deckCard) =>
      !isWithinCommanderColorIdentity(deckCard.card, commander),
  )
}

export function validateCardAddition(
  card: ScryfallCard,
  deck: Deck,
): DeckLegalityResult {
  if (!deck.commander) {
    return {
      allowed: false,
      reason: 'Choose a commander before adding cards to the deck.',
    }
  }

  if (card.id === deck.commander.id) {
    return {
      allowed: false,
      reason: 'Your commander cannot also be added as a regular deck card.',
    }
  }

  // some() returns true as soon as it finds a card with the same Scryfall ID.
  const isDuplicate = deck.cards.some(
    (deckCard) => deckCard.card.id === card.id,
  )

  if (isDuplicate && !isBasicLand(card)) {
    return {
      allowed: false,
      reason: `${card.name} is already in the deck.`,
    }
  }

  if (!isWithinCommanderColorIdentity(card, deck.commander)) {
    return {
      allowed: false,
      overridable: true,
      reason: `${card.name} is outside your commander's color identity.`,
    }
  }

  return { allowed: true }
}
