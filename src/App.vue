<template>
  <AppLayout>
    <SearchPanel @card-selected="selectCommander" />
    <CommanderPanel
      :commander="deck.commander"
      @clear-commander="clearCommander"
    />
    <DeckPanel
      :cards="deck.cards"
      @card-selected="addDeckCard"
      @remove-card="removeDeckCard"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import AppLayout from './components/AppLayout.vue'
import CommanderPanel from './components/CommanderPanel.vue'
import DeckPanel from './components/DeckPanel.vue'
import SearchPanel from './components/SearchPanel.vue'
import type { Deck } from './models/deck'
import type { ScryfallCard } from './types/card'

// reactive() keeps these related deck properties together and updates the UI
// when any property on the object changes.
const deck = reactive<Deck>({
  commander: null,
  cards: [],
  name: 'Untitled Deck',
})

function selectCommander(card: ScryfallCard) {
  deck.commander = card
}

function clearCommander() {
  deck.commander = null
}

function addDeckCard(card: ScryfallCard) {
  if (deck.commander?.id === card.id) {
    return
  }

  // push() adds one item to the end of an array.
  deck.cards.push(card)
}

function removeDeckCard(index: number) {
  // filter() creates a new array containing every item except the chosen one.
  deck.cards = deck.cards.filter((_card, cardIndex) => cardIndex !== index)
}
</script>
