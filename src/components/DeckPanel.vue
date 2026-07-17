<template>
  <section class="app-panel deck-panel">
    <div class="panel-heading">
      <h2>Deck</h2>
      <span>{{ cards.length }} cards</span>
    </div>

    <CardSearch @card-selected="emit('card-selected', $event)" />

    <ul v-if="cards.length" class="deck-card-list">
      <li v-for="(card, index) in cards" :key="`${card.id}-${index}`">
        <span>{{ card.name }}</span>
        <button type="button" @click="emit('remove-card', index)">
          Remove
        </button>
      </li>
    </ul>
    <p v-else class="placeholder-text deck-empty">Your deck is empty.</p>
  </section>
</template>

<script setup lang="ts">
import CardSearch from './CardSearch.vue'
import type { ScryfallCard } from '../types/card'

defineProps<{
  cards: ScryfallCard[]
}>()

// These events let App.vue handle changes while this panel only displays them.
const emit = defineEmits<{
  'card-selected': [card: ScryfallCard]
  'remove-card': [index: number]
}>()
</script>
