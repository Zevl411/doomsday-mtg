<template>
  <v-container class="pa-0" fluid>
    <h1 class="mb-1 text-h4 font-weight-bold">Tournaments</h1>
    <p class="mb-6 text-medium-emphasis">
      Normalized cEDH results with links to their original source.
    </p>
    <v-card v-if="locationOptions.regions.length" class="mb-5 pa-4" border>
      <v-row>
        <v-col cols="12" sm="4">
          <v-select v-model="countryCode" clearable :items="locationOptions.countries" label="Event country" />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select v-model="stateRegion" clearable :items="locationOptions.states" label="Event state/province" />
        </v-col>
        <v-col class="d-flex align-center" cols="12" sm="4">
          <v-btn color="primary" @click="load">Apply filters</v-btn>
        </v-col>
      </v-row>
    </v-card>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error">{{ errorMessage }}</v-alert>
    <v-card v-else-if="!tournaments.length" class="pa-8 text-center">
      No tournaments have been imported yet.
    </v-card>
    <v-list v-else border>
      <v-list-item
        v-for="tournament in tournaments"
        :key="tournament.id"
        :subtitle="`${formatDate(tournament.date)} · ${displayTournamentLocation(tournament)} · ${tournament.playerCount ?? 'Unknown'} players · ${tournament.entryCount ?? 0} entries · ${tournament.source}`"
        :title="tournament.name"
        :to="{ name: 'tournament-detail', params: { tournamentId: tournament.id } }"
      >
        <template #append>
          <a
            :href="sourceAttribution(tournament.source).url"
            rel="noopener noreferrer"
            target="_blank"
            @click.stop
          >
            {{ tournament.source === 'topdeck' ? 'TopDeck.gg' : 'EDHTop16' }}
          </a>
        </template>
      </v-list-item>
    </v-list>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Tournament } from '../models/tournament'
import {
  tournamentRepository,
  type TournamentLocationOptions,
} from '../repositories/tournamentRepository'
import {
  displayTournamentLocation,
  sourceAttribution,
} from '../utils/tournamentLocation'

const tournaments = ref<Tournament[]>([])
const loading = ref(true)
const errorMessage = ref('')
const countryCode = ref<string>()
const stateRegion = ref<string>()
const locationOptions = ref<TournamentLocationOptions>({
  countries: [], states: [], regions: [], hasOnline: false,
})

async function load() {
  loading.value = true
  try {
    tournaments.value = await tournamentRepository.getRecentTournaments({
      countryCode: countryCode.value,
      stateRegion: stateRegion.value,
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load tournaments.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    locationOptions.value = await tournamentRepository.getLocationOptions()
  } catch {
    // Filters remain hidden when the migration has no location data yet.
  }
  await load()
})

function formatDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString() : 'Unknown date'
}
</script>
