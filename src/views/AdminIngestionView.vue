<template>
  <v-container class="pa-0" fluid>
    <AppLoadingSkeleton
      v-if="checkingAccess"
      :count="3"
      label="Checking administration access"
      variant="compact"
    />

    <v-alert v-else-if="!isAdmin" type="error" variant="tonal">
      You do not have permission to access the admin panel.
    </v-alert>

    <template v-else>
      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-6">
        <div>
          <h1 class="text-h4 font-weight-bold">Admin Panel</h1>
          <p class="text-medium-emphasis">
            Monitor processed tournament data and run provider ingestion.
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

      <v-card
        v-if="metrics?.deckCoverage.length"
        border
        class="mb-6"
        color="surface"
        variant="flat"
      >
        <v-card-item>
          <v-card-title>Deck data quality coverage</v-card-title>
          <v-card-subtitle>
            Completeness by provider, event region, and event month
          </v-card-subtitle>
        </v-card-item>
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Group</th>
              <th>Value</th>
              <th>Decks</th>
              <th>Complete</th>
              <th>Partial</th>
              <th>Unavailable</th>
              <th>Unresolved cards</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="coverage in metrics.deckCoverage"
              :key="`${coverage.dimension}:${coverage.groupKey}`"
            >
              <td class="text-capitalize">{{ coverage.dimension }}</td>
              <td>{{ coverage.groupKey }}</td>
              <td>{{ coverage.decks }}</td>
              <td>{{ coverage.complete }}</td>
              <td>{{ coverage.partial }}</td>
              <td>{{ coverage.unavailable }}</td>
              <td>{{ coverage.unresolvedCards }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-row align="start">
        <v-col cols="12" lg="5">
          <v-card border color="surface" variant="flat">
            <v-card-item>
              <v-card-title>Tournament ingestion</v-card-title>
              <v-card-subtitle>
                Fetch and process provider tournament records
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
                v-model="excludeCasualEvents"
                color="primary"
                label="Exclude and purge explicitly casual or budget events"
              />
              <v-alert class="mb-4" type="info" variant="tonal">
                TopDeck does not provide a competitive tag. Neutral event
                names remain included; only explicit casual, budget, precon,
                beginner, or low-power title signals are excluded.
              </v-alert>
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
              <v-alert
                v-else-if="normalizationMessage"
                class="mt-4"
                type="success"
                variant="tonal"
              >
                {{ normalizationMessage }}
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
          <v-switch
            v-model="jobExcludeCasualEvents"
            color="primary"
            label="Exclude and purge explicitly casual or budget events"
          />

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
                {{ job.failedBatches }} failed · {{ job.status }} ·
                Runtime: {{ jobDuration(job) }}
              </v-list-item-subtitle>
              <v-progress-linear
                class="mt-2"
                color="primary"
                :model-value="jobProgress(job)"
              />
              <v-alert
                v-if="job.lastError"
                class="mt-2"
                density="comfortable"
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

      <v-card border class="mt-6" color="surface" variant="flat">
        <v-card-item>
          <v-card-title>Purge casual TopDeck data</v-card-title>
          <v-card-subtitle>
            Review or remove previously imported events with explicit casual,
            budget, precon, beginner, or low-power title signals
          </v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" sm="4">
              <v-text-field v-model="purgeStartDate" label="Start date" type="date" />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field v-model="purgeEndDate" label="End date" type="date" />
            </v-col>
            <v-col class="d-flex align-center" cols="12" sm="4">
              <v-switch v-model="purgeDryRun" label="Dry run" />
            </v-col>
          </v-row>
          <v-btn
            :color="purgeDryRun ? 'primary' : 'error'"
            :loading="purgeRunning"
            @click="requestCasualPurge"
          >
            {{ purgeDryRun ? 'Preview purge' : 'Purge matching events' }}
          </v-btn>
          <v-alert v-if="purgeError" class="mt-4" type="error" variant="tonal">
            {{ purgeError }}
          </v-alert>
          <v-alert v-if="purgeReport" class="mt-4" type="info" variant="tonal">
            {{ purgeReport.eventsMatched }} events matched,
            affecting {{ purgeReport.entriesAffected }} entries.
            <span v-if="!purgeReport.dryRun">
              {{ purgeReport.eventsPurged }} events were purged.
            </span>
            <span v-if="purgeReport.titles.length">
              Titles: {{ purgeReport.titles.join(', ') }}
              <span v-if="purgeReport.truncated">…</span>
            </span>
          </v-alert>
        </v-card-text>
      </v-card>

      <v-card border class="mt-6" color="surface" variant="flat">
        <v-card-item>
          <v-card-title>Card-level Decklists</v-card-title>
          <v-card-subtitle>
            Optional preparation for card-inclusion analysis
          </v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" sm="3">
              <v-select
                v-model="deckProvider"
                clearable
                :items="providerItems"
                item-title="title"
                item-value="value"
                label="Provider"
              />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="deckStartDate" label="Start date" type="date" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="deckEndDate" label="End date" type="date" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="deckCommanderKey" label="Commander key (optional)" />
            </v-col>
          </v-row>
          <v-textarea
            v-model="deckTournamentIds"
            label="Tournament IDs (optional)"
            rows="2"
          />
          <div class="d-flex flex-wrap ga-4">
            <v-switch v-model="deckOnlyMissing" label="Only missing" />
            <v-switch v-model="deckRetryPartial" label="Retry partial" />
            <v-switch v-model="deckDryRun" label="Dry run" />
          </div>
          <v-btn
            color="primary"
            :loading="deckIngestionRunning"
            @click="ingestTournamentDecks"
          >
            Ingest card-level Decklists
          </v-btn>
          <v-alert v-if="deckIngestionError" class="mt-4" type="error" variant="tonal">
            {{ deckIngestionError }}
          </v-alert>
          <v-row v-if="deckIngestionReport" class="mt-3">
            <v-col
              v-for="item in deckReportItems"
              :key="item.label"
              cols="6"
              md="3"
            >
              <v-sheet class="pa-3" color="surface-light" rounded>
                <div class="text-caption">{{ item.label }}</div>
                <div class="text-h6">{{ item.value }}</div>
              </v-sheet>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card border class="mt-6" color="surface" variant="flat">
        <v-card-item>
          <v-card-title>Development data reset</v-card-title>
          <v-card-subtitle>
            Clear tournament ingestion data before testing a fresh import
          </v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-alert class="mb-4" type="warning" variant="tonal">
            This removes tournament jobs, events, entries, processed tournament
            Decks, tournament Deck cards, and the canonical card cache. User
            accounts and saved user Decks are preserved.
          </v-alert>
          <v-btn
            color="error"
            :loading="resetRunning"
            @click="resetConfirmation = true"
          >
            Clear tournament data
          </v-btn>
          <v-alert v-if="resetError" class="mt-4" type="error" variant="tonal">
            {{ resetError }}
          </v-alert>
          <v-alert v-if="resetReport" class="mt-4" type="success" variant="tonal">
            Removed {{ resetReport.tournamentsDeleted }} tournaments,
            {{ resetReport.entriesDeleted }} entries,
            {{ resetReport.normalizedDecksDeleted }} processed Decks,
            {{ resetReport.normalizedCardsDeleted }} Deck cards,
            {{ resetReport.canonicalCardsDeleted }} canonical cards,
            {{ resetReport.canonicalAliasesDeleted }} card aliases, and
            {{ resetReport.ingestionJobsDeleted }} ingestion jobs.
          </v-alert>
        </v-card-text>
      </v-card>

      <v-dialog v-model="purgeConfirmation" max-width="520">
        <v-card>
          <v-card-title>Delete matching tournament data?</v-card-title>
          <v-card-text>
            This permanently removes matching TopDeck events, their entries,
            and processed tournament Decks. Run the preview first and review
            every matching title.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn @click="purgeConfirmation = false">Cancel</v-btn>
            <v-btn color="error" @click="runCasualPurge">Purge data</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="resetConfirmation" max-width="560">
        <v-card>
          <v-card-title>Clear all tournament testing data?</v-card-title>
          <v-card-text>
            This cannot be undone. Confirm that no ingestion is currently
            running. User accounts and saved user Decks will not be changed.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn @click="resetConfirmation = false">Cancel</v-btn>
            <v-btn color="error" @click="clearTournamentData">
              Clear tournament data
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-card
        v-if="report"
        border
        class="mt-6"
        :class="{ 'ingestion-report--sticky': report.dryRun }"
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
          <template #append>
            <v-btn
              :aria-label="reportMinimized ? 'Expand ingestion report' : 'Minimize ingestion report'"
              color="primary"
              icon
              :title="reportMinimized ? 'Expand report' : 'Minimize report'"
              variant="text"
              @click="reportMinimized = !reportMinimized"
            >
              <span aria-hidden="true" class="report-control-symbol">
                {{ reportMinimized ? '□' : '−' }}
              </span>
            </v-btn>
            <v-btn
              aria-label="Close ingestion report"
              color="primary"
              icon
              title="Close report"
              variant="text"
              @click="closeReport"
            >
              <span aria-hidden="true" class="report-control-symbol">×</span>
            </v-btn>
          </template>
        </v-card-item>
        <v-card-text v-show="!reportMinimized">
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
          <v-alert
            v-if="report.excludedTournamentTitles.length"
            class="mt-4"
            type="info"
            variant="tonal"
          >
            Excluded by title: {{ report.excludedTournamentTitles.join(', ') }}
          </v-alert>
        </v-card-text>
      </v-card>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue'
import {
  ingestionRepository,
  type IngestionDashboardMetrics,
  type IngestionJob,
  type ClearTournamentDataReport,
  type PurgeCasualEventsReport,
  type TournamentDeckIngestionReport,
  type IngestionReport,
} from '../repositories/ingestionRepository'
import { tournamentRepository } from '../repositories/tournamentRepository'
import {
  formatElapsedDuration,
  getIngestionJobDurationMs,
} from '../utils/ingestionDuration'

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
const excludeCasualEvents = ref(true)
const report = ref<IngestionReport | null>(null)
const reportMinimized = ref(false)
const errorMessage = ref('')
const normalizationMessage = ref('')
const jobs = ref<IngestionJob[]>([])
const creatingJob = ref(false)
const jobStartDate = ref('')
const jobEndDate = ref('')
const jobWindowDays = ref(7)
const jobMinimumPlayers = ref(0)
const jobExcludeCasualEvents = ref(true)
const jobError = ref('')
const jobMessage = ref('')
const jobClock = ref(Date.now())
let jobRefreshTimer: number | undefined
const purgeStartDate = ref('')
const purgeEndDate = ref('')
const purgeDryRun = ref(true)
const purgeRunning = ref(false)
const purgeConfirmation = ref(false)
const purgeError = ref('')
const purgeReport = ref<PurgeCasualEventsReport | null>(null)
const resetConfirmation = ref(false)
const resetRunning = ref(false)
const resetError = ref('')
const resetReport = ref<ClearTournamentDataReport | null>(null)
const deckProvider = ref<'topdeck' | 'edhtop16' | undefined>('topdeck')
const deckStartDate = ref('')
const deckEndDate = ref('')
const deckCommanderKey = ref('')
const deckTournamentIds = ref('')
const deckOnlyMissing = ref(true)
const deckRetryPartial = ref(false)
const deckDryRun = ref(true)
const deckIngestionRunning = ref(false)
const deckIngestionError = ref('')
const deckIngestionReport = ref<TournamentDeckIngestionReport | null>(null)
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
    detail: 'Processed tournament records',
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
    label: 'Source Deck coverage',
    value: (
      (metrics.value?.structuredDeckCount ?? 0) +
      (metrics.value?.plaintextDeckCount ?? 0) +
      (metrics.value?.urlOnlyDeckCount ?? 0)
    ).toLocaleString(),
    detail: `${metrics.value?.structuredDeckCount ?? 0} structured · ${metrics.value?.plaintextDeckCount ?? 0} plaintext · ${metrics.value?.urlOnlyDeckCount ?? 0} URL-only · ${metrics.value?.unavailableSourceDeckCount ?? 0} missing · ${metrics.value?.commanderFailureCount ?? 0} Commander issues`,
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
  {
    label: 'Processed Decks',
    value: metrics.value?.normalizedDeckCount.toLocaleString() ?? '0',
    detail: `${metrics.value?.completeDeckCount ?? 0} complete · ${metrics.value?.partialDeckCount ?? 0} partial`,
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
    { label: 'Events excluded', value: report.value.tournamentsExcluded },
    { label: 'Existing events purged', value: report.value.tournamentsPurged },
  ]
})
const deckReportItems = computed(() => {
  const report = deckIngestionReport.value
  if (!report) return []
  return [
    { label: 'Entries considered', value: report.entriesConsidered },
    { label: 'Decklists available', value: report.decklistsAvailable },
    { label: 'Structured used', value: report.structuredDecksUsed },
    { label: 'Plaintext used', value: report.plaintextDecksUsed },
    { label: 'Complete Decks', value: report.decksCompleted },
    { label: 'Partial Decks', value: report.decksPartial },
    { label: 'Cards resolved', value: report.cardsResolved },
    { label: 'Cards unresolved', value: report.cardsUnresolved },
  ]
})

onMounted(async () => {
  try {
    isAdmin.value = await ingestionRepository.isCurrentUserAdmin()
    if (isAdmin.value) {
      await loadMetrics()
      // Refresh progress and elapsed runtime while a long backfill runs.
      jobRefreshTimer = window.setInterval(refreshJobs, 30_000)
    }
  } finally {
    checkingAccess.value = false
  }
})

onUnmounted(() => {
  window.clearInterval(jobRefreshTimer)
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
      excludeCasualEvents: jobExcludeCasualEvents.value,
    })
    jobMessage.value = 'Historical job created. The worker will process it in the background.'
    jobs.value = await ingestionRepository.getJobs()
  } catch (error) {
    jobError.value = error instanceof Error ? error.message : 'Unable to create job.'
  } finally {
    creatingJob.value = false
  }
}

function requestCasualPurge() {
  if (purgeDryRun.value) {
    void runCasualPurge()
  } else {
    purgeConfirmation.value = true
  }
}

async function runCasualPurge() {
  purgeConfirmation.value = false
  purgeRunning.value = true
  purgeError.value = ''
  try {
    purgeReport.value = await ingestionRepository.purgeCasualEvents({
      startDate: purgeStartDate.value || undefined,
      endDate: purgeEndDate.value || undefined,
      dryRun: purgeDryRun.value,
    })
    if (!purgeDryRun.value) {
      tournamentRepository.clearCache()
      await loadMetrics()
    }
  } catch (error) {
    purgeError.value = error instanceof Error
      ? error.message
      : 'Unable to purge casual TopDeck events.'
  } finally {
    purgeRunning.value = false
  }
}

async function clearTournamentData() {
  resetConfirmation.value = false
  resetRunning.value = true
  resetError.value = ''
  resetReport.value = null
  try {
    resetReport.value = await ingestionRepository.clearTournamentData()
    tournamentRepository.clearCache()
    report.value = null
    deckIngestionReport.value = null
    await loadMetrics()
  } catch (error) {
    resetError.value = error instanceof Error
      ? error.message
      : 'Unable to clear tournament data.'
  } finally {
    resetRunning.value = false
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

function jobDuration(job: IngestionJob): string {
  const duration = getIngestionJobDurationMs(job, jobClock.value)
  return duration === null ? 'Not started' : formatElapsedDuration(duration)
}

async function refreshJobs() {
  jobClock.value = Date.now()
  try {
    jobs.value = await ingestionRepository.getJobs()
  } catch {
    // Keep the last successful snapshot when a background refresh fails.
  }
}

async function ingestTournamentDecks() {
  deckIngestionRunning.value = true
  deckIngestionError.value = ''
  try {
    deckIngestionReport.value = await ingestionRepository.ingestAllTournamentDecks({
      provider: deckProvider.value,
      startDate: deckStartDate.value || undefined,
      endDate: deckEndDate.value || undefined,
      commanderKey: deckCommanderKey.value || undefined,
      tournamentIds: deckTournamentIds.value
        .split(/[\n,]/).map((id) => id.trim()).filter(Boolean),
      onlyMissing: deckOnlyMissing.value,
      retryPartial: deckRetryPartial.value,
      dryRun: deckDryRun.value,
    })
    if (!deckDryRun.value) tournamentRepository.clearCache()
  } catch (error) {
    deckIngestionError.value = error instanceof Error
      ? error.message : 'Card-level Deck ingestion failed.'
  } finally {
    deckIngestionRunning.value = false
  }
}

async function ingest() {
  running.value = true
  errorMessage.value = ''
  normalizationMessage.value = ''
  reportMinimized.value = false
  try {
    const selectedTournamentIds = tournamentIds.value
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter(Boolean)
    report.value = await ingestionRepository.ingestAllTournaments({
      provider: provider.value,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      minimumPlayers: minimumPlayers.value,
      maximumPlayers: maximumPlayers.value || undefined,
      last: lastDays.value || undefined,
      dryRun: dryRun.value,
      tournamentIds: selectedTournamentIds,
      includeRounds: includeRounds.value,
      enrichLocation: enrichLocation.value,
      excludeCasualEvents: excludeCasualEvents.value,
    })
    if (!dryRun.value && !report.value.providerErrors.length) {
      // Keep provider requests responsive, then let the durable worker perform
      // card-level normalization automatically in bounded cron invocations.
      if (startDate.value && endDate.value) {
        await ingestionRepository.createDeckNormalizationJob({
          provider: provider.value,
          startDate: startDate.value,
          endDate: endDate.value,
          windowDays: 3,
          minimumPlayers: minimumPlayers.value,
          includeRounds: false,
          enrichLocation: false,
          excludeCasualEvents: excludeCasualEvents.value,
        })
        normalizationMessage.value =
          'Tournament metadata imported. Card-level Deck processing is queued.'
      }
      tournamentRepository.clearCache()
      await loadMetrics()
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Ingestion failed.'
  } finally {
    running.value = false
  }
}

function closeReport() {
  report.value = null
  reportMinimized.value = false
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

<style scoped>
/*
 * Keep a dry-run result available while an administrator reviews the rest of
 * the page. Mobile screens use normal document flow to preserve usable space.
 */
@media (min-width: 1280px) {
  .ingestion-report--sticky {
    position: sticky;
    bottom: 16px;
    z-index: 2;
  }
}

.report-control-symbol {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1;
}
</style>
