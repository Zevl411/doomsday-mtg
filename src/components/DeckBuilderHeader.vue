<template>
  <v-card border color="surface" rounded="lg" variant="flat">
    <v-card-text class="d-flex flex-wrap align-start justify-space-between ga-4">
      <div class="flex-grow-1">
        <div class="d-flex flex-wrap align-center ga-2">
          <h1 class="text-h5 font-weight-bold">{{ deck.name }}</h1>
          <v-chip size="small" variant="outlined">{{ deck.visibility ?? 'private' }}</v-chip>
        </div>
        <p class="text-caption text-medium-emphasis">
          Created by {{ deck.creatorUsername ?? 'Unknown' }}
        </p>
        <p v-if="deck.description" class="mt-2 text-body-2">
          {{ deck.description }}
        </p>
      </div>
      <v-btn-group divided variant="outlined">
        <v-btn prepend-icon="mdi-cog" @click="openSettings">Settings</v-btn>
        <v-btn
          :disabled="!canCompare"
          prepend-icon="mdi-chart-line"
          :to="{ name: 'deck-comparison', params: { deckId: deck.id } }"
        >Compare</v-btn>
        <v-btn prepend-icon="mdi-content-copy" @click="openCopy">Copy</v-btn>
        <v-btn prepend-icon="mdi-import" @click="emit('import')">Import</v-btn>
        <v-btn prepend-icon="mdi-export" @click="emit('export')">Export</v-btn>
      </v-btn-group>
    </v-card-text>
  </v-card>

  <v-dialog v-model="showSettings" max-width="560">
    <v-card>
      <v-card-title>Edit deck settings</v-card-title>
      <v-card-text>
        <v-text-field v-model="settingsName" label="Deck name" />
        <v-textarea
          v-model="settingsDescription"
          counter="500"
          label="Description"
          maxlength="500"
        />
        <v-select
          v-model="settingsVisibility"
          :items="visibilityOptions"
          label="Visibility"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="showSettings = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="saveSettings">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showCopy" max-width="560">
    <v-card>
      <v-card-title>Copy deck</v-card-title>
      <v-card-text>
        <v-text-field v-model="copyName" label="Copy name" />
        <v-select
          v-model="copyVisibility"
          :items="visibilityOptions"
          label="Visibility"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="showCopy = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="copyDeck">
          Create copy
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DeckVisibility } from '../models/deck'
import { useDeckStore } from '../stores/deck'

const emit = defineEmits<{ import: []; export: [] }>()
const deckStore = useDeckStore()
const deck = computed(() => deckStore.deck)
const showSettings = ref(false)
const showCopy = ref(false)
const settingsName = ref('')
const settingsDescription = ref('')
const settingsVisibility = ref<DeckVisibility>('private')
const copyName = ref('')
const copyVisibility = ref<DeckVisibility>('unlisted')
const visibilityOptions = [
  { title: 'Private — only you can access it', value: 'private' },
  { title: 'Unlisted — anyone with the link can access it', value: 'unlisted' },
  { title: 'Public — visible and findable', value: 'public' },
]
const canCompare = computed(() => Boolean(deck.value.commander && deck.value.cards.length))

function openSettings() {
  settingsName.value = deck.value.name
  settingsDescription.value = deck.value.description ?? ''
  settingsVisibility.value = deck.value.visibility ?? 'private'
  showSettings.value = true
}
function saveSettings() {
  if (deckStore.updateDeckSettings(deck.value.id, {
    name: settingsName.value,
    description: settingsDescription.value,
    visibility: settingsVisibility.value,
  })) showSettings.value = false
}
function openCopy() {
  copyName.value =
    `${deck.value.name} (copied from ${deck.value.creatorUsername ?? 'Unknown'})`
  copyVisibility.value = 'unlisted'
  showCopy.value = true
}
function copyDeck() {
  const copy = deckStore.duplicateDeck(deck.value.id, {
    name: copyName.value,
    visibility: copyVisibility.value,
  })
  if (copy) showCopy.value = false
}
</script>
