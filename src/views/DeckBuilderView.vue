<template>
  <div class="deck-builder-page">
  <v-row align="start">
    <v-col cols="12">
      <DeckBuilderHeader
        @export="importExport?.openExportDialog()"
        @import="importExport?.openImportDialog()"
      >
        <template #searches>
          <v-row align="start" dense>
            <v-col cols="12" md="6">
              <CommanderPanel search-only />
            </v-col>
            <v-col cols="12" md="6">
              <DeckCardSearch
                embedded
                @card-selected="addDeckCard($event, 'mainboard')"
              />
            </v-col>
          </v-row>
        </template>
      </DeckBuilderHeader>
    </v-col>

  </v-row>

  <div class="builder-workspace">
    <div class="workspace-commander d-flex">
      <CommanderPanel display-only />
    </div>

    <div class="workspace-statistics d-flex">
      <DeckStatisticsPanel />
    </div>

    <div class="workspace-deck">
      <DeckPanel />
    </div>

    <div class="workspace-preview">
      <CardPreview :card="deckStore.previewCard" />
    </div>
  </div>

  <DeckImportExport ref="importExport" :show-controls="false" />

  <v-dialog
    :model-value="showIllegalCardDialog"
    max-width="520"
    @update:model-value="handleConfirmationVisibility"
  >
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">
        {{
          validationCanBeOverridden
            ? 'Add an illegal card?'
            : 'Card cannot be added'
        }}
      </v-card-title>
      <v-card-text class="px-5">
        <p>{{ pendingIllegalReason }}</p>
        <p
          v-if="validationCanBeOverridden"
          class="mt-3 text-medium-emphasis"
        >
          Adding it will flag the deck as invalid until the card is removed or
          the Commander changes.
        </p>
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="cancelIllegalCard">
          {{ validationCanBeOverridden ? 'Cancel' : 'Close' }}
        </v-btn>
        <v-btn
          v-if="validationCanBeOverridden"
          color="error"
          variant="flat"
          @click="confirmIllegalCard"
        >
          Add anyway
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import CardPreview from '../components/CardPreview.vue'
import CommanderPanel from '../components/CommanderPanel.vue'
import DeckBuilderHeader from '../components/DeckBuilderHeader.vue'
import DeckCardSearch from '../components/DeckCardSearch.vue'
import DeckImportExport from '../components/DeckImportExport.vue'
import DeckPanel from '../components/DeckPanel.vue'
import DeckStatisticsPanel from '../components/DeckStatisticsPanel.vue'
import { useDeckStore } from '../stores/deck'
import { useAuthStore } from '../stores/auth'
import type { TrackedDeckBoard } from '../models/deck'
import type { ScryfallCard } from '../types/card'

const deckStore = useDeckStore()
const auth = useAuthStore()
const importExport = ref<InstanceType<typeof DeckImportExport> | null>(null)
// Opening the builder directly creates a first local deck when the library is
// empty. Returning later reuses the active deck held by Pinia.
if (!deckStore.hasActiveDeck) {
  deckStore.createDeck(undefined, auth.username)
}
watch(
  () => deckStore.deck.id,
  () => {
    deckStore.clearPreviewCard()
    if (!deckStore.previewCard && deckStore.deck.commander) {
      deckStore.setPreviewCard(deckStore.deck.commander)
    }
  },
  { immediate: true },
)
const pendingIllegalCard = ref<ScryfallCard | null>(null)
const pendingIllegalReason = ref('')
const showIllegalCardDialog = ref(false)
const validationCanBeOverridden = ref(false)

function addDeckCard(card: ScryfallCard, board: TrackedDeckBoard) {
  const result = deckStore.addCardToBoard(card, board)

  if (!result.allowed) {
    // Selecting an already-present search result is intentionally a quiet
    // no-op. Quantity overrides require the explicit plus-button workflow.
    if (result.rule === 'duplicate') {
      deckStore.clearRejectionMessage()
      return
    }

    pendingIllegalCard.value = result.overridable ? card : null
    pendingIllegalReason.value =
      result.reason ?? 'That card cannot be added to this deck.'
    validationCanBeOverridden.value = result.overridable ?? false
    showIllegalCardDialog.value = true
  }
}

function confirmIllegalCard() {
  const card = pendingIllegalCard.value

  closeIllegalCardDialog()

  if (card) {
    deckStore.addCard(card, true)
  }
}

function cancelIllegalCard() {
  closeIllegalCardDialog()
}

function handleConfirmationVisibility(isOpen: boolean) {
  if (isOpen) {
    showIllegalCardDialog.value = true
  } else {
    closeIllegalCardDialog()
  }
}

function closeIllegalCardDialog() {
  showIllegalCardDialog.value = false
  pendingIllegalCard.value = null
  pendingIllegalReason.value = ''
  validationCanBeOverridden.value = false
}
</script>

<style scoped>
.deck-builder-page :deep(.v-field),
.deck-builder-page :deep(.v-btn-group .v-btn) {
  background: color-mix(
    in srgb,
    rgb(var(--v-theme-background)) 40%,
    rgb(var(--v-theme-surface)) 60%
  );
}

@media (min-width: 1280px) {
  .builder-workspace {
    display: grid;
    gap: 16px;
    grid-template-columns: 3fr 6fr 3fr;
    margin-top: 16px;
  }

  .workspace-commander {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
  }

  .workspace-statistics {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }

  .workspace-deck {
    grid-column: 1 / 3;
    grid-row: 2;
  }

  .workspace-preview {
    align-self: start;
    grid-column: 3;
    grid-row: 1 / span 2;
    max-height: calc(100vh - 116px);
    overflow-y: auto;
    position: sticky;
    top: 100px;
  }

  .workspace-preview :deep(.preview-panel) {
    width: 100%;
  }
}

@media (max-width: 1279px) {
  .builder-workspace {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
  }
}
</style>
