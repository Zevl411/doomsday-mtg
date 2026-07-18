<template>
  <v-card border color="surface" rounded="lg" variant="flat">
    <v-card-item>
      <v-card-title>Mainboard Search</v-card-title>
      <template #append>
        <v-switch
          v-model="limitToCommanderColors"
          aria-label="Limit search to Commander color identity"
          color="primary"
          density="compact"
          hide-details
          inset
          label="Commander colors"
        />
      </template>
    </v-card-item>
    <v-card-text>
      <CardSearch
        :search-filter="searchFilter"
        :selected-card-ids="deckStore.deck.cards.map((entry) => entry.card.id)"
        @card-hovered="deckStore.setPreviewCard"
        @card-selected="emit('card-selected', $event)"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ScryfallCard } from '../types/card'
import { useDeckStore } from '../stores/deck'
import CardSearch from './CardSearch.vue'

const emit = defineEmits<{ 'card-selected': [card: ScryfallCard] }>()
const deckStore = useDeckStore()
const limitToCommanderColors = ref(true)
const searchFilter = computed(() => {
  if (!limitToCommanderColors.value || !deckStore.deck.commander) return ''
  const colors = [
    ...new Set([
      ...deckStore.deck.commander.color_identity,
      ...(deckStore.deck.partnerCommander?.color_identity ?? []),
    ]),
  ]
  return colors.length ? `id<=${colors.join('').toLowerCase()}` : 'id:c'
})
</script>
