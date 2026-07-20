<template>
  <v-container class="pa-0" fluid>
    <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">Your decks</h1>
        <p class="text-medium-emphasis">
          {{ libraryDescription }}
        </p>
      </div>
      <div class="d-flex flex-wrap ga-2">
        <v-btn
          :color="selectionMode ? undefined : 'secondary'"
          size="large"
          :variant="selectionMode ? 'text' : 'tonal'"
          @click="toggleSelectionMode"
        >
          {{ selectionMode ? 'Cancel selection' : 'Select decks' }}
        </v-btn>
        <v-btn
          v-if="selectionMode"
          color="primary"
          :disabled="selectedDeckIds.size === 0"
          size="large"
          variant="tonal"
          @click="openBulkVisibilityDialog"
        >
          Change visibility ({{ selectedDeckIds.size }})
        </v-btn>
        <v-btn
          v-if="selectionMode"
          color="error"
          :disabled="selectedDeckIds.size === 0"
          size="large"
          variant="tonal"
          @click="showBulkDeleteDialog = true"
        >
          Delete selected ({{ selectedDeckIds.size }})
        </v-btn>
        <v-btn
          v-else
          color="primary"
          size="large"
          @click="openCreateDialog"
        >
          New deck
        </v-btn>
      </div>
    </div>

    <v-alert
      v-if="admin.isAdmin"
      class="mb-5"
      :color="sync.syncStatus === 'error' ? 'error' : 'info'"
      variant="tonal"
    >
      <div class="d-flex flex-wrap align-center justify-space-between ga-3">
        <span>{{ syncLabel }}</span>
        <v-btn
          v-if="sync.syncStatus === 'error'"
          size="small"
          variant="outlined"
          @click="sync.retry"
        >
          Retry sync
        </v-btn>
      </div>
    </v-alert>

    <v-row v-if="deckStore.library.decks.length">
      <v-col
        v-for="deck in decksByRecentUpdate"
        :key="deck.id"
        cols="12"
        md="6"
        lg="4"
      >
        <DeckLibraryCard
          :can-compare="Boolean(deck.commander)"
          :deck="deck"
          :selectable="selectionMode"
          :selected="selectedDeckIds.has(deck.id)"
          @compare="compareDeck"
          @delete="openDeleteDialog"
          @duplicate="deckStore.duplicateDeck"
          @open="openDeck"
          @rename="openRenameDialog"
          @toggle-selection="toggleDeckSelection"
        />
      </v-col>
    </v-row>

    <v-card v-else border class="pa-8 text-center" color="surface" rounded="lg">
      <v-card-title>No decks yet</v-card-title>
      <v-card-text>
        Create your first deck to start building.
      </v-card-text>
      <v-btn color="primary" @click="openCreateDialog">
        Create a deck
      </v-btn>
    </v-card>

    <DeckCreationDialog
      v-model="showCreateDialog"
      @created="openCreatedDeck"
    />

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
          This permanently removes “{{ deletingDeck?.name }}”
          {{ auth.isSignedIn ? 'from your account' : 'from this browser' }}.
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

    <v-dialog v-model="showBulkDeleteDialog" max-width="480">
      <v-card color="surface" rounded="lg">
        <v-card-title class="px-5 pt-5">
          Delete {{ selectedDeckIds.size }} decks?
        </v-card-title>
        <v-card-text class="px-5">
          This permanently removes the selected decks
          {{ auth.isSignedIn ? 'from your account' : 'from this browser' }}.
          <v-list
            class="bulk-delete-list mt-4"
            density="compact"
            lines="one"
          >
            <v-list-item
              v-for="deck in selectedDecks"
              :key="deck.id"
              :title="deck.name"
            >
              <template #prepend>
                <span aria-hidden="true" class="mr-3 text-error">•</span>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="showBulkDeleteDialog = false">
            Cancel
          </v-btn>
          <v-btn color="error" variant="flat" @click="confirmBulkDelete">
            Delete decks
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showBulkVisibilityDialog" max-width="480">
      <v-card color="surface" rounded="lg">
        <v-card-title class="px-5 pt-5">
          Change visibility for {{ selectedDeckIds.size }} decks
        </v-card-title>
        <v-card-text class="px-5">
          <v-select
            v-model="bulkVisibility"
            :items="visibilityOptions"
            label="Visibility"
            variant="outlined"
          />
          <p class="text-caption text-medium-emphasis">
            This setting will replace the current visibility of every selected
            deck.
          </p>
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="showBulkVisibilityDialog = false">
            Cancel
          </v-btn>
          <v-btn color="primary" variant="flat" @click="confirmBulkVisibility">
            Apply visibility
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import DeckLibraryCard from '../components/DeckLibraryCard.vue'
import DeckCreationDialog from '../components/DeckCreationDialog.vue'
import { useDeckStore } from '../stores/deck'
import { useDeckSyncStore } from '../stores/deckSync'
import { useAuthStore } from '../stores/auth'
import { useAdminStore } from '../stores/admin'
import type { DeckVisibility } from '../models/deck'

const deckStore = useDeckStore()
const sync = useDeckSyncStore()
const auth = useAuthStore()
const admin = useAdminStore()
const router = useRouter()
const showCreateDialog = ref(false)
const showNameDialog = ref(false)
const showDeleteDialog = ref(false)
const showBulkDeleteDialog = ref(false)
const showBulkVisibilityDialog = ref(false)
const bulkVisibility = ref<DeckVisibility>('public')
const selectionMode = ref(false)
const selectedDeckIds = ref(new Set<string>())
const editingDeckId = ref<string | null>(null)
const deletingDeckId = ref<string | null>(null)
const deckName = ref('')
const nameError = ref('')
const visibilityOptions: Array<{
  title: string
  value: DeckVisibility
}> = [
  { title: 'Private', value: 'private' },
  { title: 'Unlisted', value: 'unlisted' },
  { title: 'Public', value: 'public' },
]
const libraryDescription = computed(() =>
  auth.isSignedIn
    ? 'Create and manage decks saved to your account.'
    : 'Build one temporary draft saved in this browser.',
)
const syncLabel = computed(() => {
  if (!auth.isSignedIn) return 'Saved as a temporary browser draft'
  if (sync.transferringGuestDraft) {
    return 'Saving your current deck to your account…'
  }
  if (sync.syncStatus === 'syncing') return 'Saving…'
  if (sync.syncStatus === 'error') return sync.syncError
  return sync.syncStatus === 'synced' ? 'Synced' : 'Cloud sync ready'
})

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
const selectedDecks = computed(() =>
  decksByRecentUpdate.value.filter(
    (deck) => selectedDeckIds.value.has(deck.id),
  ),
)

function openCreateDialog() {
  showCreateDialog.value = true
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  selectedDeckIds.value = new Set()
}

function toggleDeckSelection(deckId: string) {
  const nextSelection = new Set(selectedDeckIds.value)
  if (nextSelection.has(deckId)) {
    nextSelection.delete(deckId)
  } else {
    nextSelection.add(deckId)
  }
  selectedDeckIds.value = nextSelection
}

function openCreatedDeck(deckId: string) {
  void router.push({ name: 'deck-builder', params: { deckId } })
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
  }
  showNameDialog.value = false
}

function openDeck(deckId: string) {
  if (deckStore.openDeck(deckId)) {
    router.push({ name: 'deck-builder', params: { deckId } })
  }
}

function compareDeck(deckId: string) {
  void router.push({
    name: 'deck-comparison',
    params: { deckId },
  })
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

function confirmBulkDelete() {
  deckStore.deleteDecks([...selectedDeckIds.value])
  showBulkDeleteDialog.value = false
  selectionMode.value = false
  selectedDeckIds.value = new Set()
}

function openBulkVisibilityDialog() {
  const selectedVisibility = selectedDecks.value[0]?.visibility
  const allMatch = selectedDecks.value.every(
    (deck) => deck.visibility === selectedVisibility,
  )
  bulkVisibility.value = allMatch && selectedVisibility
    ? selectedVisibility
    : 'public'
  showBulkVisibilityDialog.value = true
}

function confirmBulkVisibility() {
  deckStore.updateDeckVisibilities(
    [...selectedDeckIds.value],
    bulkVisibility.value,
  )
  showBulkVisibilityDialog.value = false
  selectionMode.value = false
  selectedDeckIds.value = new Set()
}
</script>

<style scoped>
.bulk-delete-list {
  background: rgb(var(--v-theme-surface-light));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  max-height: 240px;
  overflow-y: auto;
}
</style>
