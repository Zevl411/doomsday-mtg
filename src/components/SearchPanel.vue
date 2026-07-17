<template>
  <section class="app-panel search-panel">
    <h2>Search</h2>
    <CardSearch commander-only @card-selected="emit('card-selected', $event)" />
  </section>
</template>

<script setup lang="ts">
import CardSearch from './CardSearch.vue'
import type { ScryfallCard } from '../types/card'

const emit = defineEmits<{
  'card-selected': [card: ScryfallCard]
}>()
</script>
