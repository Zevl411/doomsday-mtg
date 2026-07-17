import { defineStore } from 'pinia'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import type { DeckLegalityResult } from '../utils/deckLegality'
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
  }),

  // Actions are the store's named methods for changing its state.
  actions: {
    setCommander(card: ScryfallCard) {
      this.deck.commander = card
      saveDeck(this.deck)
    },

    clearCommander() {
      this.deck.commander = null
      saveDeck(this.deck)
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
        (deckCard) => deckCard.card.id === card.id,
      )

      if (existingBasicLand && isBasicLand(card)) {
        existingBasicLand.quantity += 1
      } else {
        this.deck.cards.push({ card, quantity: 1 })
      }

      this.rejectionMessage = ''
      saveDeck(this.deck)
      return { allowed: true }
    },

    removeCard(index: number) {
      this.deck.cards = this.deck.cards.filter(
        (_card, cardIndex) => cardIndex !== index,
      )
      this.rejectionMessage = ''
      saveDeck(this.deck)
    },

    increaseQuantity(index: number) {
      const deckCard = this.deck.cards[index]

      if (!deckCard || !isBasicLand(deckCard.card)) {
        return
      }

      deckCard.quantity += 1
      this.rejectionMessage = ''
      saveDeck(this.deck)
    },

    decreaseQuantity(index: number) {
      const deckCard = this.deck.cards[index]

      if (!deckCard) {
        return
      }

      if (deckCard.quantity <= 1) {
        this.removeCard(index)
        return
      }

      deckCard.quantity -= 1
      this.rejectionMessage = ''
      saveDeck(this.deck)
    },

    removeIllegalCards() {
      const illegalCards = getColorIdentityViolations(this.deck)

      this.deck.cards = this.deck.cards.filter(
        (deckCard) => !illegalCards.includes(deckCard),
      )
      this.rejectionMessage = ''
      saveDeck(this.deck)
    },

    resetDeck() {
      this.deck = createEmptyDeck()
      this.rejectionMessage = ''
      clearSavedDeck()
    },

    setPreviewCard(card: ScryfallCard) {
      this.previewCard = card
    },

    clearPreviewCard() {
      this.previewCard = null
    },
  },
})
