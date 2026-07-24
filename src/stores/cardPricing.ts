import { defineStore } from 'pinia'
import { getCardsByIds } from '../api/scryfall'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'

const SCRYFALL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Holds current printing records for price presentation only. It never mutates
 * Deck cards, so a price refresh cannot mark a Deck as edited or trigger sync.
 */
export const useCardPricingStore = defineStore('cardPricing', {
  state: () => ({
    cardsById: {} as Record<string, ScryfallCard>,
    loadingIds: {} as Record<string, boolean>,
    refreshedIds: {} as Record<string, boolean>,
  }),
  actions: {
    resolve(card: ScryfallCard): ScryfallCard {
      return this.cardsById[card.id] ?? card
    },
    remember(card: ScryfallCard) {
      if (card.prices !== undefined) this.cardsById[card.id] = card
    },
    async refreshDeck(deck: Deck) {
      const cards = [
        ...(deck.commander ? [deck.commander] : []),
        ...(deck.partnerCommander ? [deck.partnerCommander] : []),
        ...deck.cards.map((entry) => entry.card),
        ...deck.sideboard.map((entry) => entry.card),
        ...deck.maybeboard.map((entry) => entry.card),
        ...deck.considering.map((entry) => entry.card),
      ]
      await this.refreshCards(cards)
    },
    async refreshCards(cards: ScryfallCard[]) {
      for (const card of cards) this.remember(card)
      const ids = [...new Set(
        cards
          .map((card) => card.id)
          .filter((id) =>
            SCRYFALL_ID_PATTERN.test(id) &&
            !this.loadingIds[id] &&
            !this.refreshedIds[id]
          ),
      )]
      if (!ids.length) return
      for (const id of ids) this.loadingIds[id] = true

      try {
        const refreshedCards = await getCardsByIds(ids)
        for (const card of refreshedCards) this.cardsById[card.id] = card
        for (const id of ids) this.refreshedIds[id] = true
      } catch {
        // Pricing is supplemental. Retain any stored values and allow a later
        // Deck visit to retry without surfacing a blocking network message.
      } finally {
        for (const id of ids) delete this.loadingIds[id]
      }
    },
  },
})
