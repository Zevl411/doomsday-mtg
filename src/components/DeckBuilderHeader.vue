<template>
  <v-card
    border
    class="deck-builder-header"
    :class="{
      'deck-builder-header--search-left':
        preferencesStore.values.deckBuilderSearchSide === 'left',
    }"
    color="surface-bright"
    rounded="lg"
    variant="flat"
  >
    <v-card-text class="deck-header-content pa-3">
      <div class="deck-header-summary">
        <div class="deck-header-title-row d-flex flex-wrap align-center ga-2">
          <h1 class="text-h4 font-weight-bold">{{ deck.name }}</h1>
          <span class="text-h5 text-medium-emphasis">|</span>
          <ColorIdentitySymbols :colors="deckColorIdentity" size="medium" />
        </div>
        <div
          class="
            deck-header-metadata
            d-flex flex-wrap align-center ga-2 mt-1
          "
        >
          <p class="text-caption text-medium-emphasis">
            Created by {{ deck.creatorUsername ?? 'Unknown' }}
          </p>
          <v-chip size="small" variant="outlined">
            {{ deck.visibility ?? 'private' }}
          </v-chip>
          <v-chip
            v-if="validitySeverity"
            class="validity-chip"
            :color="validitySeverity === 'error' ? 'error' : 'warning'"
            size="small"
            variant="outlined"
          >
            <svg
              aria-hidden="true"
              class="validity-icon mr-1"
              viewBox="0 0 24 24"
            >
              <path
                v-if="validitySeverity === 'error'"
                d="M7.1 2h9.8L22 7.1v9.8L16.9 22H7.1L2 16.9V7.1L7.1 2ZM11 6v8h2V6h-2Zm0 10v2h2v-2h-2Z"
              />
              <path
                v-else
                d="M12 2 1 21h22L12 2Zm-1 6h2v7h-2V8Zm0 9h2v2h-2v-2Z"
              />
            </svg>
            {{ validitySeverity === 'error' ? 'Error' : 'Warning' }}
            ({{ validityIssues.length }})
            <v-tooltip activator="parent" location="right" max-width="228">
              <div class="font-weight-bold mb-1">Deck validity issues</div>
              <ul class="pl-4">
                <li v-for="issue in validityIssues" :key="issue.message">
                  {{ issue.message }}
                </li>
              </ul>
            </v-tooltip>
          </v-chip>
        </div>
        <v-sheet
          v-if="deck.description"
          border
          class="description-box mt-2 pa-2 text-body-2"
          color="transparent"
          rounded="lg"
        >
          {{ deck.description }}
        </v-sheet>
      </div>
      <div class="deck-header-tools">
        <v-btn-group class="deck-header-actions" divided variant="outlined">
          <v-btn @click="openSettings">
            <DeckActionIcon name="settings" />Settings
          </v-btn>
          <v-btn
            :disabled="!canCompare"
            :to="{ name: 'deck-comparison', params: { deckId: deck.id } }"
          ><DeckActionIcon name="compare" />Compare</v-btn>
          <v-btn @click="openCopy">
            <DeckActionIcon name="copy" />Copy
          </v-btn>
          <v-btn @click="emit('import')">
            <DeckActionIcon name="import" />Import
          </v-btn>
          <v-btn @click="emit('export')">
            <DeckActionIcon name="export" />Export
          </v-btn>
        </v-btn-group>
        <div class="deck-header-searches mt-auto">
          <slot name="searches" />
        </div>
      </div>
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
        <v-btn color="error" variant="text" @click="openDeleteConfirmation">
          Delete deck
        </v-btn>
        <v-spacer />
        <v-btn @click="showSettings = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="saveSettings">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showDeleteConfirmation" max-width="480">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Delete this deck?</v-card-title>
      <v-card-text class="px-5">
        This permanently removes “{{ deck.name }}”
        {{ auth.isSignedIn ? 'from your account' : 'from this browser' }}.
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showDeleteConfirmation = false">
          Cancel
        </v-btn>
        <v-btn color="error" variant="flat" @click="deleteDeck">
          Delete
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showCopy" max-width="560">
    <v-card>
      <v-card-title>Copy deck</v-card-title>
      <v-card-text>
        <v-alert
          v-if="validityIssues.length"
          class="mb-4"
          :type="validitySeverity === 'error' ? 'error' : 'warning'"
          variant="tonal"
        >
          This deck currently has {{ validityIssues.length }}
          {{ validityIssues.length === 1 ? 'validity issue' : 'validity issues' }}.
          The copy will still be created and saved.
          <ul class="mt-2 pl-5">
            <li v-for="issue in validityIssues" :key="`${issue.rule}-${issue.message}`">
              {{ issue.message }}
            </li>
          </ul>
        </v-alert>
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
import { useRouter } from 'vue-router'
import type { DeckVisibility } from '../models/deck'
import { useAuthStore } from '../stores/auth'
import { useDeckStore } from '../stores/deck'
import { useUserPreferencesStore } from '../stores/userPreferences'
import ColorIdentitySymbols from './ColorIdentitySymbols.vue'
import DeckActionIcon from './DeckActionIcon.vue'
import {
  getDeckValidityIssues,
  getDeckValiditySeverity,
} from '../utils/deckValidity'

const emit = defineEmits<{ import: []; export: [] }>()
const deckStore = useDeckStore()
const preferencesStore = useUserPreferencesStore()
const auth = useAuthStore()
const router = useRouter()
// Deletion clears the active Deck immediately, while route navigation finishes
// on the next render. Keep the current object long enough for that transition.
const currentDeck = ref(deckStore.deck)
const deck = computed(() => deckStore.activeDeck ?? currentDeck.value)
const showSettings = ref(false)
const showDeleteConfirmation = ref(false)
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
const canCompare = computed(() => Boolean(deck.value.commander))
const deckColorIdentity = computed(() => [
  ...new Set([
    ...(deck.value.commander?.color_identity ?? []),
    ...(deck.value.partnerCommander?.color_identity ?? []),
  ]),
])
const validityIssues = computed(() => getDeckValidityIssues(deck.value))
const validitySeverity = computed(() =>
  getDeckValiditySeverity(validityIssues.value),
)

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
function openDeleteConfirmation() {
  showSettings.value = false
  showDeleteConfirmation.value = true
}
function deleteDeck() {
  const deleted = deckStore.deleteDeck(deck.value.id)
  showDeleteConfirmation.value = false
  if (deleted) void router.push({ name: 'deck-library' })
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

<style scoped>
.deck-header-content {
  display: grid;
  gap: 12px 24px;
  grid-template-columns: minmax(280px, 1fr) minmax(520px, 620px);
}

.deck-builder-header {
  overflow: visible;
  position: relative;
  z-index: 100;
}

.deck-header-summary {
  min-width: 0;
}

.deck-header-tools {
  align-items: end;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-self: end;
  min-width: 0;
  width: 100%;
}

.deck-builder-header--search-left .deck-header-summary {
  grid-column: 2;
  grid-row: 1;
  text-align: right;
}

.deck-builder-header--search-left .deck-header-title-row,
.deck-builder-header--search-left .deck-header-metadata {
  justify-content: flex-end;
}

.deck-builder-header--search-left .deck-header-content {
  grid-template-columns: minmax(520px, 620px) minmax(280px, 1fr);
}

.deck-builder-header--search-left .deck-header-tools {
  grid-column: 1;
  grid-row: 1;
  justify-self: start;
}

.deck-header-actions {
  width: 100%;
}

.deck-header-actions :deep(.v-btn) {
  flex: 1 1 auto;
}

.deck-header-searches {
  width: 100%;
}

/* Search pages reserve room to avoid jumping as results load. Inside the
 * compact builder header that reservation becomes a large empty footer. */
.deck-header-searches :deep(.search-results) {
  min-height: 0;
}

.description-box {
  max-width: 620px;
}

.validity-icon {
  fill: currentColor;
  height: 17px;
  width: 17px;
}

.validity-chip {
  flex: 0 0 auto;
}

@media (max-width: 1100px) {
  .deck-header-content {
    grid-template-columns: 1fr;
  }

  .deck-header-tools {
    align-items: stretch;
    justify-self: stretch;
  }

  .deck-builder-header--search-left .deck-header-summary,
  .deck-builder-header--search-left .deck-header-tools {
    grid-column: 1;
    grid-row: auto;
  }

  .deck-builder-header--search-left .deck-header-content {
    grid-template-columns: 1fr;
  }
}
</style>
