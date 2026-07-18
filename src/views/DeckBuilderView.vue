<template>
  <v-row align="start">
    <v-col cols="12">
      <DeckBuilderHeader
        @export="importExport?.openExportDialog()"
        @import="importExport?.openImportDialog()"
      />
    </v-col>

    <v-col cols="12">
      <DeckImportExport ref="importExport" :show-controls="false" />
    </v-col>

    <v-col cols="12" md="6" lg="4">
      <CommanderPanel />
    </v-col>

    <v-col cols="12" md="6" lg="8">
      <DeckCardSearch @card-selected="addDeckCard($event, 'mainboard')" />
    </v-col>

    <v-col cols="12" lg="9">
      <DeckPanel />
    </v-col>

    <v-col class="preview-column" cols="12" lg="3">
      <CardPreview :card="deckStore.previewCard" />
    </v-col>
  </v-row>

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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CardPreview from '../components/CardPreview.vue'
import CommanderPanel from '../components/CommanderPanel.vue'
import DeckBuilderHeader from '../components/DeckBuilderHeader.vue'
import DeckCardSearch from '../components/DeckCardSearch.vue'
import DeckImportExport from '../components/DeckImportExport.vue'
import DeckPanel from '../components/DeckPanel.vue'
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
