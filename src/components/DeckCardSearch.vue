<template>
  <v-card
    :border="!embedded"
    :color="embedded ? 'transparent' : 'surface'"
    rounded="lg"
    variant="flat"
  >
    <v-card-item
      :class="embedded ? 'compact-search-header pa-0' : undefined"
    >
      <v-card-title :class="embedded ? 'text-subtitle-1' : undefined">
        Mainboard Search
      </v-card-title>
      <template #append>
        <v-tooltip
          text="Limit results to the Commander's color identity"
          location="right"
          max-width="150"
        >
          <template #activator="{ props: tooltipProps }">
            <v-switch
              v-model="limitToCommanderColors"
              aria-label="Limit search to Commander color identity"
              class="commander-color-toggle"
              color="primary"
              density="compact"
              hide-details
              inset
              v-bind="tooltipProps"
            />
          </template>
        </v-tooltip>
      </template>
    </v-card-item>
    <v-card-text :class="embedded ? 'pa-0 pt-2' : undefined">
      <CardSearch
        :compact="embedded"
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
import { useUserPreferencesStore } from '../stores/userPreferences'

const emit = defineEmits<{ 'card-selected': [card: ScryfallCard] }>()
const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false,
})
const embedded = computed(() => props.embedded)
const deckStore = useDeckStore()
const preferencesStore = useUserPreferencesStore()
const limitToCommanderColors = ref(
  preferencesStore.values.defaultCommanderColorFilter,
)
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

<style scoped>
.commander-color-toggle {
  --v-switch-scale: 0.75;
  --v-switch-track-height: 18px;
  --v-switch-thumb-height: 14px;
  --v-switch-thumb-width: 14px;
}

.compact-search-header {
  height: 32px;
  min-height: 32px;
}

.compact-search-header :deep(.v-card-item__content) {
  align-self: center;
}

.commander-color-toggle :deep(.v-selection-control) {
  min-height: 28px;
}
</style>
