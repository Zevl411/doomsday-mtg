<template>
  <AppLayout>
    <SearchPanel @card-selected="selectCommander" />
    <CommanderPanel
      :commander="deck.commander"
      @clear-commander="clearCommander"
    />
    <DeckPanel />
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

// reactive() makes every property on this Deck update the UI when it changes.
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
</script>
