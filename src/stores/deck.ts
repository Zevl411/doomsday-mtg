import { defineStore } from 'pinia'
import {
  cloneDeck,
  createEmptyDeck,
  DEFAULT_DECK_NAME,
} from '../models/createDeck'
import {
  getDeckBoardEntries,
  type Deck,
  type DeckCard,
  type DeckVisibility,
  type TrackedDeckBoard,
} from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { useUserPreferencesStore } from './userPreferences'
import type { DeckLegalityResult } from '../utils/deckLegality'
import { getCardIdentity } from '../utils/cardIdentity'
import {
  getColorIdentityViolations,
  isBasicLand,
  validateCardAddition,
} from '../utils/deckLegality'
import { validateCommanderPairing } from '../utils/commanderPairing'
import { guestDraftRepository } from '../repositories/localDeckRepository'
import type { DeckRepository } from '../repositories/deckRepository'

let activeDeckRepository: DeckRepository = guestDraftRepository

// defineStore() creates one shared source of deck-library state.
export const useDeckStore = defineStore('deck', {
  // State contains the values that components can read reactively.
  state: () => ({
    library: activeDeckRepository.loadLibrary(),
    rejectionMessage: '',
    previewCard: null as ScryfallCard | null,
    selectedPreviewCard: null as ScryfallCard | null,
    lastPreviewCard: null as ScryfallCard | null,
    saveSucceeded: null as boolean | null,
    storageMode: 'guest' as 'guest' | 'cloud',
  }),

  // Getters calculate convenient values from state without duplicating data.
  getters: {
    decks(state): Deck[] {
      return state.library.decks
    },

    activeDeckId(state): string | null {
      return state.library.activeDeckId
    },

    activeDeck(state): Deck | null {
      return (
        state.library.decks.find(
          (deck) => deck.id === state.library.activeDeckId,
        ) ?? null
      )
    },

    /**
     * Editor components only render after the builder guarantees an active
     * deck. Keeping this alias avoids passing the same deck through every
     * presentation component.
     */
    deck(): Deck {
      if (!this.activeDeck) {
        throw new Error('No active deck is available.')
      }

      return this.activeDeck
    },

    hasActiveDeck(): boolean {
      return this.activeDeck !== null
    },

    deckSummaries(state) {
      return state.library.decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        commanderName: deck.commander?.name ?? null,
        updatedAt: deck.updatedAt,
      }))
    },
  },

  // Actions are the store's named methods for changing its state.
  actions: {
    getNextAvailableDefaultName(): string {
      return getNextDefaultDeckName(
        this.library.decks.map((deck) => deck.name),
      )
    },

    createDeck(name?: string, creatorUsername = 'Guest'): Deck {
      const deckName = name?.trim() || this.getNextAvailableDefaultName()
      const deck = createEmptyDeck(
        deckName,
        creatorUsername,
        useUserPreferencesStore().values.defaultDeckVisibility,
      )
      if (this.storageMode === 'guest') {
        this.library.decks = [deck]
      } else {
        this.library.decks.push(deck)
      }
      this.library.activeDeckId = deck.id
      this.rejectionMessage = ''
      this.persistLibrary()
      return deck
    },

    addPreparedDeck(deck: Deck): Deck {
      if (this.storageMode === 'guest') {
        this.library.decks = [deck]
      } else {
        this.library.decks.push(deck)
      }
      this.library.activeDeckId = deck.id
      this.rejectionMessage = ''
      this.persistLibrary()
      return deck
    },

    openDeck(deckId: string): boolean {
      if (!this.library.decks.some((deck) => deck.id === deckId)) {
        return false
      }

      if (this.library.activeDeckId === deckId) {
        return true
      }

      this.library.activeDeckId = deckId
      this.rejectionMessage = ''
      this.persistLibrary()
      return true
    },

    renameDeck(deckId: string, name: string): boolean {
      const deck = this.library.decks.find((item) => item.id === deckId)
      const trimmedName = name.trim()

      if (!deck || !trimmedName) {
        return false
      }

      if (deck.name === trimmedName) {
        return true
      }

      deck.name = trimmedName
      deck.updatedAt = new Date().toISOString()
      this.persistLibrary()
      return true
    },

    updateDeckSettings(
      deckId: string,
      settings: {
        name: string
        description: string
        visibility: DeckVisibility
      },
    ): boolean {
      const deck = this.library.decks.find((item) => item.id === deckId)
      const name = settings.name.trim()
      if (!deck || !name || settings.description.length > 500) return false

      deck.name = name
      deck.description = settings.description
      deck.visibility = settings.visibility
      deck.updatedAt = new Date().toISOString()
      this.persistLibrary()
      return true
    },

    duplicateDeck(
      deckId: string,
      options?: {
        name?: string
        visibility?: DeckVisibility
        creatorUsername?: string
      },
    ): Deck | null {
      const source = this.library.decks.find((deck) => deck.id === deckId)
      if (!source) {
        return null
      }

      const duplicate = cloneDeck(
        source,
        options?.name,
        options?.visibility ?? 'unlisted',
        options?.creatorUsername ?? source.creatorUsername ?? 'Unknown',
      )
      if (this.storageMode === 'guest') {
        this.library.decks = [duplicate]
      } else {
        this.library.decks.push(duplicate)
      }
      this.library.activeDeckId = duplicate.id
      this.persistLibrary()
      return duplicate
    },

    copyExternalDeck(
      source: Deck,
      name: string,
      visibility: DeckVisibility = 'unlisted',
      creatorUsername = 'Guest',
    ): Deck {
      const duplicate = cloneDeck(source, name, visibility, creatorUsername)
      if (this.storageMode === 'guest') this.library.decks = [duplicate]
      else this.library.decks.push(duplicate)
      this.library.activeDeckId = duplicate.id
      this.persistLibrary()
      return duplicate
    },

    deleteDeck(deckId: string): boolean {
      const deckIndex = this.library.decks.findIndex(
        (deck) => deck.id === deckId,
      )
      if (deckIndex === -1) {
        return false
      }

      this.library.decks.splice(deckIndex, 1)

      if (this.library.activeDeckId === deckId) {
        this.library.activeDeckId = this.library.decks[0]?.id ?? null
      }

      this.rejectionMessage = ''
      this.persistLibrary()
      return true
    },

    setCommander(card: ScryfallCard) {
      this.deck.commander = card
      if (
        this.deck.partnerCommander &&
        !validateCommanderPairing(card, this.deck.partnerCommander).allowed
      ) {
        this.deck.partnerCommander = null
      }
      this.persistActiveDeck()
    },

    clearCommander() {
      if (!this.deck.commander) {
        return
      }

      this.deck.commander = null
      this.deck.partnerCommander = null
      this.persistActiveDeck()
    },

    setPartnerCommander(card: ScryfallCard): DeckLegalityResult {
      if (!this.deck.commander) {
        return {
          allowed: false,
          reason: 'Choose the first commander before choosing its partner.',
        }
      }

      const result = validateCommanderPairing(this.deck.commander, card)
      if (!result.allowed) {
        this.rejectionMessage =
          result.reason ?? 'Those commanders cannot be paired.'
        return result
      }

      this.deck.partnerCommander = card
      this.rejectionMessage = ''
      this.persistActiveDeck()
      return { allowed: true }
    },

    clearPartnerCommander() {
      if (!this.deck.partnerCommander) return
      this.deck.partnerCommander = null
      this.persistActiveDeck()
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
      this.persistActiveDeck()
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

        if (result.allowed && quantity > 1 && isBasicLand(card)) {
          const entry = findBoardEntry(this.deck.cards, card)
          if (entry) {
            entry.quantity += quantity - 1
            this.persistActiveDeck()
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
      this.persistActiveDeck()
      return { allowed: true }
    },

    removeCardFromBoard(identity: string, board: TrackedDeckBoard) {
      const entries = getDeckBoardEntries(this.deck, board)
      const remainingEntries = entries.filter(
        (entry) => getCardIdentity(entry.card) !== identity,
      )

      if (remainingEntries.length === entries.length) {
        return
      }

      if (board === 'mainboard') {
        this.deck.cards = remainingEntries
      } else {
        this.deck[board] = remainingEntries
      }

      this.rejectionMessage = ''
      this.persistActiveDeck()
    },

    increaseBoardQuantity(
      identity: string,
      board: TrackedDeckBoard,
      allowSingletonViolation = false,
    ): boolean {
      const entry = getDeckBoardEntries(this.deck, board).find(
        (item) => getCardIdentity(item.card) === identity,
      )

      if (
        !entry ||
        (
          board === 'mainboard' &&
          !isBasicLand(entry.card) &&
          !allowSingletonViolation
        )
      ) {
        return false
      }

      entry.quantity += 1
      this.persistActiveDeck()
      return true
    },

    clearRejectionMessage() {
      this.rejectionMessage = ''
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
      this.persistActiveDeck()
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

      const source = getDeckBoardEntries(this.deck, fromBoard)
      const remaining = source.filter(
        (entry) => getCardIdentity(entry.card) !== identity,
      )
      if (fromBoard === 'mainboard') {
        this.deck.cards = remaining
      } else {
        this.deck[fromBoard] = remaining
      }

      this.rejectionMessage = ''
      this.persistActiveDeck()
      return { allowed: true }
    },

    removeIllegalCards() {
      const illegalCards = getColorIdentityViolations(this.deck)
      if (!illegalCards.length) {
        return
      }

      this.deck.cards = this.deck.cards.filter(
        (deckCard) => !illegalCards.includes(deckCard),
      )
      this.rejectionMessage = ''
      this.persistActiveDeck()
    },

    resetActiveDeck() {
      const replacement = createEmptyDeck(
        this.deck.name,
        this.deck.creatorUsername ?? 'Unknown',
      )
      replacement.description = this.deck.description ?? ''
      replacement.visibility = this.deck.visibility ?? 'private'
      replacement.id = this.deck.id
      replacement.createdAt = this.deck.createdAt
      this.replaceActiveDeck(replacement)
    },

    replaceActiveDeck(deck: Deck) {
      const activeIndex = this.library.decks.findIndex(
        (item) => item.id === this.library.activeDeckId,
      )
      if (activeIndex === -1) {
        return
      }

      const current = this.library.decks[activeIndex]
      this.library.decks[activeIndex] = {
        ...deck,
        id: current.id,
        name: deck.name.trim() || current.name,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      }
      this.rejectionMessage = ''
      this.persistLibrary()
    },

    setPreviewCard(card: ScryfallCard) {
      this.previewCard = card
      if (!this.selectedPreviewCard) {
        this.lastPreviewCard = card
      }
    },

    selectPreviewCard(card: ScryfallCard) {
      if (
        this.selectedPreviewCard
        && getCardIdentity(this.selectedPreviewCard) === getCardIdentity(card)
      ) {
        this.selectedPreviewCard = null
        this.lastPreviewCard = card
        this.previewCard = card
        return
      }

      this.selectedPreviewCard = card
      this.lastPreviewCard = card
      this.previewCard = card
    },

    restoreSelectedPreviewCard() {
      this.previewCard = this.selectedPreviewCard ?? this.lastPreviewCard
    },

    clearPreviewCard() {
      this.selectedPreviewCard = null
      this.lastPreviewCard = this.activeDeck?.commander ?? null
      this.previewCard = this.lastPreviewCard
    },

    persistActiveDeck() {
      this.updateActiveDeckTimestamp()
      this.persistLibrary()
    },

    updateActiveDeckTimestamp() {
      this.deck.updatedAt = new Date().toISOString()
    },

    saveActiveDeck() {
      this.persistActiveDeck()
    },

    persistLibrary() {
      this.saveSucceeded = activeDeckRepository.saveLibrary(this.library)
    },

    useRepository(
      repository: DeckRepository,
      storageMode: 'guest' | 'cloud',
      library = repository.loadLibrary(),
    ) {
      activeDeckRepository = repository
      this.storageMode = storageMode
      this.library = library
      this.rejectionMessage = ''
      this.previewCard = null
      this.selectedPreviewCard = null
      this.lastPreviewCard = null
      this.saveSucceeded = null
    },

    replaceLibrary(library: typeof this.library) {
      this.library = library
      this.persistLibrary()
    },
  },
})

function getNextDefaultDeckName(existingNames: string[]): string {
  let highestSuffix = 0

  for (const name of existingNames) {
    if (name === DEFAULT_DECK_NAME) {
      highestSuffix = Math.max(highestSuffix, 1)
      continue
    }

    const match = name.match(/^Untitled Deck ([2-9]\d*)$/)
    if (match) {
      highestSuffix = Math.max(highestSuffix, Number(match[1]))
    }
  }

  return highestSuffix === 0
    ? DEFAULT_DECK_NAME
    : `${DEFAULT_DECK_NAME} ${highestSuffix + 1}`
}

function findBoardEntry(
  entries: DeckCard[],
  card: ScryfallCard,
): DeckCard | undefined {
  return entries.find(
    (entry) => getCardIdentity(entry.card) === getCardIdentity(card),
  )
}
