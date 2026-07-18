<template>
  <v-card
    border
    class="d-flex flex-column h-100"
    :color="active ? 'surface-light' : 'surface'"
    rounded="lg"
    variant="flat"
  >
    <v-img
      v-if="commanderImage"
      :alt="`${deck.commander?.name} card art`"
      aspect-ratio="1.7"
      cover
      :src="commanderImage"
    />
    <v-sheet
      v-else
      class="d-flex align-center justify-center text-medium-emphasis"
      color="surface-light"
      height="160"
    >
      No commander selected
    </v-sheet>

    <v-card-item>
      <template #prepend>
        <v-chip v-if="active" color="primary" size="x-small" variant="tonal">
          Active
        </v-chip>
      </template>
      <v-card-title>{{ deck.name }}</v-card-title>
      <v-card-subtitle>
        {{ deck.commander?.name ?? 'No commander' }}
      </v-card-subtitle>
    </v-card-item>

    <v-card-text class="flex-grow-1">
      <div class="d-flex flex-wrap ga-2">
        <v-chip size="x-small" variant="tonal">
          Main {{ boardCount(deck.cards) }}
        </v-chip>
        <v-chip size="x-small" variant="tonal">
          Side {{ boardCount(deck.sideboard) }}
        </v-chip>
        <v-chip size="x-small" variant="tonal">
          Maybe {{ boardCount(deck.maybeboard) }}
        </v-chip>
        <v-chip size="x-small" variant="tonal">
          Considering {{ boardCount(deck.considering) }}
        </v-chip>
      </div>
      <div class="mt-2">{{ totalCount }} cards including commander</div>
      <div class="text-caption text-medium-emphasis">
        Updated {{ updatedLabel }}
      </div>
    </v-card-text>

    <v-card-actions class="flex-wrap px-4 pb-4">
      <v-btn color="primary" variant="flat" @click="emit('open', deck.id)">
        Open
      </v-btn>
      <v-btn variant="text" @click="emit('rename', deck.id)">Rename</v-btn>
      <v-btn variant="text" @click="emit('duplicate', deck.id)">
        Duplicate
      </v-btn>
      <v-btn color="error" variant="text" @click="emit('delete', deck.id)">
        Delete
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Deck, DeckCard } from '../models/deck'
import { getCardArt } from '../utils/cardDisplay'
import { getTotalDeckCardCount } from '../utils/deckValidation'

const props = defineProps<{
  deck: Deck
  active: boolean
}>()

// Emits describe user intentions; the library-owning store performs mutations.
const emit = defineEmits<{
  open: [deckId: string]
  rename: [deckId: string]
  duplicate: [deckId: string]
  delete: [deckId: string]
}>()

const commanderImage = computed(() =>
  props.deck.commander
    ? getCardArt(props.deck.commander)
    : undefined,
)
const totalCount = computed(() => getTotalDeckCardCount(props.deck))
const updatedLabel = computed(() =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(props.deck.updatedAt)),
)

function boardCount(entries: DeckCard[]): number {
  return entries.reduce((total, entry) => total + entry.quantity, 0)
}
</script>
