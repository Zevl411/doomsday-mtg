<template>
  <v-container class="pa-0" fluid>
    <AppLoadingSkeleton
      v-if="checkingAccess"
      :count="3"
      label="Checking data-health access"
      variant="compact"
    />
    <v-alert v-else-if="!isAdmin" type="error" variant="tonal">
      You do not have permission to access Data Health.
    </v-alert>

    <template v-else>
      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-6">
        <div>
          <h1 class="text-h4 font-weight-bold">Data Health</h1>
          <p class="text-medium-emphasis">
            Administrator-only production coverage and analytics readiness.
          </p>
          <p v-if="lastRefreshedAt" class="text-caption text-medium-emphasis">
            Last refreshed {{ formatDate(lastRefreshedAt) }}
          </p>
        </div>
        <div class="d-flex ga-2">
          <v-btn :to="{ name: 'admin-ingestion' }" variant="text">
            Ingestion
          </v-btn>
          <v-btn
            color="secondary"
            :loading="loading"
            prepend-icon="mdi-refresh"
            variant="outlined"
            @click="loadHealth"
          >
            Refresh
          </v-btn>
        </div>
      </div>

      <v-alert v-if="errorMessage" class="mb-5" type="error" variant="tonal">
        {{ errorMessage }}
      </v-alert>
      <AppLoadingSkeleton
        v-if="loading && !report"
        class="mb-5"
        :count="8"
        label="Loading data-health report"
        variant="table"
      />

      <template v-if="report">
        <v-row class="mb-3">
          <v-col
            v-for="metric in summaryCards"
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

        <v-card border class="mb-6" color="surface" variant="flat">
          <v-card-item>
            <v-card-title>Tournament and Decklist coverage</v-card-title>
            <v-card-subtitle>
              {{ formatDate(report.summary.firstEventDate) }} –
              {{ formatDate(report.summary.latestEventDate) }}
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-row>
              <v-col
                v-for="item in coverageItems"
                :key="item.label"
                cols="12"
                sm="6"
                md="4"
              >
                <v-list-item
                  :subtitle="item.detail"
                  :title="`${item.label}: ${item.value.toLocaleString()}`"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card border class="mb-6" color="surface" variant="flat">
          <v-card-item>
            <v-card-title>Regional coverage</v-card-title>
            <v-card-subtitle>Bounded production coverage by region key</v-card-subtitle>
          </v-card-item>
          <v-list v-if="report.regions.length">
            <v-list-item
              v-for="region in report.regions"
              :key="region.regionKey"
              :subtitle="`${region.entryCount} entries · ${region.completeDeckCount} complete Decks`"
              :title="`${region.regionKey}: ${region.tournamentCount} tournaments`"
            />
          </v-list>
          <v-card-text v-else>No known regional coverage.</v-card-text>
        </v-card>

        <v-card border class="mb-6" color="surface" variant="flat">
          <v-card-item>
            <v-card-title>Commander analytics readiness</v-card-title>
            <v-card-subtitle>
              Complete Deck samples; descriptive thresholds are not statistical
              guarantees.
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="4" md="2">
                <v-select
                  v-model="filters.sampleStatus"
                  clearable
                  density="compact"
                  hide-details
                  :items="sampleStatusItems"
                  label="Sample status"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="12" sm="4" md="2">
                <v-select
                  v-model="filters.provider"
                  clearable
                  density="compact"
                  hide-details
                  :items="providerItems"
                  label="Provider"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model="filters.startDate"
                  density="compact"
                  hide-details
                  label="Start date"
                  type="date"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model="filters.endDate"
                  density="compact"
                  hide-details
                  label="End date"
                  type="date"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-switch
                  v-model="filters.pairedOnly"
                  color="primary"
                  density="compact"
                  hide-details
                  label="Paired only"
                />
              </v-col>
            </v-row>
            <div class="d-flex justify-end my-3">
              <v-btn color="primary" variant="tonal" @click="loadHealth">
                Apply filters
              </v-btn>
            </div>
          </v-card-text>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Commander</th>
                <th>Complete</th>
                <th>Status</th>
                <th>Tournaments</th>
                <th>Date coverage</th>
                <th>Regions</th>
                <th>Paired</th>
                <th>Inclusion</th>
                <th>Comparison</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="commander in report.commanders" :key="commander.commanderKey">
                <td>
                  <v-btn
                    :to="{
                      name: 'commander-metagame',
                      params: { commanderKey: commander.commanderKey },
                      query: { inclusions: 'all' },
                    }"
                    variant="text"
                  >
                    {{ commander.commanderName }}
                  </v-btn>
                </td>
                <td>{{ commander.completeDeckCount }}</td>
                <td>
                  <v-chip :color="sampleColor(commander.sampleStatus)" size="small">
                    {{ commander.sampleStatus }}
                  </v-chip>
                </td>
                <td>{{ commander.tournamentCount }}</td>
                <td>
                  {{ formatDate(commander.firstEventDate) }} –
                  {{ formatDate(commander.latestEventDate) }}
                </td>
                <td>{{ commander.regionalSampleCount }}</td>
                <td>{{ commander.pairedCommander ? 'Yes' : 'No' }}</td>
                <td>{{ commander.inclusionReady ? 'Ready' : 'No' }}</td>
                <td>{{ commander.comparisonReady ? 'Ready' : 'Limited' }}</td>
              </tr>
              <tr v-if="!report.commanders.length">
                <td colspan="9">No Commanders match the selected filters.</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <v-card border class="mb-6" color="surface" variant="flat">
          <v-card-item>
            <v-card-title>Unresolved card diagnostics</v-card-title>
            <v-card-subtitle>
              Bounded identity failures; no fuzzy remapping is performed.
            </v-card-subtitle>
          </v-card-item>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Name</th>
                <th>Occurrences</th>
                <th>Decks</th>
                <th>Commanders</th>
                <th>First seen</th>
                <th>Last seen</th>
                <th>Providers</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="card in report.unresolvedCards" :key="card.normalizedName">
                <td>{{ card.displayName }}</td>
                <td>{{ card.occurrenceCount }}</td>
                <td>{{ card.affectedDeckCount }}</td>
                <td>{{ card.affectedCommanderCount }}</td>
                <td>{{ formatDate(card.firstSeenAt) }}</td>
                <td>{{ formatDate(card.lastSeenAt) }}</td>
                <td>{{ formatProviders(card.providerBreakdown) }}</td>
                <td>
                  <v-btn size="small" variant="text" @click="copyName(card.displayName)">
                    Copy
                  </v-btn>
                  <v-btn
                    :href="scryfallSearch(card.displayName)"
                    rel="noopener noreferrer"
                    size="small"
                    target="_blank"
                    variant="text"
                  >
                    Scryfall
                  </v-btn>
                </td>
              </tr>
              <tr v-if="!report.unresolvedCards.length">
                <td colspan="8">No unresolved cards match the selected filters.</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <v-row class="mb-6">
          <v-col cols="12" lg="6">
            <v-card border color="surface" height="100%" variant="flat">
              <v-card-item>
                <v-card-title>Ingestion health</v-card-title>
                <v-card-subtitle>Recent bounded job batches</v-card-subtitle>
              </v-card-item>
              <v-list v-if="report.jobs.length">
                <v-list-item
                  v-for="job in report.jobs"
                  :key="`${job.jobId}-${job.stage}-${job.startDate}`"
                  :subtitle="`${job.startDate} – ${job.endDate} · ${job.attempts} attempts · ${formatDate(job.updatedAt, true)}`"
                  :title="`${job.provider} · ${job.stage} · ${job.jobStatus}`"
                >
                  <template #append>
                    <v-chip
                      :color="job.stale || job.lastError ? 'error' : 'success'"
                      size="small"
                    >
                      {{ job.stale ? 'Stale' : job.lastError ? 'Error' : 'Healthy' }}
                    </v-chip>
                  </template>
                </v-list-item>
              </v-list>
              <v-card-text v-else>No ingestion job history matched.</v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" lg="6">
            <v-card border color="surface" height="100%" variant="flat">
              <v-card-item>
                <v-card-title>Consistency checks</v-card-title>
                <v-card-subtitle>Impossible relationships remain visible.</v-card-subtitle>
              </v-card-item>
              <v-list>
                <v-list-item
                  v-for="check in report.consistencyChecks"
                  :key="`${check.label}-${check.message}`"
                  :subtitle="check.message"
                  :title="check.label"
                >
                  <template #prepend>
                    <v-icon :color="check.status === 'pass' ? 'success' : 'warning'">
                      {{ check.status === 'pass' ? 'mdi-check-circle' : 'mdi-alert' }}
                    </v-icon>
                  </template>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
        </v-row>

        <v-card border color="surface" variant="flat">
          <v-card-item>
            <v-card-title>Production smoke test</v-card-title>
            <v-card-subtitle>
              Read-only RPC checks; no provider or Scryfall requests.
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="d-flex flex-wrap align-center ga-3">
              <v-select
                v-model="smokeCommanderKey"
                hide-details
                item-title="commanderName"
                item-value="commanderKey"
                :items="report.commanders"
                label="Commander"
                variant="outlined"
                width="360"
              />
              <v-btn
                color="primary"
                :disabled="!smokeCommanderKey"
                :loading="smokeLoading"
                @click="runSmokeTest"
              >
                Run smoke test
              </v-btn>
            </div>
            <v-list v-if="smokeResult" class="mt-4">
              <v-list-item
                v-for="check in smokeResult.checks"
                :key="check.label"
                :subtitle="check.message"
                :title="check.label"
              >
                <template #prepend>
                  <v-icon :color="check.status === 'pass' ? 'success' : 'warning'">
                    {{ check.status === 'pass' ? 'mdi-check-circle' : 'mdi-alert' }}
                  </v-icon>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </template>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue'
import type {
  DataHealthFilters,
  DataHealthReport,
  DataHealthSmokeTest,
} from '../models/dataHealth'
import { dataHealthRepository } from '../repositories/dataHealthRepository'
import {
  getNormalizationCompletionRate,
  getUnresolvedCardRate,
} from '../services/dataHealth'

const checkingAccess = ref(true)
const isAdmin = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const report = ref<DataHealthReport | null>(null)
const lastRefreshedAt = ref('')
const smokeCommanderKey = ref('')
const smokeLoading = ref(false)
const smokeResult = ref<DataHealthSmokeTest | null>(null)
const filters = reactive<DataHealthFilters>({
  pairedOnly: false,
  readinessLimit: 100,
  unresolvedLimit: 100,
  jobLimit: 100,
})
const sampleStatusItems = [
  { title: 'Unavailable', value: 'unavailable' },
  { title: 'Insufficient (1–4)', value: 'insufficient' },
  { title: 'Limited (5–19)', value: 'limited' },
  { title: 'Sufficient (20+)', value: 'sufficient' },
]
const providerItems = [
  { title: 'TopDeck', value: 'topdeck' },
  { title: 'EDHTop16', value: 'edhtop16' },
]

const summaryCards = computed(() => {
  const summary = report.value?.summary
  if (!summary) return []
  return [
    { label: 'Tournaments', value: summary.tournamentCount.toLocaleString(), detail: `${summary.topdeckTournamentCount} TopDeck · ${summary.edhtop16TournamentCount} EDHTop16` },
    { label: 'Entries', value: summary.entryCount.toLocaleString(), detail: `${summary.tournamentWithoutLocationCount} events without location` },
    { label: 'Processed Decks', value: summary.normalizedDeckCount.toLocaleString(), detail: `${percent(getNormalizationCompletionRate(summary))} complete` },
    { label: 'Complete Decks', value: summary.completeDeckCount.toLocaleString(), detail: `${summary.partialDeckCount} partial · ${summary.unavailableDeckCount} unavailable` },
    { label: 'Unresolved cards', value: summary.unresolvedCardRowCount.toLocaleString(), detail: `${percent(getUnresolvedCardRate(summary))} of card rows` },
    { label: 'Ready Commanders', value: report.value?.commanders.filter((item) => item.comparisonReady).length.toLocaleString() ?? '0', detail: 'At least 5 complete Decks in current filter' },
    { label: 'Failed jobs', value: summary.failedJobCount.toLocaleString(), detail: `${summary.staleJobCount} stale · ${summary.runningJobCount} running` },
    { label: 'Canonical identities', value: summary.canonicalCardCount.toLocaleString(), detail: `${summary.fallbackIdentityCount} fallback-only · ${summary.suspiciousAliasCount} suspicious aliases` },
  ]
})

const coverageItems = computed(() => {
  const summary = report.value?.summary
  if (!summary) return []
  return [
    { label: 'TopDeck entries', value: summary.topdeckEntryCount, detail: `${summary.topdeckTournamentCount} tournaments` },
    { label: 'EDHTop16 entries', value: summary.edhtop16EntryCount, detail: `${summary.edhtop16TournamentCount} tournaments` },
    { label: 'Structured entries', value: summary.structuredEntryCount, detail: 'Provider structured Decks' },
    { label: 'Plaintext entries', value: summary.plaintextEntryCount, detail: 'Embedded plaintext Decks' },
    { label: 'URL-only entries', value: summary.urlOnlyEntryCount, detail: 'External source only' },
    { label: 'Missing Decklists', value: summary.missingDecklistEntryCount, detail: 'No usable source Deck' },
    { label: 'Canonical aliases', value: summary.canonicalAliasCount, detail: `${summary.canonicalWithOracleCount} cards have Oracle IDs` },
    { label: 'Unlinked card rows', value: summary.tournamentCardWithoutCanonicalCount, detail: `${summary.tournamentCardCount} total card rows` },
    { label: 'Possible provider matches', value: summary.possibleMatchCount, detail: `${summary.linkedEventCount} explicit source links` },
    { label: 'Excluded casual events', value: summary.excludedCasualEventCount, detail: 'Tracked by durable ingestion batches' },
    { label: 'Events missing dates', value: summary.tournamentMissingDateCount, detail: `${summary.tournamentWithLocationCount} events have known locations` },
    { label: 'Commanders with 1+ complete', value: summary.commanderWithOneCompleteCount, detail: 'Inclusion ready' },
    { label: 'Commanders with 5+ complete', value: summary.commanderWithFiveCompleteCount, detail: 'Comparison ready' },
    { label: 'Commanders with 20+ complete', value: summary.commanderWithTwentyCompleteCount, detail: 'Sufficient sample band' },
    { label: 'Commanders with 50+ complete', value: summary.commanderWithFiftyCompleteCount, detail: 'Large descriptive sample' },
    { label: 'Commanders without complete Decks', value: summary.commanderWithoutCompleteCount, detail: 'Not analytics ready' },
    { label: 'Paired Commander samples', value: summary.pairedCommanderSampleCount, detail: 'Pairs with complete Decks' },
    { label: 'Regional complete Decks', value: summary.regionalCompleteDeckCount, detail: 'Complete Decks with known region' },
  ]
})

onMounted(async () => {
  try {
    isAdmin.value = await dataHealthRepository.isCurrentUserAdmin()
    if (isAdmin.value) await loadHealth()
  } finally {
    checkingAccess.value = false
  }
})

async function loadHealth() {
  loading.value = true
  errorMessage.value = ''
  try {
    report.value = await dataHealthRepository.load(filters)
    lastRefreshedAt.value = new Date().toISOString()
    if (
      smokeCommanderKey.value &&
      !report.value.commanders.some(
        (item) => item.commanderKey === smokeCommanderKey.value,
      )
    ) smokeCommanderKey.value = ''
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load Data Health.'
  } finally {
    loading.value = false
  }
}

async function runSmokeTest() {
  const commander = report.value?.commanders.find(
    (item) => item.commanderKey === smokeCommanderKey.value,
  )
  if (!commander) return
  smokeLoading.value = true
  errorMessage.value = ''
  try {
    smokeResult.value = await dataHealthRepository.runSmokeTest(
      commander,
      filters,
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Smoke test failed.'
  } finally {
    smokeLoading.value = false
  }
}

async function copyName(name: string) {
  await navigator.clipboard?.writeText(name)
}

function scryfallSearch(name: string) {
  return `https://scryfall.com/search?q=${encodeURIComponent(`!"${name}"`)}`
}

function formatProviders(providers: Record<string, number>) {
  return Object.entries(providers)
    .map(([provider, count]) => `${provider}: ${count}`)
    .join(' · ') || 'None'
}

function sampleColor(status: string) {
  if (status === 'sufficient') return 'success'
  if (status === 'limited') return 'warning'
  if (status === 'insufficient') return 'secondary'
  return 'error'
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatDate(value?: string, includeTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: includeTime ? 'short' : undefined,
    }).format(date)
}
</script>
