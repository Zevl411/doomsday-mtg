<template>
  <main class="search-page">
    <section class="search-panel">
      <h1>Choose a Commander</h1>

      <article v-if="selectedCommander" class="selected-commander">
        <img
          v-if="getCardImage(selectedCommander)"
          :src="getCardImage(selectedCommander)"
          :alt="`${selectedCommander.name} card art`"
        />
        <div>
          <p class="section-label">Selected commander</p>
          <h2>{{ selectedCommander.name }}</h2>
          <p>{{ selectedCommander.type_line }}</p>
          <p>
            Color identity: {{ formatColorIdentity(selectedCommander) }}
          </p>
          <button class="clear-button" type="button" @click="clearCommander">
            Clear commander
          </button>
        </div>
      </article>

      <CardSearch commander-only @card-selected="selectCommander" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
// Importing a Vue component makes its tag available in this template.
import CardSearch from './components/CardSearch.vue'
import type { ScryfallCard } from './types/card'

// `ScryfallCard | null` means this ref holds either a selected card or nothing.
const selectedCommander = ref<ScryfallCard | null>(null)

function selectCommander(card: ScryfallCard) {
  selectedCommander.value = card
}

function clearCommander() {
  selectedCommander.value = null
}

function getCardImage(card: ScryfallCard): string | undefined {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal
}

function formatColorIdentity(card: ScryfallCard): string {
  return card.color_identity.join(', ') || 'Colorless'
}
</script>
