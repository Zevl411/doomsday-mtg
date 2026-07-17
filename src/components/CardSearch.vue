<template>
  <label class="sr-only" :for="searchInputId">Search for a Magic card</label>
  <input
    :id="searchInputId"
    v-model="query"
    type="search"
    placeholder="Card name"
    autocomplete="off"
  />

  <div class="results" aria-live="polite">
    <p v-if="isLoading" class="status">Searching…</p>
    <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>
    <ul v-else-if="cards.length">
      <li v-for="card in cards" :key="card.id">
        <button
          class="card-result"
          type="button"
          @click="emit('card-selected', card)"
        >
          <img
            v-if="getCardImage(card)"
            :src="getCardImage(card)"
            :alt="`${card.name} card art`"
          />
          <span class="card-result-details">
            <strong>{{ card.name }}</strong>
            <span>{{ card.type_line }}</span>
            <span>Color identity: {{ formatColorIdentity(card) }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, useId, watch } from 'vue'
import { searchCards } from '../api/scryfall'
import type { ScryfallCard } from '../types/card'

// Props are values a parent component can pass into this component.
const props = withDefaults(defineProps<{ commanderOnly?: boolean }>(), {
  commanderOnly: false,
})

// Emits describe events this component can send back to its parent. The tuple
// says that card-selected sends one value named card with the ScryfallCard type.
const emit = defineEmits<{
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

// watch() runs this function whenever the search query changes.
watch(query, (newQuery) => {
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
        : newQuery

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
</script>
