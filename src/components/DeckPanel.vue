<template>
  <v-card border class="h-100" color="surface" rounded="lg" variant="flat">
    <v-card-item class="px-5 pt-5">
      <v-card-title>Deck</v-card-title>
      <template #append>
        <v-chip color="secondary" size="small" variant="tonal">
          {{ getTotalCardCount() }} cards
        </v-chip>
      </template>
    </v-card-item>

    <v-card-text class="pa-5">
      <CardSearch
        :selected-card-ids="cards.map((deckCard) => deckCard.card.id)"
        @card-selected="emit('card-selected', $event)"
      />

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
          v-for="(deckCard, index) in cards"
          :key="deckCard.card.id"
          border="b"
          class="px-0"
          :title="`${deckCard.quantity}× ${deckCard.card.name}`"
        >
          <template #append>
            <div class="d-flex align-center ga-1">
              <v-btn
                :aria-label="`Decrease quantity of ${deckCard.card.name}`"
                color="secondary"
                size="small"
                variant="text"
                @click="emit('decrease-quantity', index)"
              >
                −
              </v-btn>
              <v-btn
                :aria-label="`Increase quantity of ${deckCard.card.name}`"
                color="secondary"
                :disabled="!isBasicLand(deckCard.card)"
                size="small"
                variant="text"
                @click="emit('increase-quantity', index)"
              >
                +
              </v-btn>
              <v-btn
                :aria-label="`Remove ${deckCard.card.name} from deck`"
                color="error"
                size="small"
                variant="text"
                @click="emit('remove-card', index)"
              >
                Remove
              </v-btn>
            </div>
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
import type { DeckCard } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { isBasicLand } from '../utils/deckLegality'

const props = defineProps<{
  cards: DeckCard[]
  rejectionMessage: string
}>()

// These events let App.vue handle changes while this panel only displays them.
const emit = defineEmits<{
  'card-selected': [card: ScryfallCard]
  'decrease-quantity': [index: number]
  'increase-quantity': [index: number]
  'remove-card': [index: number]
}>()

function getTotalCardCount(): number {
  let total = 0

  for (const deckCard of props.cards) {
    total += deckCard.quantity
  }

  return total
}
</script>
