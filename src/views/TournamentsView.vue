<template>
  <v-container class="pa-0" fluid>
    <h1 class="mb-1 text-h4 font-weight-bold">Tournaments</h1>
    <p class="mb-6 text-medium-emphasis">
      cEDH results with links to their original source.
    </p>
    <v-card class="mb-5 pa-3" border>
      <v-row align="center" density="comfortable">
        <v-col cols="12" sm="6" lg="3">
          <v-select
            v-model="sizeRange"
            density="compact"
            hide-details
            :items="sizeRangeOptions"
            label="Tournament size"
          />
        </v-col>
        <v-col cols="12" sm="6" lg="3">
          <v-select
            v-model="timePeriod"
            density="compact"
            hide-details
            :items="timePeriodOptions"
            label="Time period"
          />
        </v-col>
        <v-col cols="12" sm="6" lg="3">
          <v-select
            v-model="sortOrder"
            density="compact"
            hide-details
            :items="sortOptions"
            label="Sort by"
          />
        </v-col>
        <v-col
          class="d-flex align-center ga-2"
          cols="12"
          sm="6"
          lg="3"
        >
          <v-btn color="primary" size="small" @click="load">Apply</v-btn>
          <v-switch
            v-model="registeredCommandersOnly"
            aria-label="Show tournaments with registered commanders only"
            color="secondary"
            density="compact"
            hide-details
            inset
            label="Registered only"
          />
        </v-col>
      </v-row>
    </v-card>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error">{{ errorMessage }}</v-alert>
    <v-card v-else-if="!visibleTournaments.length" class="pa-8 text-center">
      {{
        tournaments.length
          ? 'No tournaments with registered commanders match these filters.'
          : 'No tournaments have been imported yet.'
      }}
    </v-card>
    <v-list v-else border>
      <v-list-item
        v-for="tournament in visibleTournaments"
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
import { computed, onMounted, ref, watch } from 'vue'
import type { Tournament } from '../models/tournament'
import {
  tournamentFilterRepository,
  type TournamentSizeRange,
  type TournamentSortOrder,
  type TournamentTimePeriod,
} from '../repositories/tournamentFilterRepository'
import { tournamentRepository } from '../repositories/tournamentRepository'
import {
  displayTournamentLocation,
  sourceAttribution,
} from '../utils/tournamentLocation'

const tournaments = ref<Tournament[]>([])
const loading = ref(true)
const errorMessage = ref('')
const savedFilters = tournamentFilterRepository.load()
const sizeRange = ref<TournamentSizeRange>(
  savedFilters?.sizeRange ?? 'standard',
)
const timePeriod = ref<TournamentTimePeriod>(
  savedFilters?.timePeriod ?? 'all',
)
const sortOrder = ref<TournamentSortOrder>(
  savedFilters?.sortOrder ?? 'date-desc',
)
// The default keeps unresolved tournament shells out of the primary list.
const registeredCommandersOnly = ref(
  savedFilters?.registeredCommandersOnly ?? true,
)
const visibleTournaments = computed(() =>
  registeredCommandersOnly.value
    ? tournaments.value.filter(
        // A single resolved entry should not qualify an otherwise empty event.
        // Half coverage keeps partially imported but still useful events.
        (tournament) => (tournament.commanderRegistrationRate ?? 0) >= 0.5,
      )
    : tournaments.value,
)

const sizeRangeOptions = [
  { title: 'Fewer than 16 players', value: 'small' },
  { title: '16–50 players', value: 'standard' },
  { title: '50–100 players', value: 'large' },
  { title: '100+ players', value: 'major' },
]
const timePeriodOptions = [
  { title: 'Last 30 days', value: '30-days' },
  { title: 'Last 3 months', value: '3-months' },
  { title: 'Last 6 months', value: '6-months' },
  { title: 'Last year', value: '1-year' },
  { title: 'All time', value: 'all' },
]
const sortOptions = [
  { title: 'Date: newest first', value: 'date-desc' },
  { title: 'Date: oldest first', value: 'date-asc' },
  { title: 'Tournament size: largest first', value: 'size-desc' },
  { title: 'Tournament size: smallest first', value: 'size-asc' },
]

watch(
  [
    sizeRange,
    timePeriod,
    sortOrder,
    registeredCommandersOnly,
  ],
  () => {
    tournamentFilterRepository.save({
      sizeRange: sizeRange.value,
      timePeriod: timePeriod.value,
      sortOrder: sortOrder.value,
      registeredCommandersOnly: registeredCommandersOnly.value,
    })
  },
)

async function load() {
  loading.value = true
  try {
    tournaments.value = await tournamentRepository.getRecentTournaments({
      ...getSizeFilters(),
      startDate: getStartDate(),
      tournamentSort: sortOrder.value.startsWith('size')
        ? 'player-count'
        : 'date',
      sortAscending: sortOrder.value.endsWith('asc'),
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load tournaments.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function formatDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString() : 'Unknown date'
}

function getSizeFilters(): {
  minimumPlayers?: number
  maximumPlayers?: number
} {
  if (sizeRange.value === 'small') return { maximumPlayers: 15 }
  if (sizeRange.value === 'standard') {
    return { minimumPlayers: 16, maximumPlayers: 50 }
  }
  if (sizeRange.value === 'large') {
    return { minimumPlayers: 50, maximumPlayers: 100 }
  }
  return { minimumPlayers: 100 }
}

function getStartDate(): string | undefined {
  if (timePeriod.value === 'all') return undefined

  const date = new Date()
  if (timePeriod.value === '30-days') date.setDate(date.getDate() - 30)
  if (timePeriod.value === '3-months') date.setMonth(date.getMonth() - 3)
  if (timePeriod.value === '6-months') date.setMonth(date.getMonth() - 6)
  if (timePeriod.value === '1-year') {
    date.setFullYear(date.getFullYear() - 1)
  }
  return date.toISOString()
}
</script>
