<template>
  <div>
    <h1 class="text-h4 font-weight-bold">Public decks</h1>
    <p class="text-medium-emphasis mb-6">Decks shared publicly by their creators.</p>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="error" type="error" variant="tonal">{{ error }}</v-alert>
    <v-row v-else>
      <v-col v-for="deck in decks" :key="deck.id" cols="12" md="6" lg="4">
        <v-card border height="100%" :to="{ name: 'shared-deck', params: { deckId: deck.id } }">
          <v-card-title>{{ deck.name }}</v-card-title>
          <v-card-subtitle>By {{ deck.creatorUsername ?? 'Unknown' }}</v-card-subtitle>
          <v-card-text>
            {{ deck.description || 'No description.' }}
            <div class="mt-3">{{ deck.cards.length }} unique mainboard cards</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Deck } from '../models/deck'
import { sharedDeckRepository } from '../repositories/sharedDeckRepository'
const decks = ref<Deck[]>([])
const loading = ref(true)
const error = ref('')
onMounted(async () => {
  try { decks.value = await sharedDeckRepository.listPublic() }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to load decks.' }
  finally { loading.value = false }
})
</script>
