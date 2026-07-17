<template>
  <DefaultLayout>
    <v-row align="start">
      <v-col cols="12" lg="5">
        <SearchPanel @card-selected="selectCommander" />
      </v-col>

      <v-col cols="12" md="6" lg="3">
        <CommanderPanel
          :commander="deck.commander"
          @clear-commander="clearCommander"
        />
      </v-col>

      <v-col cols="12" md="6" lg="4">
        <DeckPanel
          :deck="deck"
          :rejection-message="rejectionMessage"
          @card-selected="addDeckCard"
          @decrease-quantity="decreaseCardQuantity"
          @increase-quantity="increaseCardQuantity"
          @remove-card="removeDeckCard"
        />
      </v-col>
    </v-row>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import CommanderPanel from './components/CommanderPanel.vue'
import DeckPanel from './components/DeckPanel.vue'
import SearchPanel from './components/SearchPanel.vue'
import DefaultLayout from './layouts/DefaultLayout.vue'
import type { Deck } from './models/deck'
import type { ScryfallCard } from './types/card'
import { isBasicLand, validateCardAddition } from './utils/deckLegality'

// reactive() keeps these related deck properties together and updates the UI
// when any property on the object changes.
const deck = reactive<Deck>({
  commander: null,
  cards: [],
  name: 'Untitled Deck',
})
const rejectionMessage = ref('')

function selectCommander(card: ScryfallCard) {
  deck.commander = card
}

function clearCommander() {
  deck.commander = null
}

function addDeckCard(card: ScryfallCard) {
  const result = validateCardAddition(card, deck)

  if (!result.allowed) {
    rejectionMessage.value =
      result.reason ?? 'That card cannot be added to this deck.'
    return
  }

  const existingBasicLand = deck.cards.find(
    (deckCard) => deckCard.card.id === card.id,
  )

  if (existingBasicLand && isBasicLand(card)) {
    existingBasicLand.quantity += 1
  } else {
    // push() adds one card-and-quantity entry to the end of the array.
    deck.cards.push({ card, quantity: 1 })
  }

  rejectionMessage.value = ''
}

function removeDeckCard(index: number) {
  // filter() creates a new array containing every item except the chosen one.
  deck.cards = deck.cards.filter((_card, cardIndex) => cardIndex !== index)
  rejectionMessage.value = ''
}

function increaseCardQuantity(index: number) {
  const deckCard = deck.cards[index]

  if (!deckCard || !isBasicLand(deckCard.card)) {
    return
  }

  deckCard.quantity += 1
  rejectionMessage.value = ''
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
  rejectionMessage.value = ''
}
</script>
