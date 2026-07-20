<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Create a deck</v-card-title>
      <v-card-text class="px-5">
        <v-text-field
          v-model="title"
          autofocus
          label="Title"
          placeholder="Untitled Deck"
          variant="outlined"
        />
        <v-textarea
          v-model="description"
          class="mt-3"
          counter="500"
          label="Description"
          maxlength="500"
          rows="3"
          variant="outlined"
        />
        <v-select
          v-model="visibility"
          class="mt-3"
          :items="visibilityOptions"
          label="Visibility"
          variant="outlined"
        />

        <div class="mt-3 text-subtitle-1 font-weight-medium">
          Commander
        </div>
        <p class="mb-3 text-caption text-medium-emphasis">
          Optional when your pasted decklist identifies its Commander.
        </p>
        <CardSearch
          v-model="commanderQuery"
          clearable
          clear-on-select
          commander-only
          :selected-card="commander"
          :selected-card-ids="commander ? [commander.id] : []"
          @card-selected="selectCommander"
          @cleared="clearCommander"
        />

        <v-textarea
          v-model="importText"
          class="mt-4"
          label="Paste a decklist (optional)"
          placeholder="Paste a decklist from Moxfield, Archidekt, Arena, MTGO, or plaintext"
          rows="9"
          variant="outlined"
        />

        <v-alert
          v-if="errorMessage"
          class="mt-3"
          density="comfortable"
          type="error"
          variant="tonal"
        >
          {{ errorMessage }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn :disabled="isCreating" variant="text" @click="close">
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="isCreating"
          variant="flat"
          @click="create"
        >
          Create deck
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { createEmptyDeck } from '../models/createDeck'
import type { DeckVisibility } from '../models/deck'
import { prepareDeckImport } from '../services/deckImport'
import { useAuthStore } from '../stores/auth'
import { useDeckStore } from '../stores/deck'
import { useUserPreferencesStore } from '../stores/userPreferences'
import type { ScryfallCard } from '../types/card'
import CardSearch from './CardSearch.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [deckId: string]
}>()

const auth = useAuthStore()
const deckStore = useDeckStore()
const preferences = useUserPreferencesStore()
const title = ref('')
const description = ref('')
const visibility = ref<DeckVisibility>('public')
const commander = ref<ScryfallCard | null>(null)
const commanderQuery = ref('')
const importText = ref('')
const errorMessage = ref('')
const isCreating = ref(false)

const visibilityOptions = [
  { title: 'Private', value: 'private' },
  { title: 'Unlisted', value: 'unlisted' },
  { title: 'Public', value: 'public' },
]

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return
    title.value = ''
    description.value = ''
    visibility.value = preferences.values.defaultDeckVisibility
    commander.value = null
    commanderQuery.value = ''
    importText.value = ''
    errorMessage.value = ''
  },
)

function selectCommander(card: ScryfallCard) {
  commander.value = card
  commanderQuery.value = ''
}

function clearCommander() {
  commander.value = null
  commanderQuery.value = ''
}

function close() {
  emit('update:modelValue', false)
}

async function create() {
  const deckTitle =
    title.value.trim() || deckStore.getNextAvailableDefaultName()
  errorMessage.value = ''
  isCreating.value = true

  try {
    const draft = createEmptyDeck(
      deckTitle,
      auth.username,
      visibility.value,
    )
    draft.description = description.value
    draft.commander = commander.value

    const completed = importText.value.trim()
      ? (await prepareDeckImport(importText.value, draft)).deck
      : draft

    // Import preparation intentionally focuses on cards. Creation metadata
    // remains authoritative regardless of what was pasted.
    completed.name = deckTitle
    completed.description = description.value
    completed.visibility = visibility.value
    completed.creatorUsername = auth.username

    deckStore.addPreparedDeck(completed)
    emit('created', completed.id)
    close()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'The deck could not be created.'
  } finally {
    isCreating.value = false
  }
}
</script>
