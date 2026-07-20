<template>
  <v-progress-linear v-if="loading" indeterminate />
  <v-alert v-else-if="error" type="error" variant="tonal">{{ error }}</v-alert>
  <div v-else-if="deck">
    <div class="d-flex flex-wrap align-start justify-space-between ga-4 mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">{{ deck.name }}</h1>
        <p>Created by {{ deck.creatorUsername ?? 'Unknown' }}</p>
        <p class="mt-2 text-medium-emphasis">{{ deck.description }}</p>
      </div>
      <v-btn color="primary" @click="copyDeck">
        <DeckActionIcon name="duplicate" />
        Duplicate
      </v-btn>
    </div>
    <v-card border>
      <v-card-title>Commander</v-card-title>
      <v-card-text>{{ deck.commander?.name ?? 'No Commander' }}</v-card-text>
      <v-divider />
      <v-card-title>Mainboard</v-card-title>
      <v-list>
        <v-list-item
          v-for="entry in deck.cards"
          :key="entry.card.id"
          :title="`${entry.quantity}× ${entry.card.name}`"
        />
      </v-list>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Deck } from '../models/deck'
import { sharedDeckRepository } from '../repositories/sharedDeckRepository'
import { useDeckStore } from '../stores/deck'
import { useAuthStore } from '../stores/auth'
import DeckActionIcon from '../components/DeckActionIcon.vue'
const route = useRoute()
const router = useRouter()
const store = useDeckStore()
const auth = useAuthStore()
const deck = ref<Deck | null>(null)
const loading = ref(true)
const error = ref('')
onMounted(async () => {
  try {
    deck.value = await sharedDeckRepository.getAccessible(String(route.params.deckId))
    if (!deck.value) error.value = 'This deck is private or does not exist.'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load deck.'
  } finally { loading.value = false }
})
function copyDeck() {
  if (!deck.value) return
  const copy = store.copyExternalDeck(
    deck.value,
    `${deck.value.name} (copied from ${deck.value.creatorUsername ?? 'Unknown'})`,
    'unlisted',
    auth.username,
  )
  void router.push({
    name: 'deck-builder',
    params: { deckId: copy.id },
  })
}
</script>
