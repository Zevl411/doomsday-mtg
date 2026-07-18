import { defineStore } from 'pinia'
import {
  DECK_LIBRARY_VERSION,
  type StoredDeckLibrary,
} from '../models/deckLibrary'
import type { Deck } from '../models/deck'
import { supabase } from '../lib/supabase'
import { createSupabaseDeckRepository } from '../repositories/supabaseDeckRepository'
import {
  guestDraftRepository,
  memoryDeckRepository,
} from '../repositories/localDeckRepository'
import { useDeckStore } from './deck'

export type SyncStatus =
  | 'local-only'
  | 'syncing'
  | 'synced'
  | 'error'

let initializationPromise: Promise<void> | null = null
let initializedUserId: string | null = null
let sessionGeneration = 0

export const useDeckSyncStore = defineStore('deck-sync', {
  state: () => ({
    userId: null as string | null,
    syncStatus: 'local-only' as SyncStatus,
    lastSyncedAt: null as string | null,
    syncError: '',
    hasUnsyncedChanges: false,
    cloudDeckIds: [] as string[],
    transferringGuestDraft: false,
    needsInitializationRetry: false,
  }),

  actions: {
    async handleUser(userId: string | null) {
      if (initializationPromise && this.userId === userId) {
        return initializationPromise
      }
      if (initializedUserId === userId && this.userId === userId) {
        return
      }

      const generation = ++sessionGeneration
      this.userId = userId
      const currentInitialization = this.initializeMode(userId, generation)
      initializationPromise = currentInitialization
      try {
        await currentInitialization
        if (generation === sessionGeneration) {
          initializedUserId = userId
        }
      } finally {
        if (initializationPromise === currentInitialization) {
          initializationPromise = null
        }
      }
    },

    async initializeMode(userId: string | null, generation: number) {
      const deckStore = useDeckStore()
      this.syncError = ''
      this.cloudDeckIds = []

      if (!userId || !supabase) {
        deckStore.useRepository(guestDraftRepository, 'guest')
        if (!deckStore.hasActiveDeck) {
          deckStore.createDeck()
        }
        this.syncStatus = 'local-only'
        this.needsInitializationRetry = false
        return
      }

      const guestDraft = guestDraftRepository.loadLibrary().decks[0] ?? null
      this.syncStatus = 'syncing'
      deckStore.useRepository(memoryDeckRepository, 'cloud')
      let loadedCloudDecks: Deck[] = []

      try {
        const repository = createSupabaseDeckRepository(supabase, userId)
        let cloudDecks = await repository.loadDecks()
        loadedCloudDecks = cloudDecks
        if (generation !== sessionGeneration) return

        if (guestDraft && isMeaningfulGuestDraft(guestDraft)) {
          this.transferringGuestDraft = true
          await repository.saveDeck(guestDraft)
          cloudDecks = await repository.loadDecks()
          if (generation !== sessionGeneration) return

          if (cloudDecks.some((deck) => deck.id === guestDraft.id)) {
            guestDraftRepository.clearLibrary()
          } else {
            throw new Error('Transferred guest deck was not confirmed.')
          }
        }

        this.cloudDeckIds = cloudDecks.map((deck) => deck.id)
        deckStore.useRepository(
          memoryDeckRepository,
          'cloud',
          createCloudLibrary(cloudDecks, guestDraft?.id ?? null),
        )
        this.hasUnsyncedChanges = false
        this.needsInitializationRetry = false
        this.syncStatus = 'synced'
        this.lastSyncedAt = new Date().toISOString()
      } catch (error) {
        if (generation !== sessionGeneration) return
        console.warn('Cloud deck initialization failed.', error)
        if (loadedCloudDecks.length > 0) {
          this.cloudDeckIds = loadedCloudDecks.map((deck) => deck.id)
          deckStore.useRepository(
            memoryDeckRepository,
            'cloud',
            createCloudLibrary(loadedCloudDecks, null),
          )
        }
        this.hasUnsyncedChanges = Boolean(guestDraft)
        this.syncStatus = 'error'
        this.syncError = 'Unable to sync — your guest draft is still safe'
        this.needsInitializationRetry = true
        initializedUserId = null
      } finally {
        if (generation === sessionGeneration) {
          this.transferringGuestDraft = false
        }
      }
    },

    async syncNow() {
      if (!this.userId || !supabase) return
      const deckStore = useDeckStore()
      this.syncStatus = 'syncing'

      try {
        const repository = createSupabaseDeckRepository(supabase, this.userId)
        const currentIds = deckStore.decks.map((deck) => deck.id)
        for (const cloudId of this.cloudDeckIds) {
          if (!currentIds.includes(cloudId)) {
            await repository.deleteDeck(cloudId)
          }
        }
        for (const deck of deckStore.decks) {
          await repository.saveDeck(deck)
        }
        this.cloudDeckIds = currentIds
        this.hasUnsyncedChanges = false
        this.syncError = ''
        this.syncStatus = 'synced'
        this.lastSyncedAt = new Date().toISOString()
      } catch (error) {
        console.warn('Cloud deck synchronization failed.', error)
        this.hasUnsyncedChanges = true
        this.syncStatus = 'error'
        this.syncError = 'Unable to sync'
      }
    },

    async retry() {
      if (this.needsInitializationRetry) {
        initializedUserId = null
        await this.handleUser(this.userId)
      } else {
        await this.syncNow()
      }
    },
  },
})

export function isMeaningfulGuestDraft(deck: Deck): boolean {
  return (
    deck.commander !== null ||
    deck.name !== 'Untitled Deck' ||
    deck.cards.length > 0 ||
    deck.sideboard.length > 0 ||
    deck.maybeboard.length > 0 ||
    deck.considering.length > 0
  )
}

function createCloudLibrary(
  decks: Deck[],
  preferredActiveId: string | null,
): StoredDeckLibrary {
  return {
    version: DECK_LIBRARY_VERSION,
    decks,
    activeDeckId: decks.some((deck) => deck.id === preferredActiveId)
      ? preferredActiveId
      : decks[0]?.id ?? null,
  }
}
