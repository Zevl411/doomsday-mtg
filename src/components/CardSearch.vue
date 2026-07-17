<template>
  <v-text-field
    :id="searchInputId"
    v-model="query"
    autocomplete="off"
    color="primary"
    label="Search for a Magic card"
    placeholder="Card name"
    type="search"
    variant="outlined"
  >
    <template v-if="$slots.actions" #append>
      <slot name="actions" />
    </template>
  </v-text-field>

  <div class="search-results" aria-live="polite">
    <div v-if="isLoading" class="d-flex align-center ga-3 py-4">
      <v-progress-circular color="primary" indeterminate size="24" width="3" />
      <span class="text-body-2 text-medium-emphasis">Searching…</span>
    </div>

    <v-alert
      v-else-if="errorMessage"
      density="compact"
      type="error"
      variant="tonal"
    >
      {{ errorMessage }}
    </v-alert>

    <v-list
      v-else-if="cards.length"
      class="search-results-list pa-0"
      bg-color="transparent"
    >
      <v-list-item
        v-for="card in cards"
        :key="card.id"
        :aria-pressed="isCardSelected(card)"
        border
        class="card-result mb-3"
        :class="{ 'card-result--selected': isCardSelected(card) }"
        rounded="lg"
        tag="button"
        type="button"
        @click="emit('card-selected', card)"
        @focus="emit('card-hovered', card)"
        @mouseenter="emit('card-hovered', card)"
      >
        <template v-if="getCardImage(card)" #prepend>
          <v-img
            :alt="`${card.name} card art`"
            class="card-result-image mr-4 rounded"
            cover
            height="100"
            :src="getCardImage(card)"
            width="72"
          />
        </template>

        <v-list-item-title class="font-weight-bold">
          {{ card.name }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ card.type_line }}</v-list-item-subtitle>
        <v-list-item-subtitle>
          Color identity: {{ formatColorIdentity(card) }}
        </v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, useId, watch } from 'vue'
import { searchCards } from '../api/scryfall'
import type { ScryfallCard } from '../types/card'

// Props are values a parent component can pass into this component.
const props = withDefaults(
  defineProps<{
    commanderOnly?: boolean
    searchFilter?: string
    selectedCardIds?: string[]
  }>(),
  {
    commanderOnly: false,
    searchFilter: '',
    selectedCardIds: () => [],
  },
)

// Emits describe events this component can send back to its parent. The tuple
// says that card-selected sends one value named card with the ScryfallCard type.
const emit = defineEmits<{
  'card-hovered': [card: ScryfallCard]
  'card-selected': [card: ScryfallCard]
}>()

// useId() gives each CardSearch instance its own accessible input and label ID.
const searchInputId = useId()

// ref() makes a value reactive, so Vue updates the page when it changes.
const query = ref('')
const cards = ref<ScryfallCard[]>([])
const errorMessage = ref('')
const isLoading = ref(false)
let searchTimer: number | undefined
// AbortController lets us intentionally cancel a fetch that is no longer needed.
let activeController: AbortController | null = null

// Watching both values also refreshes results when a parent changes the filter.
watch([query, () => props.searchFilter], ([newQuery]) => {
  window.clearTimeout(searchTimer)
  activeController?.abort()
  activeController = null
  errorMessage.value = ''

  if (!newQuery.trim()) {
    cards.value = []
    isLoading.value = false
    return
  }

  searchTimer = window.setTimeout(async () => {
    const controller = new AbortController()
    activeController = controller
    isLoading.value = true

    try {
      const commanderFilter = 'is:commander legal:commander'
      const scryfallQuery = props.commanderOnly
        ? `${newQuery} ${commanderFilter}`
        : `${newQuery} ${props.searchFilter}`.trim()

      cards.value = await searchCards(scryfallQuery, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      cards.value = []
      errorMessage.value =
        error instanceof Error ? error.message : 'Card search failed.'
    } finally {
      if (activeController === controller) {
        activeController = null
        isLoading.value = false
      }
    }
  }, 250)
})

// onUnmounted() runs cleanup when Vue removes this component from the page.
onUnmounted(() => {
  window.clearTimeout(searchTimer)
  activeController?.abort()
})

function getCardImage(card: ScryfallCard): string | undefined {
  return card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small
}

function formatColorIdentity(card: ScryfallCard): string {
  return card.color_identity.join(', ') || 'Colorless'
}

function isCardSelected(card: ScryfallCard): boolean {
  return props.selectedCardIds.includes(card.id)
}
</script>
