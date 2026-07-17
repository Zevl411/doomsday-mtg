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
    (value.oracle_id === undefined ||
      typeof value.oracle_id === 'string') &&
    typeof value.name === 'string' &&
    typeof value.type_line === 'string' &&
    Array.isArray(value.color_identity) &&
    value.color_identity.every((color) => typeof color === 'string')
  )
}

export function isUsableDeck(value: unknown): value is Deck {
  if (!isObject(value)) {
    return false
  }

  const commanderIsValid =
    value.commander === null || isCardLike(value.commander)

  if (
    typeof value.name !== 'string' ||
    !commanderIsValid ||
    !isUsableBoard(value.cards)
  ) {
    return false
  }

  return ['sideboard', 'maybeboard', 'considering'].every((boardName) => {
    const board = value[boardName]
    return board === undefined || isUsableBoard(board)
  })
}

function isUsableBoard(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false
  }

  return value.every((entry) => {
    if (!isObject(entry)) {
      return false
    }

    return (
      isCardLike(entry.card) &&
      typeof entry.quantity === 'number' &&
      Number.isFinite(entry.quantity) &&
      Number.isInteger(entry.quantity) &&
      entry.quantity > 0
    )
  })
}

export function saveDeck(deck: Deck): boolean {
  try {
    // localStorage saves text, so JSON.stringify() converts the Deck to text.
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck))
    return true
  } catch (error) {
    console.warn('The deck could not be saved locally.', error)
    return false
  }
}

/**
 * Treats browser storage as untrusted input and performs the old-to-new board
 * migration only after every present value passes runtime validation.
 */
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

    // Older saved decks predate auxiliary boards. Loading supplies their
    // defaults so the rest of the application always receives a complete Deck.
    return {
      ...savedValue,
      sideboard: savedValue.sideboard ?? [],
      maybeboard: savedValue.maybeboard ?? [],
      considering: savedValue.considering ?? [],
    }
  } catch (error) {
    // Parsing can fail because browser storage may contain malformed text.
    console.warn('The saved deck was invalid and could not be loaded.', error)
    clearSavedDeck()
    return null
  }
}

export function clearSavedDeck(): boolean {
  try {
    localStorage.removeItem(DECK_STORAGE_KEY)
    return true
  } catch (error) {
    console.warn('The saved deck could not be removed.', error)
    return false
  }
}
