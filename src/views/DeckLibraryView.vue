<template>
  <section>
    <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">Your decks</h1>
        <p class="text-medium-emphasis">
          Create and manage decks saved in this browser.
        </p>
      </div>
      <v-btn color="primary" size="large" @click="openCreateDialog">
        New deck
      </v-btn>
    </div>

    <v-row v-if="deckStore.library.decks.length">
      <v-col
        v-for="deck in decksByRecentUpdate"
        :key="deck.id"
        cols="12"
        md="6"
        lg="4"
      >
        <DeckLibraryCard
          :active="deck.id === deckStore.library.activeDeckId"
          :deck="deck"
          @delete="openDeleteDialog"
          @duplicate="deckStore.duplicateDeck"
          @open="openDeck"
          @rename="openRenameDialog"
        />
      </v-col>
    </v-row>

    <v-card v-else border class="pa-8 text-center" color="surface" rounded="lg">
      <v-card-title>No decks yet</v-card-title>
      <v-card-text>
        Create your first local deck to start building.
      </v-card-text>
      <v-btn color="primary" @click="openCreateDialog">
        Create a deck
      </v-btn>
    </v-card>

    <v-dialog v-model="showNameDialog" max-width="480">
      <v-card color="surface" rounded="lg">
        <v-card-title class="px-5 pt-5">
          {{ editingDeckId ? 'Rename deck' : 'Create deck' }}
        </v-card-title>
        <v-card-text class="px-5">
          <v-text-field
            v-model="deckName"
            autofocus
            :error-messages="nameError"
            label="Deck name"
            @keyup.enter="submitName"
          />
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="showNameDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="submitName">
            {{ editingDeckId ? 'Save' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showDeleteDialog" max-width="480">
      <v-card color="surface" rounded="lg">
        <v-card-title class="px-5 pt-5">Delete this deck?</v-card-title>
        <v-card-text class="px-5">
          This permanently removes “{{ deletingDeck?.name }}” from this browser.
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete">
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import DeckLibraryCard from '../components/DeckLibraryCard.vue'
import { useDeckStore } from '../stores/deck'

const deckStore = useDeckStore()
const router = useRouter()
const showNameDialog = ref(false)
const showDeleteDialog = ref(false)
const editingDeckId = ref<string | null>(null)
const deletingDeckId = ref<string | null>(null)
const deckName = ref('')
const nameError = ref('')

const decksByRecentUpdate = computed(() =>
  [...deckStore.library.decks].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  ),
)
const deletingDeck = computed(() =>
  deckStore.library.decks.find(
    (deck) => deck.id === deletingDeckId.value,
  ),
)

function openCreateDialog() {
  editingDeckId.value = null
  deckName.value = ''
  nameError.value = ''
  showNameDialog.value = true
}

function openRenameDialog(deckId: string) {
  const deck = deckStore.library.decks.find((item) => item.id === deckId)
  if (!deck) return

  editingDeckId.value = deckId
  deckName.value = deck.name
  nameError.value = ''
  showNameDialog.value = true
}

function submitName() {
  const trimmedName = deckName.value.trim()
  if (editingDeckId.value && !trimmedName) {
    nameError.value = 'Enter a deck name.'
    return
  }

  if (editingDeckId.value) {
    deckStore.renameDeck(editingDeckId.value, trimmedName)
  } else {
    deckStore.createDeck(trimmedName || undefined)
    router.push({ name: 'deck-builder' })
  }
  showNameDialog.value = false
}

function openDeck(deckId: string) {
  if (deckStore.openDeck(deckId)) {
    router.push({ name: 'deck-builder' })
  }
}

function openDeleteDialog(deckId: string) {
  deletingDeckId.value = deckId
  showDeleteDialog.value = true
}

function confirmDelete() {
  if (deletingDeckId.value) {
    deckStore.deleteDeck(deletingDeckId.value)
  }
  showDeleteDialog.value = false
  deletingDeckId.value = null
}
</script>
