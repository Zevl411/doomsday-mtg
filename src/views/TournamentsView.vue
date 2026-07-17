<template>
  <v-container class="pa-0" fluid>
    <h1 class="mb-1 text-h4 font-weight-bold">Tournaments</h1>
    <p class="mb-6 text-medium-emphasis">
      Normalized cEDH results with links to their original source.
    </p>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error">{{ errorMessage }}</v-alert>
    <v-card v-else-if="!tournaments.length" class="pa-8 text-center">
      No tournaments have been imported yet.
    </v-card>
    <v-list v-else border>
      <v-list-item
        v-for="tournament in tournaments"
        :key="tournament.id"
        :subtitle="`${formatDate(tournament.date)} · ${tournament.playerCount ?? 'Unknown'} players · ${tournament.entryCount ?? 0} entries · ${tournament.source}`"
        :title="tournament.name"
        :to="{ name: 'tournament-detail', params: { tournamentId: tournament.id } }"
      />
    </v-list>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Tournament } from '../models/tournament'
import { tournamentRepository } from '../repositories/tournamentRepository'

const tournaments = ref<Tournament[]>([])
const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    tournaments.value = await tournamentRepository.getRecentTournaments()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load tournaments.'
  } finally {
    loading.value = false
  }
})

function formatDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString() : 'Unknown date'
}
</script>
