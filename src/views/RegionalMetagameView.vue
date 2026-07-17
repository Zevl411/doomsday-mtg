<template>
  <v-container class="pa-0" fluid>
    <h1 class="text-h4 font-weight-bold">Regional metagame</h1>
    <p class="mb-6 text-medium-emphasis">
      Regions describe event locations, not where players live. Location
      coverage may be incomplete.
    </p>

    <v-card border class="mb-6 pa-4">
      <v-row>
        <v-col cols="12" sm="4">
          <v-text-field v-model="startDate" label="Start date" type="date" />
        </v-col>
        <v-col cols="12" sm="4">
          <v-text-field v-model="endDate" label="End date" type="date" />
        </v-col>
        <v-col cols="12" sm="2">
          <v-text-field
            v-model.number="minimumPlayers"
            label="Minimum players"
            min="0"
            type="number"
          />
        </v-col>
        <v-col class="d-flex align-center" cols="12" sm="2">
          <v-btn color="primary" @click="load">Apply</v-btn>
        </v-col>
      </v-row>
    </v-card>

    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <v-card v-else-if="!regions.length" class="pa-8 text-center" border>
      No regional tournament data matches these filters.
    </v-card>
    <v-card v-else border>
      <v-table>
        <thead>
          <tr>
            <th>Event region</th>
            <th>Tournaments</th>
            <th>Entries</th>
            <th>Average size</th>
            <th>Commanders</th>
            <th>Most played</th>
            <th>Top share</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="region in regions" :key="region.regionKey">
            <td>{{ region.displayName }}</td>
            <td>{{ region.tournaments }}</td>
            <td>{{ region.entries }}</td>
            <td>{{ region.averageTournamentSize.toFixed(1) }}</td>
            <td>{{ region.uniqueCommanders }}</td>
            <td>{{ region.topCommander ?? '—' }}</td>
            <td>
              {{
                region.entries
                  ? `${((region.topCommanderEntries / region.entries) * 100).toFixed(1)}%`
                  : '0%'
              }}
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { RegionalMetagameStats } from '../models/tournament'
import { tournamentRepository } from '../repositories/tournamentRepository'

const regions = ref<RegionalMetagameStats[]>([])
const startDate = ref('')
const endDate = ref('')
const minimumPlayers = ref(0)
const loading = ref(false)
const errorMessage = ref('')

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    regions.value = await tournamentRepository.getRegionalMetagame({
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      minimumPlayers: minimumPlayers.value,
    })
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Unable to load regional metagame data.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
