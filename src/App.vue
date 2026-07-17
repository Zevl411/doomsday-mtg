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
          :cards="deck.cards"
          :rejection-message="rejectionMessage"
          @card-selected="addDeckCard"
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
import { validateCardAddition } from './utils/deckLegality'

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

  // push() adds one item to the end of an array.
  deck.cards.push(card)
  rejectionMessage.value = ''
}

function removeDeckCard(index: number) {
  // filter() creates a new array containing every item except the chosen one.
  deck.cards = deck.cards.filter((_card, cardIndex) => cardIndex !== index)
  rejectionMessage.value = ''
}
</script>
