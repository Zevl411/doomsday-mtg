<template>
  <div
    ref="searchRoot"
    class="card-search"
    :class="{ 'card-search--elevated': elevatedResults }"
  >
  <v-text-field
    :id="searchInputId"
    v-model="query"
    autocomplete="off"
    color="primary"
    :density="compact ? 'compact' : 'default'"
    :hide-details="compact"
    :label="hasSelectedCards ? undefined : 'Search for a Magic card'"
    :placeholder="hasSelectedCards ? undefined : 'Card name'"
    type="search"
    variant="outlined"
    :clearable="showClearButton"
    @click:clear="emit('cleared')"
    @focus="openResults"
  >
    <template v-if="hasSelectedCards" #prepend-inner>
      <v-chip
        v-for="card in displayedSelectedCards"
        :key="card.id"
        class="selected-card-chip"
        color="primary"
        size="small"
        variant="outlined"
      >
        <span class="selected-card-chip__label">{{
          getCompactCardName(card.name)
        }}</span>
        <button
          :aria-label="`Clear ${card.name}`"
          class="selected-card-chip__close"
          type="button"
          @click.stop="removeSelectedCard(card)"
        >
          ×
        </button>
      </v-chip>
    </template>
    <template v-if="$slots.actions" #append>
      <slot name="actions" />
    </template>
  </v-text-field>

  <div
    v-show="
      resultsVisible
      && (isLoading || errorMessage || fallbackMessage || cards.length)
    "
    class="search-results"
    aria-live="polite"
  >
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

    <v-alert
      v-if="!isLoading && !errorMessage && fallbackMessage"
      class="mb-3"
      density="compact"
      type="warning"
      variant="tonal"
    >
      {{ fallbackMessage }}
    </v-alert>

    <v-list
      v-if="!isLoading && !errorMessage && cards.length"
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
        @click="selectCard(card)"
        @focus="emit('card-hovered', card)"
        @mouseenter="emit('card-hovered', card)"
      >
        <template v-if="getCardImage(card, 'small')" #prepend>
          <v-img
            :alt="`${card.name} card art`"
            class="card-result-image mr-4 rounded"
            cover
            height="100"
            :src="getCardImage(card, 'small')"
            width="72"
          />
        </template>

        <v-list-item-title
          class="card-result-name d-flex flex-column align-start ga-2 font-weight-bold"
        >
          <span>{{ card.name }}</span>
          <ManaCost
            v-if="getCastingCost(card)"
            class="card-result-mana-cost flex-shrink-0"
            :cost="getCastingCost(card)"
          />
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  useId,
  watch,
} from 'vue'
import { searchCards } from '../api/scryfall'
import { searchCanonicalCards } from '../repositories/canonicalCardRepository'
import type { ScryfallCard } from '../types/card'
import ManaCost from './ManaCost.vue'
import { getCardImage } from '../utils/cardDisplay'
import { getCompactCardName } from '../utils/cardName'

// Props are values a parent component can pass into this component.
const props = withDefaults(
  defineProps<{
    commanderOnly?: boolean
    searchFilter?: string
    selectedCardIds?: string[]
    modelValue?: string
    clearable?: boolean
    compact?: boolean
    elevatedResults?: boolean
    clearOnSelect?: boolean
    retainSelectedName?: boolean
    resultFilter?: (card: ScryfallCard) => boolean
    selectedCard?: ScryfallCard | null
    selectedCards?: ScryfallCard[]
  }>(),
  {
    commanderOnly: false,
    searchFilter: '',
    selectedCardIds: () => [],
    modelValue: '',
    clearable: false,
    compact: false,
    elevatedResults: false,
    clearOnSelect: false,
    retainSelectedName: false,
    resultFilter: undefined,
    selectedCard: null,
    selectedCards: () => [],
  },
)

// Emits describe events this component can send back to its parent. The tuple
// says that card-selected sends one value named card with the ScryfallCard type.
const emit = defineEmits<{
  'card-hovered': [card: ScryfallCard]
  'card-selected': [card: ScryfallCard]
  'update:modelValue': [value: string]
  cleared: []
  'card-removed': [card: ScryfallCard]
}>()

// useId() gives each CardSearch instance its own accessible input and label ID.
const searchInputId = useId()

// ref() makes a value reactive, so Vue updates the page when it changes.
const query = ref(props.modelValue)
const cards = ref<ScryfallCard[]>([])
const searchRoot = ref<HTMLElement | null>(null)
const errorMessage = ref('')
const fallbackMessage = ref('')
const isLoading = ref(false)
const resultsVisible = ref(false)
// A Set provides constant-time selection checks for every rendered result.
const selectedCardIdSet = computed(() => new Set(props.selectedCardIds))
const displayedSelectedCards = computed(() =>
  props.selectedCards.length
    ? props.selectedCards
    : props.selectedCard
      ? [props.selectedCard]
      : [],
)
const hasSelectedCards = computed(() => displayedSelectedCards.value.length > 0)
const showClearButton = computed(
  () => !props.commanderOnly && !hasSelectedCards.value,
)
let searchTimer: number | undefined
let suppressNextSearch = false
// AbortController lets us intentionally cancel a fetch that is no longer needed.
let activeController: AbortController | null = null

// Watching both values also refreshes results when a parent changes the filter.
watch([query, () => props.searchFilter], ([newQuery]) => {
  resultsVisible.value = Boolean(newQuery.trim())
  emit('update:modelValue', newQuery)
  window.clearTimeout(searchTimer)
  activeController?.abort()
  activeController = null
  errorMessage.value = ''
  fallbackMessage.value = ''

  if (suppressNextSearch) {
    suppressNextSearch = false
    cards.value = []
    resultsVisible.value = false
    isLoading.value = false
    return
  }

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
        ? `${newQuery} ${commanderFilter} ${props.searchFilter}`.trim()
        : `${newQuery} ${props.searchFilter}`.trim()

      try {
        cards.value = filterResults(
          await searchCards(scryfallQuery, controller.signal),
        )
      } catch (error) {
        if (
          controller.signal.aborted ||
          !(error instanceof Error) ||
          error.name !== 'ScryfallUnavailableError'
        ) {
          throw error
        }

        cards.value = filterResults(
          await searchCanonicalCards(newQuery, {
            commanderOnly: props.commanderOnly,
            allowedColorIdentity: getFallbackColorIdentity(props.searchFilter),
          }),
        )
        if (controller.signal.aborted) return
        fallbackMessage.value = cards.value.length
          ? 'Scryfall is unavailable. Showing cached tournament cards.'
          : 'Scryfall is unavailable, and no cached matching cards were found.'
      }
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

watch(
  () => props.modelValue,
  (value) => {
    if (value !== query.value) query.value = value
  },
)

// onUnmounted() runs cleanup when Vue removes this component from the page.
onMounted(() => {
  document.addEventListener('pointerdown', closeResultsWhenClickingOutside)
})

onUnmounted(() => {
  window.clearTimeout(searchTimer)
  activeController?.abort()
  document.removeEventListener('pointerdown', closeResultsWhenClickingOutside)
})

function isCardSelected(card: ScryfallCard): boolean {
  return selectedCardIdSet.value.has(card.id)
}

function selectCard(card: ScryfallCard) {
  emit('card-selected', card)
  if (props.clearOnSelect) {
    query.value = ''
  } else if (props.retainSelectedName) {
    suppressNextSearch = true
    query.value = card.name
    cards.value = []
  }
}

function removeSelectedCard(card: ScryfallCard) {
  if (props.selectedCards.length) emit('card-removed', card)
  else {
    query.value = ''
    emit('cleared')
  }
}

function closeResultsWhenClickingOutside(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node) || searchRoot.value?.contains(target)) return

  window.clearTimeout(searchTimer)
  activeController?.abort()
  activeController = null
  resultsVisible.value = false
  isLoading.value = false
}

function openResults() {
  if (query.value.trim()) resultsVisible.value = true
}

function filterResults(results: ScryfallCard[]): ScryfallCard[] {
  return props.resultFilter ? results.filter(props.resultFilter) : results
}

function getCastingCost(card: ScryfallCard): string {
  if (card.mana_cost) return card.mana_cost
  return (card.card_faces ?? [])
    .map((face) => face.mana_cost)
    .filter((cost): cost is string => Boolean(cost))
    .join(' // ')
}

function getFallbackColorIdentity(searchFilter: string): string[] | undefined {
  if (/\bid:c\b/i.test(searchFilter)) return []
  const match = searchFilter.match(/\bid<=([wubrg]+)\b/i)
  return match?.[1]?.toUpperCase().split('')
}
</script>

<style scoped>
.card-search {
  position: relative;
  width: 100%;
}

.card-search--elevated {
  z-index: 20;
}

.card-search--elevated .search-results {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.38);
  left: 0;
  min-height: 0;
  padding: 8px;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 30;
}

.selected-card-chip {
  max-width: min(240px, 40vw);
}

.card-search :deep(.v-field__prepend-inner) {
  flex-wrap: wrap;
  gap: 4px;
  max-width: 100%;
}

.card-result-name {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}

.card-result-name > span:first-child {
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-result-mana-cost {
  max-width: 100%;
}

.selected-card-chip :deep(.v-chip__content) {
  justify-content: center;
  overflow: hidden;
}

.selected-card-chip__label {
  display: block;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-card-chip__close {
  align-items: center;
  background: transparent;
  border: 0;
  color: currentColor;
  cursor: pointer;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 1rem;
  height: 18px;
  justify-content: center;
  line-height: 1;
  margin-inline-start: 4px;
  opacity: 0.82;
  padding: 0;
  width: 18px;
}

.selected-card-chip__close:hover,
.selected-card-chip__close:focus-visible {
  opacity: 1;
  outline: none;
}

.selected-card-chip:has(.selected-card-chip__close:hover),
.selected-card-chip:has(.selected-card-chip__close:focus-visible) {
  border-color: rgb(var(--v-theme-error)) !important;
  color: rgb(var(--v-theme-error)) !important;
}
</style>
