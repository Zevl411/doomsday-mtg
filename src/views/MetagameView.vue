<template>
  <v-container class="pa-0" fluid>
    <div class="d-flex flex-wrap align-start justify-space-between ga-3 mb-6">
      <div>
      <h1 class="text-h4 font-weight-bold">Commander metagame</h1>
      <p class="text-medium-emphasis">
        Normalized tournament results from TopDeck and EDHTop16. Percentages
        include their sample sizes and reflect the selected filters.
      </p>
      <p class="text-caption">
        Data provided by
        <a href="https://topdeck.gg" target="_blank" rel="noopener noreferrer">TopDeck.gg</a>
        and
        <a href="https://edhtop16.com" target="_blank" rel="noopener noreferrer">EDHTop16</a>.
      </p>
      </div>
      <v-btn :to="{ name: 'card-associations' }" variant="outlined">
        Card associations
      </v-btn>
    </div>

    <v-card border class="mb-6 pa-4" color="surface" rounded="lg">
      <v-row>
        <v-col cols="12" sm="6" md="3">
          <v-text-field v-model="startDate" label="Start date" type="date" />
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-text-field v-model="endDate" label="End date" type="date" />
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-text-field
            v-model.number="minimumPlayers"
            label="Minimum players"
            min="0"
            type="number"
          />
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-text-field
            v-model.number="minimumEntries"
            label="Minimum entries"
            min="1"
            type="number"
          />
        </v-col>
        <v-col class="d-flex ga-2" cols="12" md="2">
          <v-btn color="primary" @click="load">Apply</v-btn>
          <v-btn variant="text" @click="reset">Reset</v-btn>
        </v-col>
      </v-row>
      <v-row v-if="locationOptions.regions.length">
        <v-col cols="12" sm="4">
          <v-select
            v-model="countryCode"
            clearable
            :items="locationOptions.countries"
            label="Event country"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="stateRegion"
            clearable
            :items="locationOptions.states"
            label="Event state/province"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="onlineFilter"
            clearable
            :items="onlineItems"
            item-title="title"
            item-value="value"
            label="Event setting"
          />
        </v-col>
      </v-row>
    </v-card>

    <v-progress-linear v-if="loading" color="primary" indeterminate />
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <v-card v-else-if="!stats.length" border class="pa-8 text-center">
      No tournament results match these filters.
    </v-card>
    <v-card v-else border color="surface">
      <v-table>
        <thead>
          <tr>
            <th>Commander</th>
            <th>Entries</th>
            <th>Meta share</th>
            <th>Match win rate</th>
            <th>Top {{ topFinishThreshold }}</th>
            <th>Top-cut rate</th>
            <th>Wins</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in stats" :key="item.commanderKey">
            <td>
              <RouterLink
                :to="{
                  name: 'commander-metagame',
                  params: { commanderKey: item.commanderKey },
                }"
              >
                {{ item.commanderName }}
              </RouterLink>
              <ColorIdentitySymbols
                class="ml-2"
                :colors="item.colorIdentity"
                size="small"
              />
            </td>
            <td>{{ item.entries }}</td>
            <td>{{ percent(item.metaShare) }}</td>
            <td>{{ percent(item.matchWinRate) }}</td>
            <td>{{ item.top16Finishes }}</td>
            <td>{{ percent(item.topCutRate) }}</td>
            <td>{{ item.firstPlaceFinishes }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import type { CommanderMetagameStats } from '../models/tournament'
import {
  tournamentRepository,
  type TournamentLocationOptions,
} from '../repositories/tournamentRepository'

const stats = ref<CommanderMetagameStats[]>([])
const loading = ref(false)
const errorMessage = ref('')
const startDate = ref('')
const endDate = ref('')
const minimumPlayers = ref(0)
const minimumEntries = ref(1)
const topFinishThreshold = 16
const countryCode = ref<string>()
const stateRegion = ref<string>()
const onlineFilter = ref<boolean>()
const locationOptions = ref<TournamentLocationOptions>({
  countries: [], states: [], regions: [], hasOnline: false,
})
const onlineItems = [
  { title: 'Online', value: true },
  { title: 'In person', value: false },
]

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    stats.value = await tournamentRepository.getCommanderMetagame({
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      minimumPlayers: minimumPlayers.value,
      minimumEntries: minimumEntries.value,
      topFinishThreshold,
      countryCode: countryCode.value,
      stateRegion: stateRegion.value,
      isOnline: onlineFilter.value,
    })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load metagame data.'
  } finally {
    loading.value = false
  }
}

function reset() {
  startDate.value = ''
  endDate.value = ''
  minimumPlayers.value = 0
  minimumEntries.value = 1
  countryCode.value = undefined
  stateRegion.value = undefined
  onlineFilter.value = undefined
  void load()
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

onMounted(async () => {
  try {
    locationOptions.value = await tournamentRepository.getLocationOptions()
  } catch {
    // Regional filters stay hidden when location metadata is unavailable.
  }
  await load()
})
</script>
