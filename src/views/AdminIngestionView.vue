<template>
  <v-container class="pa-0" fluid>
    <v-progress-linear v-if="checkingAccess" indeterminate />
    <v-alert v-else-if="!isAdmin" type="error">
      You do not have permission to ingest tournament data.
    </v-alert>
    <v-card v-else border class="pa-5" max-width="720">
      <h1 class="text-h5 font-weight-bold mb-4">Tournament ingestion</h1>
      <v-select v-model="provider" :items="['edhtop16']" label="Provider" />
      <v-row>
        <v-col><v-text-field v-model="startDate" label="Start date" type="date" /></v-col>
        <v-col><v-text-field v-model="endDate" label="End date" type="date" /></v-col>
      </v-row>
      <v-text-field v-model.number="minimumPlayers" label="Minimum players" min="0" type="number" />
      <v-switch v-model="dryRun" label="Dry run (validate without writing)" />
      <v-btn color="primary" :loading="running" @click="ingest">Run ingestion</v-btn>
      <v-alert v-if="errorMessage" class="mt-4" type="error">{{ errorMessage }}</v-alert>
      <pre v-if="report" class="mt-4 overflow-auto">{{ JSON.stringify(report, null, 2) }}</pre>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  ingestionRepository,
  type IngestionReport,
} from '../repositories/ingestionRepository'

const checkingAccess = ref(true)
const isAdmin = ref(false)
const running = ref(false)
const provider = ref<'edhtop16'>('edhtop16')
const startDate = ref('')
const endDate = ref('')
const minimumPlayers = ref(0)
const dryRun = ref(true)
const report = ref<IngestionReport | null>(null)
const errorMessage = ref('')

onMounted(async () => {
  isAdmin.value = await ingestionRepository.isCurrentUserAdmin()
  checkingAccess.value = false
})

async function ingest() {
  running.value = true
  errorMessage.value = ''
  try {
    report.value = await ingestionRepository.ingest({
      provider: provider.value,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      minimumPlayers: minimumPlayers.value,
      dryRun: dryRun.value,
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Ingestion failed.'
  } finally {
    running.value = false
  }
}
</script>
