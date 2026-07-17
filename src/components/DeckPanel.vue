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

      <div class="d-flex align-center justify-space-between ga-3 mb-4">
        <v-chip
          v-if="deckStore.saveSucceeded !== null"
          :color="deckStore.saveSucceeded ? 'success' : 'error'"
          role="status"
          size="x-small"
          variant="tonal"
        >
          {{
            deckStore.saveSucceeded
              ? 'Saved locally'
              : 'Unable to save locally'
          }}
        </v-chip>
        <span v-else />
        <v-btn
          color="error"
          size="small"
          variant="text"
          @click="showResetDialog = true"
        >
          Clear deck
        </v-btn>
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
        :search-filter="colorIdentitySearchFilter"
        :selected-card-ids="deck.cards.map((deckCard) => deckCard.card.id)"
        @card-hovered="deckStore.setPreviewCard"
        @card-selected="emit('card-selected', $event)"
      >
        <template #actions>
          <v-switch
            v-model="limitToCommanderColors"
            aria-label="Limit search to Commander color identity"
            color="primary"
            density="compact"
            hide-details
            inset
          />
        </template>
      </CardSearch>

      <v-alert
        v-if="colorIdentityViolations.length"
        class="mt-5"
        density="compact"
        type="error"
        variant="tonal"
      >
        <div class="d-flex flex-wrap align-center justify-space-between ga-3">
          <span>
            {{ colorIdentityViolations.length }}
            {{ colorIdentityViolations.length === 1 ? 'card is' : 'cards are' }}
            outside the Commander's color identity.
          </span>
          <v-btn
            color="error"
            size="small"
            variant="outlined"
            @click="deckStore.removeIllegalCards"
          >
            Remove all illegal cards
          </v-btn>
        </div>
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
          :class="{
            'deck-card--illegal': isColorIdentityViolation(deckCard),
          }"
          :title="`${deckCard.quantity}× ${deckCard.card.name}`"
          @focusin="deckStore.setPreviewCard(deckCard.card)"
          @mouseenter="deckStore.setPreviewCard(deckCard.card)"
        >
          <template #append>
            <div class="d-flex align-center ga-1">
              <v-btn
                :aria-label="`Decrease quantity of ${deckCard.card.name}`"
                color="secondary"
                size="small"
                variant="text"
                @click="deckStore.decreaseQuantity(index)"
              >
                −
              </v-btn>
              <v-btn
                :aria-label="`Increase quantity of ${deckCard.card.name}`"
                color="secondary"
                :disabled="!isBasicLand(deckCard.card)"
                size="small"
                variant="text"
                @click="deckStore.increaseQuantity(index)"
              >
                +
              </v-btn>
              <v-btn
                :aria-label="`Remove ${deckCard.card.name} from deck`"
                color="error"
                size="small"
                variant="text"
                @click="deckStore.removeCard(index)"
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

  <v-dialog v-model="showResetDialog" max-width="520">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Clear this deck?</v-card-title>
      <v-card-text class="px-5">
        This will remove the current Commander, remove every deck card, and
        delete the locally saved deck from this browser.
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showResetDialog = false">
          Cancel
        </v-btn>
        <v-btn color="error" variant="flat" @click="confirmReset">
          Clear Deck
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CardSearch from './CardSearch.vue'
import type { Deck, DeckCard } from '../models/deck'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'
import {
  getColorIdentityViolations,
  isBasicLand,
} from '../utils/deckLegality'
import {
  getDeckSizeStatus,
  getMainDeckCardCount,
} from '../utils/deckValidation'

const emit = defineEmits<{
  'card-selected': [card: ScryfallCard]
}>()

const deckStore = useDeckStore()
const deck = computed<Deck>(() => deckStore.deck)
const mainDeckCardCount = computed(() => getMainDeckCardCount(deckStore.deck))
const deckSizeStatus = computed(() => getDeckSizeStatus(deckStore.deck))
const colorIdentityViolations = computed(() =>
  getColorIdentityViolations(deckStore.deck),
)
const showResetDialog = ref(false)
const limitToCommanderColors = ref(true)
const colorIdentitySearchFilter = computed(() => {
  if (!limitToCommanderColors.value || !deckStore.deck.commander) {
    return ''
  }

  const colorIdentity = deckStore.deck.commander.color_identity
    .join('')
    .toLowerCase()

  // Scryfall's `id<=` syntax includes cards contained within these colors.
  return colorIdentity ? `id<=${colorIdentity}` : 'id:c'
})
const progressValue = computed(() => {
  const percentage =
    (deckSizeStatus.value.total / deckSizeStatus.value.target) * 100

  return Math.min(percentage, 100)
})

function isColorIdentityViolation(deckCard: DeckCard): boolean {
  return colorIdentityViolations.value.includes(deckCard)
}

function confirmReset() {
  deckStore.resetDeck()
  showResetDialog.value = false
}
</script>
