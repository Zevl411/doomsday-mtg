<template>
  <v-row align="start">
    <v-col cols="12" lg="4">
      <SearchPanel />
    </v-col>

    <v-col cols="12" sm="6" lg="2">
      <CommanderPanel />
    </v-col>

    <v-col cols="12" sm="6" lg="3">
      <DeckPanel @card-selected="addDeckCard" />
    </v-col>

    <v-col cols="12" lg="3">
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
import DeckPanel from '../components/DeckPanel.vue'
import SearchPanel from '../components/SearchPanel.vue'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'

const deckStore = useDeckStore()
const pendingIllegalCard = ref<ScryfallCard | null>(null)
const pendingIllegalReason = ref('')
const showIllegalCardDialog = ref(false)
const validationCanBeOverridden = ref(false)

function addDeckCard(card: ScryfallCard) {
  const result = deckStore.addCard(card)

  if (!result.allowed) {
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
