<template>
  <AppLayout>
    <SearchPanel @card-selected="selectCommander" />
    <CommanderPanel
      :commander="deck.commander"
      @clear-commander="clearCommander"
    />
    <DeckPanel
      :cards="deck.cards"
      :rejection-message="rejectionMessage"
      @card-selected="addDeckCard"
      @remove-card="removeDeckCard"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import AppLayout from './components/AppLayout.vue'
import CommanderPanel from './components/CommanderPanel.vue'
import DeckPanel from './components/DeckPanel.vue'
import SearchPanel from './components/SearchPanel.vue'
import type { Deck } from './models/deck'
import type { ScryfallCard } from './types/card'
import {
  canAddCardToDeck,
  isWithinCommanderColorIdentity,
} from './utils/deckLegality'

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
  if (!canAddCardToDeck(card, deck)) {
    rejectionMessage.value = getRejectionMessage(card)
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

function getRejectionMessage(card: ScryfallCard): string {
  if (!deck.commander) {
    return 'Choose a commander before adding cards to the deck.'
  }

  if (card.id === deck.commander.id) {
    return 'Your commander cannot also be added as a regular deck card.'
  }

  if (deck.cards.some((deckCard) => deckCard.id === card.id)) {
    return `${card.name} is already in the deck.`
  }

  if (!isWithinCommanderColorIdentity(card, deck.commander)) {
    return `${card.name} is outside your commander's color identity.`
  }

  return 'That card cannot be added to this deck.'
}
</script>
