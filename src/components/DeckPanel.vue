<template>
  <v-card border class="h-100" color="surface" rounded="lg" variant="flat">
    <v-card-item class="px-5 pt-5">
      <v-card-title>Deck</v-card-title>
      <template #append>
        <v-chip color="secondary" size="small" variant="tonal">
          {{ cards.length }} cards
        </v-chip>
      </template>
    </v-card-item>

    <v-card-text class="pa-5">
      <CardSearch @card-selected="emit('card-selected', $event)" />

      <v-alert
      v-if="rejectionMessage"
      class="mt-5"
      density="compact"
      role="status"
      type="error"
      variant="tonal"
      >
        {{ rejectionMessage }}
      </v-alert>

      <v-list v-if="cards.length" class="mt-5 pa-0" bg-color="transparent">
        <v-list-item
          v-for="(card, index) in cards"
          :key="`${card.id}-${index}`"
          border="b"
          class="px-0"
          :title="card.name"
        >
          <template #append>
            <v-btn
              color="error"
              size="small"
              variant="text"
              @click="emit('remove-card', index)"
            >
              Remove
            </v-btn>
          </template>
        </v-list-item>
      </v-list>

      <v-sheet
        v-else
        class="mt-5 pa-4 text-center text-medium-emphasis"
        color="transparent"
        rounded="lg"
      >
        Your deck is empty.
      </v-sheet>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import CardSearch from './CardSearch.vue'
import type { ScryfallCard } from '../types/card'

defineProps<{
  cards: ScryfallCard[]
  rejectionMessage: string
}>()

// These events let App.vue handle changes while this panel only displays them.
const emit = defineEmits<{
  'card-selected': [card: ScryfallCard]
  'remove-card': [index: number]
}>()
</script>
