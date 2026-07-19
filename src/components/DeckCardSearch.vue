<template>
  <CardSearch
    compact
    elevated-results
    :search-filter="searchFilter"
    :selected-card-ids="selectedCardIds"
    @card-hovered="deckStore.setPreviewCard"
    @card-selected="emit('card-selected', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TrackedDeckBoard } from '../models/deck'
import type { ScryfallCard } from '../types/card'
import { useDeckStore } from '../stores/deck'
import CardSearch from './CardSearch.vue'
import { useUserPreferencesStore } from '../stores/userPreferences'

const emit = defineEmits<{ 'card-selected': [card: ScryfallCard] }>()
const props = defineProps<{ board: TrackedDeckBoard }>()
const deckStore = useDeckStore()
const preferencesStore = useUserPreferencesStore()

const selectedCardIds = computed(() => {
  if (props.board === 'mainboard') return deckStore.deck.cards.map(cardId)
  if (props.board === 'sideboard') return deckStore.deck.sideboard.map(cardId)
  if (props.board === 'considering') return deckStore.deck.considering.map(cardId)
  return deckStore.deck.maybeboard.map(cardId)
})

const searchFilter = computed(() => {
  if (
    !preferencesStore.values.defaultCommanderColorFilter
    || !deckStore.deck.commander
  ) {
    return ''
  }
  const colors = [
    ...new Set([
      ...deckStore.deck.commander.color_identity,
      ...(deckStore.deck.partnerCommander?.color_identity ?? []),
    ]),
  ]
  return colors.length ? `id<=${colors.join('').toLowerCase()}` : 'id:c'
})

function cardId(entry: { card: ScryfallCard }): string {
  return entry.card.id
}
</script>
