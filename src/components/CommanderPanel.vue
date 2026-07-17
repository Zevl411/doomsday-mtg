<template>
  <section class="app-panel commander-panel">
    <h2>Commander</h2>

    <article v-if="commander" class="selected-commander">
      <img
        v-if="getCardImage(commander)"
        :src="getCardImage(commander)"
        :alt="`${commander.name} card art`"
      />
      <div>
        <h3>{{ commander.name }}</h3>
        <p>{{ commander.type_line }}</p>
        <p>Color identity: {{ formatColorIdentity(commander) }}</p>
        <button
          class="clear-button"
          type="button"
          @click="emit('clear-commander')"
        >
          Clear commander
        </button>
      </div>
    </article>

    <p v-else class="placeholder-text">No commander selected.</p>
  </section>
</template>

<script setup lang="ts">
import type { ScryfallCard } from '../types/card'

defineProps<{
  commander: ScryfallCard | null
}>()

const emit = defineEmits<{
  'clear-commander': []
}>()

function getCardImage(card: ScryfallCard): string | undefined {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal
}

function formatColorIdentity(card: ScryfallCard): string {
  return card.color_identity.join(', ') || 'Colorless'
}
</script>
