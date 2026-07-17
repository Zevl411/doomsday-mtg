<template>
  <v-card border class="h-100" color="surface" rounded="lg" variant="flat">
    <v-card-item class="px-5 pt-5">
      <v-card-title>Deck</v-card-title>
      <template #append>
        <v-chip color="secondary" size="small" variant="tonal">
          {{ deckSizeStatus.total }} / {{ deckSizeStatus.target }}
        </v-chip>
      </template>
    </v-card-item>

    <v-card-text class="pa-5">
      <div class="d-flex flex-wrap ga-2 mb-3">
        <v-chip size="small" variant="tonal">
          Main deck: {{ mainDeckCardCount }}
        </v-chip>
        <v-chip
          :color="deck.commander ? 'success' : 'warning'"
          size="small"
          variant="tonal"
        >
          Commander {{ deck.commander ? 'selected' : 'not selected' }}
        </v-chip>
      </div>

      <v-progress-linear
        :color="deckSizeStatus.overLimit ? 'error' : 'primary'"
        height="8"
        :model-value="progressValue"
        rounded
      />

      <v-alert
        v-if="deckSizeStatus.overLimit"
        class="mt-3"
        density="compact"
        type="error"
        variant="tonal"
      >
        {{ deckSizeStatus.message }}
      </v-alert>
      <v-alert
        v-else-if="deckSizeStatus.complete"
        class="mt-3"
        density="compact"
        type="success"
        variant="tonal"
      >
        {{ deckSizeStatus.message }}
      </v-alert>
      <v-alert
        v-else
        class="mt-3"
        density="compact"
        type="info"
        variant="tonal"
      >
        {{ deckSizeStatus.message }}
      </v-alert>

      <v-divider class="my-5" />

      <CardSearch
        :selected-card-ids="deck.cards.map((deckCard) => deckCard.card.id)"
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

      <v-list
        v-if="deck.cards.length"
        class="mt-5 pa-0"
        bg-color="transparent"
      >
        <v-list-item
          v-for="(deckCard, index) in deck.cards"
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
import { computed } from 'vue'
import CardSearch from './CardSearch.vue'
import type { Deck } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { isBasicLand } from '../utils/deckLegality'
import {
  getDeckSizeStatus,
  getMainDeckCardCount,
} from '../utils/deckValidation'

const props = defineProps<{
  deck: Deck
  rejectionMessage: string
}>()

// These events let App.vue handle changes while this panel only displays them.
const emit = defineEmits<{
  'card-selected': [card: ScryfallCard]
  'decrease-quantity': [index: number]
  'increase-quantity': [index: number]
  'remove-card': [index: number]
}>()

const mainDeckCardCount = computed(() => getMainDeckCardCount(props.deck))
const deckSizeStatus = computed(() => getDeckSizeStatus(props.deck))
const progressValue = computed(() => {
  const percentage =
    (deckSizeStatus.value.total / deckSizeStatus.value.target) * 100

  return Math.min(percentage, 100)
})
</script>
