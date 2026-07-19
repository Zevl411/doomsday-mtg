<template>
  <div v-if="deckStore.hasActiveDeck" class="deck-builder-page">
  <v-row align="start">
    <v-col cols="12">
      <DeckBuilderHeader
        @export="importExport?.openExportDialog()"
        @import="importExport?.openImportDialog()"
      >
        <template #searches>
          <v-row align="start" dense>
            <v-col cols="12">
              <CommanderPanel search-only />
            </v-col>
          </v-row>
        </template>
      </DeckBuilderHeader>
    </v-col>

  </v-row>

  <div class="builder-workspace">
    <div
      class="workspace-commander d-flex"
      :class="{ 'workspace-commander--paired': showPartnerPanel }"
    >
      <div class="workspace-commander-slot">
        <CommanderPanel
          :compact-display="showPartnerPanel"
          display-only
        />
      </div>
      <div v-if="showPartnerPanel" class="workspace-commander-slot">
        <CommanderPanel
          compact-display
          display-only
          display-target="partner"
        />
      </div>
    </div>

    <div class="workspace-statistics d-flex">
      <DeckStatisticsPanel />
    </div>

    <div class="workspace-deck">
      <DeckPanel @card-selected="addDeckCard" />
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
  <v-card v-else border class="pa-8 text-center" color="surface" rounded="lg">
    <v-card-title>No deck selected</v-card-title>
    <v-card-text>
      Create a deck before opening the deck builder.
    </v-card-text>
    <v-btn color="primary" :to="{ name: 'deck-library' }">
      View decks
    </v-btn>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CardPreview from '../components/CardPreview.vue'
import CommanderPanel from '../components/CommanderPanel.vue'
import DeckBuilderHeader from '../components/DeckBuilderHeader.vue'
import DeckImportExport from '../components/DeckImportExport.vue'
import DeckPanel from '../components/DeckPanel.vue'
import DeckStatisticsPanel from '../components/DeckStatisticsPanel.vue'
import { useDeckStore } from '../stores/deck'
import type { TrackedDeckBoard } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { canHavePartner } from '../utils/commanderPairing'

const deckStore = useDeckStore()
const showPartnerPanel = computed(() =>
  Boolean(
    deckStore.deck.commander
    && canHavePartner(deckStore.deck.commander),
  ),
)
const importExport = ref<InstanceType<typeof DeckImportExport> | null>(null)
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
const pendingIllegalBoard = ref<TrackedDeckBoard>('mainboard')
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
    pendingIllegalBoard.value = board
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
    deckStore.addCardToBoard(card, pendingIllegalBoard.value, 1, true)
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
  pendingIllegalBoard.value = 'mainboard'
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

.workspace-commander--paired {
  flex-direction: column;
  gap: 16px;
}

.workspace-commander {
  position: relative;
  z-index: 40;
}

.workspace-commander-slot {
  display: flex;
  min-height: 0;
  width: 100%;
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

  .workspace-commander--paired {
    height: 530px;
  }

  .workspace-commander--paired .workspace-commander-slot {
    flex: 1 1 0;
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
