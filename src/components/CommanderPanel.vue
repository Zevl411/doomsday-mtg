<template>
  <v-card
    :border="!searchOnly"
    class="commander-panel h-100 w-100"
    :color="searchOnly ? 'transparent' : 'surface'"
    rounded="lg"
    variant="flat"
  >
    <template v-if="!displayOnly">
    <v-card-title
      :class="
        searchOnly
          ? 'compact-search-header px-0 text-subtitle-1'
          : 'px-5 pt-5'
      "
    >
      Commander Search
    </v-card-title>
    <v-card-subtitle v-if="!searchOnly" class="px-5">
      Find and manage your selected Commander
    </v-card-subtitle>

    <v-card-text :class="searchOnly ? 'pa-0 pt-2' : 'pa-5'">
      <CardSearch
        clearable
        clear-on-select
        :compact="searchOnly"
        commander-only
        :selected-card-ids="selectedCommanderIds"
        @card-hovered="deckStore.setPreviewCard"
        @card-selected="deckStore.setCommander"
        @cleared="deckStore.clearCommander"
      />

      <template v-if="commander && canHavePartner(commander)">
        <v-divider class="my-5" />
        <p class="mb-3 text-subtitle-1 font-weight-medium">
          Partner Commander
        </p>
        <CardSearch
          clearable
          clear-on-select
          :compact="searchOnly"
          commander-only
          :search-filter="partnerSearchFilter"
          :selected-card-ids="selectedCommanderIds"
          @card-hovered="deckStore.setPreviewCard"
          @card-selected="selectPartner"
          @cleared="deckStore.clearPartnerCommander"
        />
        <v-alert
          v-if="partnerError"
          class="mt-3"
          density="compact"
          type="error"
          variant="tonal"
        >
          {{ partnerError }}
        </v-alert>
      </template>
    </v-card-text>
    </template>

    <v-divider v-if="!searchOnly" />

    <div
      v-if="!searchOnly && commander"
      aria-label="Selected Commander"
      class="selected-commander-content text-center"
      tabindex="0"
      @focusin.self="deckStore.setPreviewCard(commander)"
      @mouseenter="deckStore.setPreviewCard(commander)"
    >
      <v-img
        v-if="getCardImage(commander)"
        :alt="`${commander.name} card art`"
        aspect-ratio="0.716"
        class="commander-image mx-auto mt-3 rounded-lg"
        cover
        :src="getCardImage(commander)"
      />

      <v-card-title class="commander-name px-2 pb-1 pt-3 text-wrap">
        {{ commander.name }}
      </v-card-title>
      <v-card-subtitle
        class="commander-type px-2 pb-3 text-caption text-wrap"
      >
        {{ commander.type_line }}
      </v-card-subtitle>

      <template v-if="partnerCommander">
        <v-divider class="mx-2" />
        <div
          aria-label="Selected Partner Commander"
          tabindex="0"
          @focusin="deckStore.setPreviewCard(partnerCommander)"
          @mouseenter="deckStore.setPreviewCard(partnerCommander)"
        >
          <v-img
            v-if="getCardImage(partnerCommander)"
            :alt="`${partnerCommander.name} card art`"
            aspect-ratio="0.716"
            class="commander-image mx-auto mt-3 rounded-lg"
            cover
            :src="getCardImage(partnerCommander)"
          />
          <v-card-title class="commander-name px-2 pb-1 pt-3 text-wrap">
            {{ partnerCommander.name }}
          </v-card-title>
          <v-card-subtitle
            class="commander-type px-2 pb-3 text-caption text-wrap"
          >
            {{ partnerCommander.type_line }}
          </v-card-subtitle>
        </div>
      </template>
    </div>

    <v-card-text
      v-else-if="!searchOnly"
      class="px-2 pb-5 text-center text-medium-emphasis"
    >
      No commander selected.
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CardSearch from './CardSearch.vue'
import { useDeckStore } from '../stores/deck'
import { getCardImage } from '../utils/cardDisplay'
import type { ScryfallCard } from '../types/card'
import {
  canHavePartner,
  getPartnerSearchFilter,
} from '../utils/commanderPairing'

const deckStore = useDeckStore()
const props = withDefaults(defineProps<{
  searchOnly?: boolean
  displayOnly?: boolean
}>(), {
  searchOnly: false,
  displayOnly: false,
})
const searchOnly = computed(() => props.searchOnly)
const displayOnly = computed(() => props.displayOnly)
const commander = computed(() => deckStore.deck.commander)
const partnerCommander = computed(() => deckStore.deck.partnerCommander ?? null)
const partnerError = ref('')
const selectedCommanderIds = computed(() =>
  [commander.value?.id, partnerCommander.value?.id].filter(
    (id): id is string => Boolean(id),
  ),
)
const partnerSearchFilter = computed(() =>
  commander.value ? getPartnerSearchFilter(commander.value) : '',
)

function selectPartner(card: ScryfallCard) {
  const result = deckStore.setPartnerCommander(card)
  partnerError.value = result.allowed
    ? ''
    : result.reason ?? 'Those commanders cannot be paired.'
}
</script>

<style scoped>
.commander-panel {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  min-width: 0;
  overflow: hidden;
}

.commander-image {
  max-width: none;
  width: calc(100% - 24px);
}

.commander-name {
  font-size: 1.125rem;
  line-height: 1.3;
}

.commander-type {
  line-height: 1.25;
  opacity: 0.72;
}

.compact-search-header {
  align-items: center;
  display: flex;
  height: 32px;
  line-height: 1.5rem;
  min-height: 32px;
}
</style>
