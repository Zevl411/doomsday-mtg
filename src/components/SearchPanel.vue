<template>
  <v-card border class="h-100" color="surface" rounded="lg" variant="flat">
    <v-card-title class="px-5 pt-5">Commander Search</v-card-title>
    <v-card-subtitle class="px-5">
      Find a Commander-legal card
    </v-card-subtitle>
    <v-card-text class="pa-5">
      <CardSearch
        commander-only
        @card-selected="emit('card-selected', $event)"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import CardSearch from './CardSearch.vue'
import type { ScryfallCard } from '../types/card'

const emit = defineEmits<{
  'card-selected': [card: ScryfallCard]
}>()
</script>
