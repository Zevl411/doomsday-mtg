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
          {{ deckStore.saveSucceeded ? 'Saved locally' : 'Unable to save locally' }}
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
        class="mt-3"
        density="compact"
        :type="
          deckSizeStatus.overLimit
            ? 'error'
            : deckSizeStatus.complete
              ? 'success'
              : 'info'
        "
        variant="tonal"
      >
        {{ deckSizeStatus.message }}
      </v-alert>

      <v-divider class="my-5" />

      <v-select
        v-model="searchDestination"
        :items="boardOptions"
        label="Add search results to"
        variant="outlined"
      />

      <CardSearch
        :search-filter="colorIdentitySearchFilter"
        :selected-card-ids="selectedDestinationCards.map((entry) => entry.card.id)"
        @card-hovered="deckStore.setPreviewCard"
        @card-selected="emit('card-selected', $event, searchDestination)"
      >
        <template #actions>
          <v-switch
            v-if="searchDestination === 'mainboard'"
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

      <v-tabs v-model="selectedBoard" class="mt-5" color="primary" grow>
        <v-tab
          v-for="option in boardOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.title }} ({{ getBoardCount(option.value) }})
        </v-tab>
      </v-tabs>

      <v-list
        v-if="selectedBoardCards.length"
        class="mt-3 pa-0"
        bg-color="transparent"
      >
        <v-list-item
          v-for="deckCard in selectedBoardCards"
          :key="getCardIdentity(deckCard.card)"
          border="b"
          class="px-0"
          :class="{
            'deck-card--illegal':
              selectedBoard === 'mainboard' &&
              isColorIdentityViolation(deckCard),
          }"
          :title="`${deckCard.quantity}× ${deckCard.card.name}`"
          @focusin="deckStore.setPreviewCard(deckCard.card)"
          @mouseenter="deckStore.setPreviewCard(deckCard.card)"
        >
          <template #append>
            <div class="d-flex flex-wrap align-center ga-1">
              <v-btn
                :aria-label="`Decrease quantity of ${deckCard.card.name}`"
                color="secondary"
                size="small"
                variant="text"
                @click="
                  deckStore.decreaseBoardQuantity(
                    getCardIdentity(deckCard.card),
                    selectedBoard,
                  )
                "
              >
                −
              </v-btn>
              <v-btn
                :aria-label="`Increase quantity of ${deckCard.card.name}`"
                color="secondary"
                :disabled="
                  selectedBoard === 'mainboard' &&
                  !isBasicLand(deckCard.card)
                "
                size="small"
                variant="text"
                @click="
                  deckStore.increaseBoardQuantity(
                    getCardIdentity(deckCard.card),
                    selectedBoard,
                  )
                "
              >
                +
              </v-btn>
              <v-select
                :aria-label="`Move ${deckCard.card.name} to another board`"
                class="move-select"
                density="compact"
                hide-details
                :items="moveOptions"
                label="Move to"
                variant="outlined"
                @update:model-value="
                  moveCard(getCardIdentity(deckCard.card), $event)
                "
              />
              <v-btn
                :aria-label="`Remove ${deckCard.card.name} from ${selectedBoard}`"
                color="error"
                size="small"
                variant="text"
                @click="
                  deckStore.removeCardFromBoard(
                    getCardIdentity(deckCard.card),
                    selectedBoard,
                  )
                "
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
        This board is empty.
      </v-sheet>
    </v-card-text>
  </v-card>

  <v-dialog v-model="showResetDialog" max-width="520">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Clear this deck?</v-card-title>
      <v-card-text class="px-5">
        This removes the Commander and cards from every tracked board.
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showResetDialog = false">Cancel</v-btn>
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
import {
  useDeckStore,
  type TrackedCardBoard,
} from '../stores/deck'
import type { ScryfallCard } from '../types/card'
import { getCardIdentity } from '../utils/cardIdentity'
import {
  getColorIdentityViolations,
  isBasicLand,
} from '../utils/deckLegality'
import {
  getDeckSizeStatus,
  getMainDeckCardCount,
} from '../utils/deckValidation'

const emit = defineEmits<{
  'card-selected': [card: ScryfallCard, board: TrackedCardBoard]
}>()

const boardOptions: Array<{ title: string; value: TrackedCardBoard }> = [
  { title: 'Mainboard', value: 'mainboard' },
  { title: 'Sideboard', value: 'sideboard' },
  { title: 'Maybeboard', value: 'maybeboard' },
  { title: 'Considering', value: 'considering' },
]

const deckStore = useDeckStore()
const deck = computed<Deck>(() => deckStore.deck)
const selectedBoard = ref<TrackedCardBoard>('mainboard')
const searchDestination = ref<TrackedCardBoard>('mainboard')
const showResetDialog = ref(false)
const limitToCommanderColors = ref(true)
const mainDeckCardCount = computed(() => getMainDeckCardCount(deckStore.deck))
const deckSizeStatus = computed(() => getDeckSizeStatus(deckStore.deck))
const colorIdentityViolations = computed(() =>
  getColorIdentityViolations(deckStore.deck),
)
const selectedBoardCards = computed(() =>
  getBoardCards(selectedBoard.value),
)
const selectedDestinationCards = computed(() =>
  getBoardCards(searchDestination.value),
)
const moveOptions = computed(() =>
  boardOptions.filter((option) => option.value !== selectedBoard.value),
)
const colorIdentitySearchFilter = computed(() => {
  if (
    searchDestination.value !== 'mainboard' ||
    !limitToCommanderColors.value ||
    !deckStore.deck.commander
  ) {
    return ''
  }

  const colorIdentity = deckStore.deck.commander.color_identity
    .join('')
    .toLowerCase()
  return colorIdentity ? `id<=${colorIdentity}` : 'id:c'
})
const progressValue = computed(() =>
  Math.min(
    (deckSizeStatus.value.total / deckSizeStatus.value.target) * 100,
    100,
  ),
)

function getBoardCards(board: TrackedCardBoard): DeckCard[] {
  return board === 'mainboard'
    ? deckStore.deck.cards
    : deckStore.deck[board]
}

function getBoardCount(board: TrackedCardBoard): number {
  return getBoardCards(board).reduce(
    (total, entry) => total + entry.quantity,
    0,
  )
}

function isColorIdentityViolation(deckCard: DeckCard): boolean {
  return colorIdentityViolations.value.includes(deckCard)
}

function moveCard(identity: string, destination: TrackedCardBoard | null) {
  if (destination) {
    deckStore.moveCardBetweenBoards(
      identity,
      selectedBoard.value,
      destination,
    )
  }
}

function confirmReset() {
  deckStore.resetDeck()
  showResetDialog.value = false
}
</script>

<style scoped>
.move-select {
  min-width: 125px;
}
</style>
