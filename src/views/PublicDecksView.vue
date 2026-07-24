<template>
  <v-container class="pa-0" fluid>
    <h1 class="text-h4 font-weight-bold">Public decks</h1>
    <p class="text-medium-emphasis mb-6">Decks shared publicly by their creators.</p>
    <AppLoadingSkeleton v-if="loading" :count="6" label="Loading public Decks" variant="cards" />
    <v-alert v-else-if="error" type="error" variant="tonal">
      {{ error }}
    </v-alert>
    <v-row v-else-if="decks.length">
      <v-col v-for="deck in decks" :key="deck.id" cols="12" md="6" lg="4">
        <DeckLibraryCard :deck="deck" :manageable="false" @open="openDeck" />
      </v-col>
    </v-row>
    <v-card v-else border class="pa-8 text-center" color="surface" rounded="lg">
      <v-card-title>No public decks yet</v-card-title>
      <v-card-text> Public decks will appear here when their creators share them. </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useRouter } from 'vue-router';

import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue';
import DeckLibraryCard from '../components/DeckLibraryCard.vue';
import { sharedDeckRepository } from '../repositories/sharedDeckRepository';

import type { Deck } from '../models/deck';

const router = useRouter();
const decks = ref<Deck[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    decks.value = await sharedDeckRepository.listPublic();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load decks.';
  } finally {
    loading.value = false;
  }
});

function openDeck(deckId: string) {
  void router.push({
    name: 'shared-deck',
    params: { deckId },
  });
}
</script>
