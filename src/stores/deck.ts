import { defineStore } from 'pinia'
import {
  getDeckBoardEntries,
  type Deck,
  type DeckCard,
  type TrackedDeckBoard,
} from '../models/deck'
import type { ScryfallCard } from '../types/card'
import type { DeckLegalityResult } from '../utils/deckLegality'
import { getCardIdentity } from '../utils/cardIdentity'
import {
  getColorIdentityViolations,
  isBasicLand,
  validateCardAddition,
} from '../utils/deckLegality'
import {
  clearSavedDeck,
  loadDeck,
  saveDeck,
} from '../utils/deckStorage'

function createEmptyDeck(): Deck {
  return {
    commander: null,
    cards: [],
    sideboard: [],
    maybeboard: [],
    considering: [],
    name: 'Untitled Deck',
  }
}

// defineStore() creates one shared source of deck state for the application.
export const useDeckStore = defineStore('deck', {
  // State contains the values that components can read reactively.
  state: () => ({
    deck: loadDeck() ?? createEmptyDeck(),
    rejectionMessage: '',
    previewCard: null as ScryfallCard | null,
    saveSucceeded: null as boolean | null,
  }),

  // Actions are the store's named methods for changing its state.
  actions: {
    // Commander actions remain separate because the Commander is not a board.
    setCommander(card: ScryfallCard) {
      this.deck.commander = card
      this.saveSucceeded = saveDeck(this.deck)
    },

    clearCommander() {
      this.deck.commander = null
      this.saveSucceeded = saveDeck(this.deck)
    },

    addCard(
      card: ScryfallCard,
      allowColorIdentityViolation = false,
    ): DeckLegalityResult {
      const result = validateCardAddition(card, this.deck)

      if (!result.allowed) {
        const mayAddAnyway =
          allowColorIdentityViolation && result.overridable

        if (!mayAddAnyway) {
          this.rejectionMessage =
            result.reason ?? 'That card cannot be added to this deck.'
          return result
        }
      }

      const existingBasicLand = this.deck.cards.find(
        (deckCard) =>
          getCardIdentity(deckCard.card) === getCardIdentity(card),
      )

      if (existingBasicLand && isBasicLand(card)) {
        existingBasicLand.quantity += 1
      } else {
        this.deck.cards.push({ card, quantity: 1 })
      }

      this.rejectionMessage = ''
      this.saveSucceeded = saveDeck(this.deck)
      return { allowed: true }
    },

    addCardToBoard(
      card: ScryfallCard,
      board: TrackedDeckBoard,
      quantity = 1,
      allowColorIdentityViolation = false,
    ): DeckLegalityResult {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return {
          allowed: false,
          reason: 'Quantity must be a positive whole number.',
        }
      }

      if (board === 'mainboard') {
        const result = this.addCard(card, allowColorIdentityViolation)

        // Basic lands can add several copies in one explicit board action.
        if (result.allowed && quantity > 1 && isBasicLand(card)) {
          const entry = findBoardEntry(this.deck.cards, card)
          if (entry) {
            entry.quantity += quantity - 1
            this.saveSucceeded = saveDeck(this.deck)
          }
        }
        return result
      }

      const entries = getDeckBoardEntries(this.deck, board)
      const existing = findBoardEntry(entries, card)

      if (existing) {
        existing.quantity += quantity
      } else {
        entries.push({ card, quantity })
      }

      this.rejectionMessage = ''
      this.saveSucceeded = saveDeck(this.deck)
      return { allowed: true }
    },

    removeCardFromBoard(identity: string, board: TrackedDeckBoard) {
      const entries = getDeckBoardEntries(this.deck, board)
      const remainingEntries = entries.filter(
        (entry) => getCardIdentity(entry.card) !== identity,
      )

      // Assigning the correct property keeps Pinia reactivity explicit.
      if (board === 'mainboard') {
        this.deck.cards = remainingEntries
      } else {
        this.deck[board] = remainingEntries
      }

      this.rejectionMessage = ''
      this.saveSucceeded = saveDeck(this.deck)
    },

    increaseBoardQuantity(identity: string, board: TrackedDeckBoard) {
      const entry = getDeckBoardEntries(this.deck, board).find(
        (item) => getCardIdentity(item.card) === identity,
      )

      if (!entry || (board === 'mainboard' && !isBasicLand(entry.card))) {
        return
      }

      entry.quantity += 1
      this.saveSucceeded = saveDeck(this.deck)
    },

    decreaseBoardQuantity(identity: string, board: TrackedDeckBoard) {
      const entry = getDeckBoardEntries(this.deck, board).find(
        (item) => getCardIdentity(item.card) === identity,
      )

      if (!entry) {
        return
      }

      if (entry.quantity <= 1) {
        this.removeCardFromBoard(identity, board)
        return
      }

      entry.quantity -= 1
      this.saveSucceeded = saveDeck(this.deck)
    },

    moveCardBetweenBoards(
      identity: string,
      fromBoard: TrackedDeckBoard,
      toBoard: TrackedDeckBoard,
    ): DeckLegalityResult {
      const sourceEntry = getDeckBoardEntries(this.deck, fromBoard).find(
        (entry) => getCardIdentity(entry.card) === identity,
      )

      if (!sourceEntry || fromBoard === toBoard) {
        return { allowed: false, reason: 'That card could not be moved.' }
      }

      if (toBoard === 'mainboard') {
        const result = validateCardAddition(sourceEntry.card, this.deck)
        if (!result.allowed) {
          this.rejectionMessage =
            result.reason ?? 'That card cannot be moved to the mainboard.'
          return result
        }

        if (sourceEntry.quantity > 1 && !isBasicLand(sourceEntry.card)) {
          const result = {
            allowed: false,
            reason: 'Only one copy of a non-basic card may enter the mainboard.',
          }
          this.rejectionMessage = result.reason
          return result
        }
      }

      const destination = getDeckBoardEntries(this.deck, toBoard)
      const existing = findBoardEntry(destination, sourceEntry.card)

      if (existing) {
        existing.quantity += sourceEntry.quantity
      } else {
        destination.push({ ...sourceEntry })
      }

      this.removeCardFromBoard(identity, fromBoard)
      return { allowed: true }
    },

    removeIllegalCards() {
      const illegalCards = getColorIdentityViolations(this.deck)

      this.deck.cards = this.deck.cards.filter(
        (deckCard) => !illegalCards.includes(deckCard),
      )
      this.rejectionMessage = ''
      this.saveSucceeded = saveDeck(this.deck)
    },

    resetDeck() {
      this.deck = createEmptyDeck()
      this.rejectionMessage = ''
      this.saveSucceeded = clearSavedDeck()
    },

    replaceDeck(deck: Deck) {
      this.deck = deck
      this.rejectionMessage = ''
      this.saveSucceeded = saveDeck(this.deck)
    },

    setPreviewCard(card: ScryfallCard) {
      this.previewCard = card
    },

    clearPreviewCard() {
      this.previewCard = null
    },
  },
})

function findBoardEntry(
  entries: DeckCard[],
  card: ScryfallCard,
): DeckCard | undefined {
  return entries.find(
    (entry) => getCardIdentity(entry.card) === getCardIdentity(card),
  )
}
