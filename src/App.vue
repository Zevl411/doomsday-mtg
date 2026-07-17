<template>
  <DefaultLayout>
    <v-row align="start">
      <v-col cols="12" lg="4">
        <SearchPanel
          @card-hovered="previewCard"
          @card-selected="selectCommander"
        />
      </v-col>

      <v-col cols="12" sm="6" lg="2">
        <CommanderPanel
          :commander="deck.commander"
          @clear-commander="clearCommander"
        />
      </v-col>

      <v-col cols="12" sm="6" lg="3">
        <DeckPanel
          :deck="deck"
          @card-hovered="previewCard"
          @card-selected="addDeckCard"
          @decrease-quantity="decreaseCardQuantity"
          @increase-quantity="increaseCardQuantity"
          @remove-card="removeDeckCard"
          @remove-illegal-cards="removeIllegalCards"
        />
      </v-col>

      <v-col cols="12" lg="3">
        <CardPreview :card="previewedCard" />
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
            Adding it will flag the deck as invalid until the card is removed
            or the Commander changes.
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
  </DefaultLayout>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import CardPreview from './components/CardPreview.vue'
import CommanderPanel from './components/CommanderPanel.vue'
import DeckPanel from './components/DeckPanel.vue'
import SearchPanel from './components/SearchPanel.vue'
import DefaultLayout from './layouts/DefaultLayout.vue'
import type { Deck } from './models/deck'
import type { ScryfallCard } from './types/card'
import {
  getColorIdentityViolations,
  isBasicLand,
  validateCardAddition,
} from './utils/deckLegality'

// reactive() keeps these related deck properties together and updates the UI
// when any property on the object changes.
const deck = reactive<Deck>({
  commander: null,
  cards: [],
  name: 'Untitled Deck',
})
const previewedCard = ref<ScryfallCard | null>(null)
const pendingIllegalCard = ref<ScryfallCard | null>(null)
const pendingIllegalReason = ref('')
const showIllegalCardDialog = ref(false)
const validationCanBeOverridden = ref(false)

function selectCommander(card: ScryfallCard) {
  deck.commander = card
}

function clearCommander() {
  deck.commander = null
}

function previewCard(card: ScryfallCard) {
  previewedCard.value = card
}

function addDeckCard(card: ScryfallCard) {
  const result = validateCardAddition(card, deck)

  if (!result.allowed) {
    pendingIllegalCard.value = result.overridable ? card : null
    pendingIllegalReason.value =
      result.reason ?? 'That card cannot be added to this deck.'
    validationCanBeOverridden.value = result.overridable ?? false
    showIllegalCardDialog.value = true
    return
  }

  addCardEntry(card)
}

function addCardEntry(card: ScryfallCard) {
  const existingBasicLand = deck.cards.find(
    (deckCard) => deckCard.card.id === card.id,
  )

  if (existingBasicLand && isBasicLand(card)) {
    existingBasicLand.quantity += 1
  } else {
    // push() adds one card-and-quantity entry to the end of the array.
    deck.cards.push({ card, quantity: 1 })
  }
}

function confirmIllegalCard() {
  const card = pendingIllegalCard.value

  closeIllegalCardDialog()

  if (card) {
    addCardEntry(card)
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

function removeDeckCard(index: number) {
  // filter() creates a new array containing every item except the chosen one.
  deck.cards = deck.cards.filter((_card, cardIndex) => cardIndex !== index)
}

function increaseCardQuantity(index: number) {
  const deckCard = deck.cards[index]

  if (!deckCard || !isBasicLand(deckCard.card)) {
    return
  }

  deckCard.quantity += 1
}

function decreaseCardQuantity(index: number) {
  const deckCard = deck.cards[index]

  if (!deckCard) {
    return
  }

  if (deckCard.quantity <= 1) {
    removeDeckCard(index)
    return
  }

  deckCard.quantity -= 1
}

function removeIllegalCards() {
  const illegalCards = getColorIdentityViolations(deck)

  deck.cards = deck.cards.filter(
    (deckCard) => !illegalCards.includes(deckCard),
  )
}
</script>
