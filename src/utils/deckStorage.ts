import type { Deck } from '../models/deck'

const DECK_STORAGE_KEY = 'doomsday-mtg-current-deck'

// Record<string, unknown> describes an object whose values are not trusted yet.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCardLike(value: unknown): boolean {
  if (!isObject(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.type_line === 'string' &&
    Array.isArray(value.color_identity) &&
    value.color_identity.every((color) => typeof color === 'string')
  )
}

function isUsableDeck(value: unknown): value is Deck {
  if (!isObject(value)) {
    return false
  }

  const commanderIsValid =
    value.commander === null || isCardLike(value.commander)

  if (
    typeof value.name !== 'string' ||
    !commanderIsValid ||
    !Array.isArray(value.cards)
  ) {
    return false
  }

  return value.cards.every((entry) => {
    if (!isObject(entry)) {
      return false
    }

    return (
      isCardLike(entry.card) &&
      typeof entry.quantity === 'number' &&
      Number.isFinite(entry.quantity) &&
      entry.quantity > 0
    )
  })
}

export function saveDeck(deck: Deck): void {
  try {
    // localStorage saves text, so JSON.stringify() converts the Deck to text.
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck))
  } catch (error) {
    console.warn('The deck could not be saved locally.', error)
  }
}

export function loadDeck(): Deck | null {
  try {
    const savedText = localStorage.getItem(DECK_STORAGE_KEY)

    if (!savedText) {
      return null
    }

    // JSON.parse() converts stored text back into a JavaScript value.
    const savedValue: unknown = JSON.parse(savedText)

    if (!isUsableDeck(savedValue)) {
      clearSavedDeck()
      return null
    }

    return savedValue
  } catch (error) {
    // Parsing can fail because browser storage may contain malformed text.
    console.warn('The saved deck was invalid and could not be loaded.', error)
    clearSavedDeck()
    return null
  }
}

export function clearSavedDeck(): void {
  try {
    localStorage.removeItem(DECK_STORAGE_KEY)
  } catch (error) {
    console.warn('The saved deck could not be removed.', error)
  }
}
