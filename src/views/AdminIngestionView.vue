<template>
  <v-container class="pa-0" fluid>
    <v-progress-linear v-if="checkingAccess" color="primary" indeterminate />

    <v-alert v-else-if="!isAdmin" type="error" variant="tonal">
      You do not have permission to access the admin panel.
    </v-alert>

    <template v-else>
      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-6">
        <div>
          <h1 class="text-h4 font-weight-bold">Admin Panel</h1>
          <p class="text-medium-emphasis">
            Monitor normalized tournament data and run provider ingestion.
          </p>
        </div>
        <v-btn
          color="secondary"
          :loading="loadingMetrics"
          prepend-icon="mdi-refresh"
          variant="outlined"
          @click="loadMetrics"
        >
          Refresh data
        </v-btn>
      </div>

      <v-alert
        v-if="metricsError"
        class="mb-5"
        type="error"
        variant="tonal"
      >
        {{ metricsError }}
      </v-alert>

      <v-row v-if="metrics" class="mb-2">
        <v-col
          v-for="metric in metricCards"
          :key="metric.label"
          cols="12"
          sm="6"
          lg="3"
        >
          <v-card border color="surface" height="100%" variant="flat">
            <v-card-text>
              <div class="text-overline text-medium-emphasis">
                {{ metric.label }}
              </div>
              <div class="text-h4 font-weight-bold text-primary">
                {{ metric.value }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ metric.detail }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row align="start">
        <v-col cols="12" lg="5">
          <v-card border color="surface" variant="flat">
            <v-card-item>
              <v-card-title>Tournament ingestion</v-card-title>
              <v-card-subtitle>
                Fetch and normalize provider tournament records
              </v-card-subtitle>
            </v-card-item>
            <v-card-text>
              <v-select
                v-model="provider"
                :items="providerItems"
                item-title="title"
                item-value="value"
                label="Provider"
                variant="outlined"
              />
              <v-alert class="mb-4" type="info" variant="tonal">
                {{ providerDescription }}
              </v-alert>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="startDate"
                    label="Start date"
                    type="date"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="endDate"
                    label="End date"
                    type="date"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
              <v-text-field
                v-model.number="minimumPlayers"
                label="Minimum players"
                min="0"
                type="number"
                variant="outlined"
              />
              <v-row v-if="provider === 'topdeck'">
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="maximumPlayers"
                    clearable
                    label="Maximum players (optional)"
                    min="0"
                    type="number"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="lastDays"
                    clearable
                    label="Last number of days (optional)"
                    min="1"
                    type="number"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
              <v-textarea
                v-model="tournamentIds"
                label="Tournament IDs (optional)"
                placeholder="One TopDeck TID per line"
                rows="2"
                variant="outlined"
              />
              <v-switch
                v-if="provider === 'topdeck'"
                v-model="includeRounds"
                color="primary"
                label="Include rounds (larger response)"
              />
              <v-switch
                v-if="provider === 'topdeck'"
                v-model="enrichLocation"
                color="primary"
                label="Enrich missing locations"
              />
              <v-switch
                v-model="dryRun"
                color="primary"
                label="Dry run (validate without writing)"
              />
              <v-btn
                block
                color="primary"
                :loading="running"
                size="large"
                @click="ingest"
              >
                Run ingestion
              </v-btn>

              <v-alert
                v-if="errorMessage"
                class="mt-4"
                type="error"
                variant="tonal"
              >
                {{ errorMessage }}
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" lg="7">
          <v-card border color="surface" variant="flat">
            <v-card-item>
              <v-card-title>Recently imported tournaments</v-card-title>
              <v-card-subtitle>
                The ten most recently refreshed records
              </v-card-subtitle>
            </v-card-item>
            <v-table>
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Provider</th>
                  <th>Players</th>
                  <th>Event date</th>
                  <th>Imported</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="tournament in metrics?.recentTournaments ?? []"
                  :key="tournament.id"
                >
                  <td>
                    <RouterLink
                      :to="{
                        name: 'tournament-detail',
                        params: { tournamentId: tournament.id },
                      }"
                    >
                      {{ tournament.name }}
                    </RouterLink>
                  </td>
                  <td>{{ tournament.source }}</td>
                  <td>{{ tournament.playerCount ?? '—' }}</td>
                  <td>{{ formatDate(tournament.eventDate) }}</td>
                  <td>{{ formatDate(tournament.importedAt, true) }}</td>
                </tr>
                <tr v-if="!metrics?.recentTournaments.length">
                  <td class="text-center text-medium-emphasis" colspan="5">
                    No tournament records have been imported.
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>

      <v-card border class="mt-6" color="surface" variant="flat">
        <v-card-item>
          <v-card-title>Historical backfill</v-card-title>
          <v-card-subtitle>
            Creates resumable seven-day jobs processed safely in the background
          </v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" sm="3">
              <v-text-field
                v-model="jobStartDate"
                label="Historical start"
                type="date"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field
                v-model="jobEndDate"
                label="Historical end"
                type="date"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" sm="2">
              <v-text-field
                v-model.number="jobWindowDays"
                label="Batch days"
                max="15"
                min="1"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" sm="2">
              <v-text-field
                v-model.number="jobMinimumPlayers"
                label="Minimum players"
                min="0"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col class="d-flex align-center" cols="12" sm="2">
              <v-btn
                block
                color="primary"
                :disabled="!jobStartDate || !jobEndDate"
                :loading="creatingJob"
                @click="createHistoricalJob"
              >
                Create job
              </v-btn>
            </v-col>
          </v-row>

          <v-alert v-if="jobError" class="mb-4" type="error" variant="tonal">
            {{ jobError }}
          </v-alert>
          <v-alert v-if="jobMessage" class="mb-4" type="success" variant="tonal">
            {{ jobMessage }}
          </v-alert>

          <v-list v-if="jobs.length" border>
            <v-list-item v-for="job in jobs" :key="job.id">
              <v-list-item-title>
                {{ job.provider }} · {{ job.startDate }} to {{ job.endDate }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ job.completedBatches }} / {{ job.totalBatches }} batches ·
                {{ job.failedBatches }} failed · {{ job.status }}
              </v-list-item-subtitle>
              <v-progress-linear
                class="mt-2"
                color="primary"
                :model-value="jobProgress(job)"
              />
              <v-alert
                v-if="job.lastError"
                class="mt-2"
                density="compact"
                type="warning"
                variant="tonal"
              >
                {{ job.lastError }}
              </v-alert>
              <template #append>
                <div class="d-flex ga-1">
                  <v-btn
                    v-if="job.status === 'running' || job.status === 'pending'"
                    size="small"
                    variant="text"
                    @click="changeJob(job.id, 'pause-job')"
                  >
                    Pause
                  </v-btn>
                  <v-btn
                    v-if="job.status === 'paused'"
                    size="small"
                    variant="text"
                    @click="changeJob(job.id, 'resume-job')"
                  >
                    Resume
                  </v-btn>
                  <v-btn
                    v-if="job.failedBatches"
                    size="small"
                    variant="text"
                    @click="changeJob(job.id, 'retry-job')"
                  >
                    Retry
                  </v-btn>
                  <v-btn
                    v-if="!['completed', 'cancelled'].includes(job.status)"
                    color="error"
                    size="small"
                    variant="text"
                    @click="changeJob(job.id, 'cancel-job')"
                  >
                    Cancel
                  </v-btn>
                </div>
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-medium-emphasis">
            No historical ingestion jobs have been created.
          </p>
        </v-card-text>
      </v-card>

      <v-card
        v-if="report"
        border
        class="mt-6"
        color="surface"
        variant="flat"
      >
        <v-card-item>
          <v-card-title>
            {{ report.dryRun ? 'Dry-run report' : 'Ingestion report' }}
          </v-card-title>
          <v-card-subtitle>
            Completed in {{ formatDuration(report.durationMs) }}
          </v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col
              v-for="item in reportItems"
              :key="item.label"
              cols="6"
              md="3"
            >
              <v-sheet class="pa-3" color="surface-light" rounded="lg">
                <div class="text-caption text-medium-emphasis">
                  {{ item.label }}
                </div>
                <div class="text-h6 font-weight-bold">{{ item.value }}</div>
              </v-sheet>
            </v-col>
          </v-row>
          <v-alert
            v-if="report.providerErrors.length"
            class="mt-4"
            type="error"
            variant="tonal"
          >
            {{ report.providerErrors.join(' ') }}
          </v-alert>
          <v-alert
            v-if="report.validationIssues.length"
            class="mt-4"
            type="warning"
            variant="tonal"
          >
            {{ report.validationIssues.join(' ') }}
          </v-alert>
        </v-card-text>
      </v-card>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ingestionRepository,
  type IngestionDashboardMetrics,
  type IngestionJob,
  type IngestionReport,
} from '../repositories/ingestionRepository'

const checkingAccess = ref(true)
const isAdmin = ref(false)
const loadingMetrics = ref(false)
const metrics = ref<IngestionDashboardMetrics | null>(null)
const metricsError = ref('')
const running = ref(false)
const provider = ref<'edhtop16' | 'topdeck'>('topdeck')
const startDate = ref('')
const endDate = ref('')
const minimumPlayers = ref(0)
const maximumPlayers = ref<number>()
const lastDays = ref<number>()
const dryRun = ref(true)
const tournamentIds = ref('')
const includeRounds = ref(false)
const enrichLocation = ref(false)
const report = ref<IngestionReport | null>(null)
const errorMessage = ref('')
const jobs = ref<IngestionJob[]>([])
const creatingJob = ref(false)
const jobStartDate = ref('')
const jobEndDate = ref('')
const jobWindowDays = ref(7)
const jobMinimumPlayers = ref(0)
const jobError = ref('')
const jobMessage = ref('')
const providerItems = [
  { title: 'TopDeck (recommended)', value: 'topdeck' },
  { title: 'EDHTop16', value: 'edhtop16' },
]
const providerDescription = computed(() =>
  provider.value === 'topdeck'
    ? 'Direct tournament platform data with location and structured decklist support.'
    : 'Aggregated cEDH data useful for historical and curated coverage.',
)

const metricCards = computed(() => [
  {
    label: 'Tournaments',
    value: metrics.value?.tournamentCount.toLocaleString() ?? '0',
    detail: 'Normalized tournament records',
  },
  {
    label: 'Entries',
    value: metrics.value?.entryCount.toLocaleString() ?? '0',
    detail: 'Player and deck placements',
  },
  {
    label: 'Linked decklists',
    value: metrics.value?.linkedDecklistCount.toLocaleString() ?? '0',
    detail: 'Entries with viewable source lists',
  },
  {
    label: 'Latest import',
    value: formatDate(metrics.value?.latestImportAt ?? null, true),
    detail: 'Most recent tournament refresh',
  },
  {
    label: 'TopDeck coverage',
    value: metrics.value?.topDeckCount.toLocaleString() ?? '0',
    detail: 'Direct provider records',
  },
  {
    label: 'EDHTop16 coverage',
    value: metrics.value?.edhTop16Count.toLocaleString() ?? '0',
    detail: 'Aggregate provider records',
  },
  {
    label: 'Known locations',
    value: metrics.value?.locationCount.toLocaleString() ?? '0',
    detail: `${metrics.value?.unknownLocationCount ?? 0} unknown`,
  },
  {
    label: 'Extraction issues',
    value: metrics.value?.commanderFailureCount.toLocaleString() ?? '0',
    detail: `${metrics.value?.structuredDeckCount ?? 0} structured decklists`,
  },
  {
    label: 'Possible matches',
    value: metrics.value?.possibleMatchCount.toLocaleString() ?? '0',
    detail: 'Moderate evidence; never auto-merged',
  },
  {
    label: 'Source links',
    value: metrics.value?.linkedEventCount.toLocaleString() ?? '0',
    detail: 'Explicit provider identities',
  },
])

const reportItems = computed(() => {
  if (!report.value) return []
  return [
    { label: 'Tournaments fetched', value: report.value.tournamentsFetched },
    { label: 'Tournaments added', value: report.value.tournamentsInserted },
    { label: 'Tournaments updated', value: report.value.tournamentsUpdated },
    { label: 'Entries fetched', value: report.value.entriesFetched },
    { label: 'Entries added', value: report.value.entriesInserted },
    { label: 'Entries updated', value: report.value.entriesUpdated },
    { label: 'Entries skipped', value: report.value.entriesSkipped },
    { label: 'Provider requests', value: report.value.requestsMade },
    { label: 'Retries', value: report.value.retries },
    { label: 'Rate limited', value: report.value.rateLimitedRequests },
    {
      label: 'Partial tournaments',
      value: report.value.tournamentsPartiallyIngested,
    },
    { label: 'Provider errors', value: report.value.providerErrors.length },
  ]
})

onMounted(async () => {
  try {
    isAdmin.value = await ingestionRepository.isCurrentUserAdmin()
    if (isAdmin.value) await loadMetrics()
  } finally {
    checkingAccess.value = false
  }
})

async function loadMetrics() {
  loadingMetrics.value = true
  metricsError.value = ''
  try {
    const [dashboard, historicalJobs] = await Promise.all([
      ingestionRepository.getDashboardMetrics(),
      ingestionRepository.getJobs(),
    ])
    metrics.value = dashboard
    jobs.value = historicalJobs
  } catch (error) {
    metricsError.value =
      error instanceof Error
        ? error.message
        : 'Unable to load admin dashboard metrics.'
  } finally {
    loadingMetrics.value = false
  }
}

async function createHistoricalJob() {
  creatingJob.value = true
  jobError.value = ''
  jobMessage.value = ''
  try {
    await ingestionRepository.createJob({
      provider: 'topdeck',
      startDate: jobStartDate.value,
      endDate: jobEndDate.value,
      windowDays: jobWindowDays.value,
      minimumPlayers: jobMinimumPlayers.value,
      includeRounds: false,
      enrichLocation: false,
    })
    jobMessage.value = 'Historical job created. The worker will process it in the background.'
    jobs.value = await ingestionRepository.getJobs()
  } catch (error) {
    jobError.value = error instanceof Error ? error.message : 'Unable to create job.'
  } finally {
    creatingJob.value = false
  }
}

async function changeJob(
  jobId: string,
  action: 'pause-job' | 'resume-job' | 'cancel-job' | 'retry-job',
) {
  jobError.value = ''
  try {
    await ingestionRepository.updateJob(jobId, action)
    jobs.value = await ingestionRepository.getJobs()
  } catch (error) {
    jobError.value = error instanceof Error ? error.message : 'Unable to update job.'
  }
}

function jobProgress(job: IngestionJob) {
  return job.totalBatches
    ? (job.completedBatches / job.totalBatches) * 100
    : 0
}

async function ingest() {
  running.value = true
  errorMessage.value = ''
  try {
    report.value = await ingestionRepository.ingest({
      provider: provider.value,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      minimumPlayers: minimumPlayers.value,
      maximumPlayers: maximumPlayers.value || undefined,
      last: lastDays.value || undefined,
      dryRun: dryRun.value,
      tournamentIds: tournamentIds.value
        .split(/[\n,]/)
        .map((id) => id.trim())
        .filter(Boolean),
      includeRounds: includeRounds.value,
      enrichLocation: enrichLocation.value,
    })
    if (!dryRun.value && !report.value.providerErrors.length) {
      await loadMetrics()
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Ingestion failed.'
  } finally {
    running.value = false
  }
}

function formatDate(value: string | null, includeTime = false): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(date)
}

function formatDuration(durationMs: number): string {
  return durationMs < 1000
    ? `${durationMs} ms`
    : `${(durationMs / 1000).toFixed(1)} s`
}
</script>
