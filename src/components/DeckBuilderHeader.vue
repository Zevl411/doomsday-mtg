<template>
  <v-card border color="surface" rounded="lg" variant="flat">
    <v-card-text
      class="d-flex flex-wrap align-center justify-space-between ga-4"
    >
      <div>
        <div class="text-overline text-medium-emphasis">Active deck</div>
        <h1 class="text-h5 font-weight-bold">{{ deckStore.deck.name }}</h1>
      </div>
      <div class="d-flex flex-wrap ga-2">
        <v-btn
          :disabled="!canCompare"
          :title="compareTitle"
          :to="
            canCompare
              ? { name: 'deck-comparison', params: { deckId: deckStore.deck.id } }
              : undefined
          "
          variant="tonal"
        >
          Compare
        </v-btn>
        <v-btn :to="{ name: 'deck-library' }" variant="text">
          All decks
        </v-btn>
        <v-btn variant="outlined" @click="openRenameDialog">Rename</v-btn>
        <v-btn color="primary" variant="flat" @click="showNewDialog = true">
          New deck
        </v-btn>
      </div>
    </v-card-text>
  </v-card>

  <v-dialog v-model="showRenameDialog" max-width="480">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Rename deck</v-card-title>
      <v-card-text class="px-5">
        <v-text-field
          v-model="renameName"
          autofocus
          :error-messages="renameError"
          label="Deck name"
          @keyup.enter="renameDeck"
        />
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showRenameDialog = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="renameDeck">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showNewDialog" max-width="480">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Create a new deck?</v-card-title>
      <v-card-text class="px-5">
        Your current deck is already saved in the local library.
        <v-text-field
          v-model="newDeckName"
          class="mt-4"
          label="New deck name (optional)"
        />
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showNewDialog = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="createDeck">Create</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDeckStore } from '../stores/deck'

const deckStore = useDeckStore()
const showRenameDialog = ref(false)
const showNewDialog = ref(false)
const renameName = ref('')
const renameError = ref('')
const newDeckName = ref('')
const canCompare = computed(() =>
  Boolean(deckStore.deck.commander && deckStore.deck.cards.length),
)
const compareTitle = computed(() =>
  canCompare.value
    ? 'Compare this deck with tournament data'
    : 'Select a Commander and add a mainboard card to compare',
)

function openRenameDialog() {
  renameName.value = deckStore.deck.name
  renameError.value = ''
  showRenameDialog.value = true
}

function renameDeck() {
  if (!renameName.value.trim()) {
    renameError.value = 'Enter a deck name.'
    return
  }

  deckStore.renameDeck(deckStore.deck.id, renameName.value)
  showRenameDialog.value = false
}

function createDeck() {
  deckStore.createDeck(newDeckName.value.trim() || undefined)
  newDeckName.value = ''
  showNewDialog.value = false
}
</script>
