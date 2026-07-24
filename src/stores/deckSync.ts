import { defineStore } from 'pinia';

import { supabase } from '../lib/supabase';
import { DECK_LIBRARY_VERSION, type StoredDeckLibrary } from '../models/deckLibrary';
import { guestDraftRepository, memoryDeckRepository } from '../repositories/localDeckRepository';
import { createSupabaseDeckRepository } from '../repositories/supabaseDeckRepository';
import {
  clearLocalDecksAfterAccountTransfer,
  loadLocalDecksForAccountTransfer,
} from '../utils/deckStorage';

import { useDeckStore } from './deck';

import type { Deck } from '../models/deck';

export type SyncStatus = 'local-only' | 'syncing' | 'synced' | 'error';

let initializationPromise: Promise<void> | null = null;
let initializedUserId: string | null = null;
let sessionGeneration = 0;

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
        return initializationPromise;
      }
      if (initializedUserId === userId && this.userId === userId) {
        return;
      }

      const generation = ++sessionGeneration;
      this.userId = userId;
      const currentInitialization = this.initializeMode(userId, generation);
      initializationPromise = currentInitialization;
      try {
        await currentInitialization;
        if (generation === sessionGeneration) {
          initializedUserId = userId;
        }
      } finally {
        if (initializationPromise === currentInitialization) {
          initializationPromise = null;
        }
      }
    },

    async initializeMode(userId: string | null, generation: number) {
      const deckStore = useDeckStore();
      this.syncError = '';
      this.cloudDeckIds = [];

      if (!userId || !supabase) {
        deckStore.useRepository(guestDraftRepository, 'guest');
        this.syncStatus = 'local-only';
        this.needsInitializationRetry = false;
        return;
      }

      const localTransfer = loadLocalDecksForAccountTransfer();
      const localDecks = localTransfer.decks.filter(isMeaningfulGuestDraft);
      this.syncStatus = 'syncing';
      deckStore.useRepository(memoryDeckRepository, 'cloud');
      let loadedCloudDecks: Deck[] = [];

      try {
        const repository = createSupabaseDeckRepository(supabase, userId);
        let cloudDecks = await repository.loadDecks();
        loadedCloudDecks = cloudDecks;
        if (generation !== sessionGeneration) return;

        if (localDecks.length > 0) {
          this.transferringGuestDraft = true;
          const existingIds = new Set(cloudDecks.map((deck) => deck.id));
          const usedNames = new Set(cloudDecks.map((deck) => normalizeDeckTitle(deck.name)));
          for (const localDeck of localDecks) {
            if (!existingIds.has(localDeck.id)) {
              const uniqueName = getAvailableDeckTitle(localDeck.name, usedNames);
              usedNames.add(normalizeDeckTitle(uniqueName));
              await repository.saveDeck(
                uniqueName === localDeck.name ? localDeck : { ...localDeck, name: uniqueName },
              );
            }
          }
          cloudDecks = await repository.loadDecks();
          if (generation !== sessionGeneration) return;

          const confirmedIds = new Set(cloudDecks.map((deck) => deck.id));
          if (localDecks.every((deck) => confirmedIds.has(deck.id))) {
            clearLocalDecksAfterAccountTransfer();
          } else {
            throw new Error('Transferred local Decks were not confirmed.');
          }
        }

        this.cloudDeckIds = cloudDecks.map((deck) => deck.id);
        deckStore.useRepository(
          memoryDeckRepository,
          'cloud',
          createCloudLibrary(cloudDecks, localTransfer.preferredActiveId),
        );
        this.hasUnsyncedChanges = false;
        this.needsInitializationRetry = false;
        this.syncStatus = 'synced';
        this.lastSyncedAt = new Date().toISOString();
      } catch (error) {
        if (generation !== sessionGeneration) return;
        console.warn('Cloud deck initialization failed.', error);
        if (loadedCloudDecks.length > 0) {
          this.cloudDeckIds = loadedCloudDecks.map((deck) => deck.id);
          deckStore.useRepository(
            memoryDeckRepository,
            'cloud',
            createCloudLibrary(loadedCloudDecks, null),
          );
        }
        this.hasUnsyncedChanges = localDecks.length > 0;
        this.syncStatus = 'error';
        this.syncError = 'Unable to sync — your local Decks are still safe';
        this.needsInitializationRetry = true;
        initializedUserId = null;
      } finally {
        if (generation === sessionGeneration) {
          this.transferringGuestDraft = false;
        }
      }
    },

    async syncNow() {
      if (!this.userId || !supabase) return;
      const deckStore = useDeckStore();
      this.syncStatus = 'syncing';

      try {
        const repository = createSupabaseDeckRepository(supabase, this.userId);
        const currentIds = deckStore.decks.map((deck) => deck.id);
        for (const cloudId of this.cloudDeckIds) {
          if (!currentIds.includes(cloudId)) {
            await repository.deleteDeck(cloudId);
          }
        }
        for (const deck of deckStore.decks) {
          await repository.saveDeck(deck);
        }
        this.cloudDeckIds = currentIds;
        this.hasUnsyncedChanges = false;
        this.syncError = '';
        this.syncStatus = 'synced';
        this.lastSyncedAt = new Date().toISOString();
      } catch (error) {
        console.warn('Cloud deck synchronization failed.', error);
        this.hasUnsyncedChanges = true;
        this.syncStatus = 'error';
        this.syncError = 'Unable to sync';
      }
    },

    async retry() {
      if (this.needsInitializationRetry) {
        initializedUserId = null;
        await this.handleUser(this.userId);
      } else {
        await this.syncNow();
      }
    },
  },
});

export function isMeaningfulGuestDraft(deck: Deck): boolean {
  return (
    deck.commander !== null ||
    deck.name !== 'Untitled Deck' ||
    deck.cards.length > 0 ||
    deck.sideboard.length > 0 ||
    deck.maybeboard.length > 0 ||
    deck.considering.length > 0
  );
}

function createCloudLibrary(decks: Deck[], preferredActiveId: string | null): StoredDeckLibrary {
  return {
    version: DECK_LIBRARY_VERSION,
    decks,
    activeDeckId: decks.some((deck) => deck.id === preferredActiveId)
      ? preferredActiveId
      : (decks[0]?.id ?? null),
  };
}

function getAvailableDeckTitle(requestedName: string, usedNames: Set<string>): string {
  const baseName = requestedName.trim() || 'Untitled Deck';
  if (!usedNames.has(normalizeDeckTitle(baseName))) return baseName;

  let suffix = 2;
  while (usedNames.has(normalizeDeckTitle(`${baseName} ${suffix}`))) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

function normalizeDeckTitle(name: string) {
  return name.trim().toLocaleLowerCase();
}
