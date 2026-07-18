<template>
  <v-container class="pa-0" fluid>
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-5">
      <div>
        <h1 class="text-h4 font-weight-bold">Commander card inclusion</h1>
        <p class="text-medium-emphasis">
          Presence across complete normalized tournament Decks. Frequency is
          descriptive and does not imply card quality.
        </p>
      </div>
      <v-btn :to="{ name: 'commander-metagame', params: { commanderKey } }" variant="text">
        Commander results
      </v-btn>
    </div>

    <v-card border class="mb-5 pa-4">
      <v-row>
        <v-col cols="12" sm="3">
          <v-text-field v-model="startDate" label="Start date" type="date" />
        </v-col>
        <v-col cols="12" sm="3">
          <v-text-field v-model="endDate" label="End date" type="date" />
        </v-col>
        <v-col cols="12" sm="2">
          <v-text-field v-model.number="minimumPlayers" label="Minimum event size" min="0" type="number" />
        </v-col>
        <v-col cols="12" sm="2">
          <v-text-field v-model.number="maximumStanding" clearable label="Maximum placing" min="1" type="number" />
        </v-col>
        <v-col class="d-flex align-center" cols="12" sm="2">
          <v-btn color="primary" @click="load">Apply</v-btn>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" sm="4">
          <v-select v-model="tier" clearable :items="tiers" label="Inclusion tier" />
        </v-col>
        <v-col cols="12" sm="4">
          <v-text-field v-model="typeFilter" label="Card type" placeholder="Creature, Land…" />
        </v-col>
        <v-col cols="12" sm="2">
          <v-text-field
            v-model.number="minimumCompleteDecks"
            label="Minimum Deck sample"
            min="1"
            type="number"
          />
        </v-col>
        <v-col cols="12" sm="2">
          <v-select
            v-model="sortBy"
            :items="sortItems"
            item-title="title"
            item-value="value"
            label="Sort cards"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" sm="3">
          <v-select v-model="countryCode" clearable :items="locations.countries" label="Country" />
        </v-col>
        <v-col cols="12" sm="3">
          <v-select v-model="stateRegion" clearable :items="locations.states" label="State / region" />
        </v-col>
        <v-col cols="12" sm="3">
          <v-select v-model="regionKey" clearable :items="locations.regions" label="Region key" />
        </v-col>
        <v-col cols="12" sm="3">
          <v-select
            v-model="onlineFilter"
            clearable
            :items="onlineItems"
            item-title="title"
            item-value="value"
            label="Event format"
          />
        </v-col>
      </v-row>
    </v-card>

    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>
    <v-card v-else-if="!cards.length" border class="pa-8 text-center">
      No complete normalized Decks match these filters. Import card-level
      decklists or widen the sample.
    </v-card>
    <template v-else>
      <v-card border class="mb-5" color="surface" variant="flat">
        <v-card-text class="d-flex flex-wrap align-center ga-3">
          <div
            v-if="commanderIdentity?.imageUrls.length"
            class="d-flex ga-2"
          >
            <v-img
              v-for="(imageUrl, index) in commanderIdentity.imageUrls"
              :key="imageUrl"
              :alt="`${commanderIdentity.name} Commander ${index + 1} card image`"
              aspect-ratio="0.716"
              :src="imageUrl"
              width="88"
            />
          </div>
          <div class="mr-auto">
            <div class="text-h6 font-weight-bold">
              {{ commanderIdentity?.name ?? commanderKey }}
            </div>
            <ColorIdentitySymbols
              :colors="commanderIdentity?.colorIdentity ?? []"
            />
          </div>
          <v-chip color="primary" variant="tonal">
            {{ totalEligibleDecks }} Decks
          </v-chip>
          <v-chip color="secondary" variant="tonal">
            Top 16: {{ percent(top16SampleRate) }}
          </v-chip>
          <v-chip color="secondary" variant="tonal">
            First place: {{ percent(firstPlaceSampleRate) }}
          </v-chip>
        </v-card-text>
      </v-card>

      <v-row>
        <v-col
          v-for="card in sortedCards"
          :key="card.normalizedCardKey"
          cols="6"
          sm="4"
          md="3"
          lg="2"
        >
          <v-card
            :aria-label="`View ${card.cardName} inclusion history`"
            border
            color="surface"
            height="100%"
            link
            variant="flat"
            @click="openHistory(card)"
          >
            <v-img
              v-if="card.imageUrl"
              :alt="`${card.cardName} card image`"
              aspect-ratio="0.716"
              :src="card.imageUrl"
            />
            <v-sheet
              v-else
              class="d-flex align-center justify-center pa-4 text-center"
              color="surface-light"
              height="280"
            >
              Image unavailable
            </v-sheet>
            <v-card-item>
              <v-card-title class="text-subtitle-1">
                {{ card.cardName }}
              </v-card-title>
              <v-card-subtitle>{{ card.typeLine || '—' }}</v-card-subtitle>
            </v-card-item>
            <v-card-text>
              <div class="d-flex flex-wrap ga-2 mb-2">
                <v-chip size="small" variant="tonal">
                  {{ getInclusionTier(card.inclusionRate) }}
                </v-chip>
                <v-chip
                  :color="inclusionColor(card.inclusionRate)"
                  size="small"
                  variant="outlined"
                >
                  {{ percent(card.inclusionRate) }} inclusion
                </v-chip>
              </div>
              <div class="text-caption text-medium-emphasis">
                Top 16: {{ percent(card.top16InclusionRate) }}
              </div>
              <div class="text-caption text-medium-emphasis">
                First place: {{ percent(card.firstPlaceInclusionRate) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <v-dialog v-model="historyDialog" max-width="900">
      <v-card>
        <v-card-title class="d-flex align-center ga-3">
          <v-avatar v-if="selectedCard?.imageUrl" rounded="0" size="64">
            <v-img
              :alt="`${selectedCard.cardName} card image`"
              :src="selectedCard.imageUrl"
            />
          </v-avatar>
          <div class="mr-auto">
            <div>{{ selectedCard?.cardName }}</div>
            <div class="text-caption text-medium-emphasis">
              Inclusion over time in
              {{ commanderIdentity?.name ?? commanderKey }} Decks
              Decks
            </div>
          </div>
          <v-btn
            aria-label="Close inclusion history"
            icon="mdi-close"
            variant="text"
            @click="historyDialog = false"
          />
        </v-card-title>

        <v-divider />

        <v-card-text>
          <v-progress-linear v-if="historyLoading" indeterminate />
          <v-alert
            v-else-if="historyError"
            type="error"
            variant="tonal"
          >
            {{ historyError }}
          </v-alert>
          <v-alert
            v-else-if="!historyPoints.length"
            type="info"
            variant="tonal"
          >
            No samples match the current filters.
          </v-alert>
          <template v-else>
            <v-select
              v-model="historyPeriod"
              class="mb-4"
              density="comfortable"
              :items="historyPeriodItems"
              item-title="title"
              item-value="value"
              label="Group data by"
              @update:model-value="loadHistory"
            />
            <v-alert
              v-if="hasSmallHistorySamples"
              class="mb-4"
              type="warning"
              variant="tonal"
            >
              Some periods contain fewer than five eligible Decks. Treat those
              percentages as low-sample observations.
            </v-alert>

            <v-sheet border class="pa-4 mb-4" rounded>
              <div
                class="d-flex flex-wrap align-center justify-space-between ga-2 mb-3"
              >
                <div class="text-caption font-weight-bold">
                  Inclusion (%)
                </div>
                <div class="d-flex flex-wrap ga-2">
                  <v-chip color="primary" variant="outlined">
                    Latest: {{ percent(latestHistoryRate) }}
                  </v-chip>
                  <v-chip variant="outlined">
                    {{ historyPoints.length }} {{ periodCountLabel }}
                  </v-chip>
                </div>
              </div>
              <div class="overflow-x-auto">
                <div :style="{ minWidth: `${historyChartWidth}px` }">
                  <v-sparkline
                    color="primary"
                    height="220"
                    interactive
                    label-size="10"
                    :labels="historyTickLabels"
                    line-width="4"
                    :max="100"
                    :min="0"
                    :model-value="historyPercentages"
                    padding="30"
                    show-labels
                    show-markers
                    smooth
                    tooltip
                    :width="historyChartWidth"
                  >
                    <template #tooltip="{ index }">
                      <div v-if="historyPoints[index]" class="text-body-2">
                        <div class="font-weight-bold">
                          {{ periodLabel }} of
                          {{ formatDate(historyPoints[index].periodStart) }}
                        </div>
                        <div>
                          Inclusion:
                          {{ percent(historyPoints[index].inclusionRate) }}
                        </div>
                        <div>
                          In Decks: {{ historyPoints[index].deckCount }}
                        </div>
                        <div>
                          Eligible Decks:
                          {{ historyPoints[index].totalEligibleDecks }}
                        </div>
                        <div>
                          Events: {{ historyPoints[index].eventCount }}
                        </div>
                      </div>
                    </template>
                  </v-sparkline>
                </div>
              </div>
              <div class="text-center text-caption font-weight-bold mt-2">
                {{ periodLabel }}
              </div>
            </v-sheet>
          </template>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type {
  CardInclusionHistoryPoint,
  CardInclusionPeriod,
  CommanderCardInclusion,
} from '../models/tournament'
import type { CommanderIdentitySummary } from '../repositories/tournamentRepository'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import {
  tournamentRepository,
  type TournamentLocationOptions,
} from '../repositories/tournamentRepository'
import { getInclusionTier, type InclusionTier } from '../utils/cardInclusion'

const route = useRoute()
const commanderKey = String(route.params.commanderKey)
const cards = ref<CommanderCardInclusion[]>([])
const commanderIdentity = ref<CommanderIdentitySummary | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const historyDialog = ref(false)
const historyLoading = ref(false)
const historyError = ref('')
const selectedCard = ref<CommanderCardInclusion>()
const historyPoints = ref<CardInclusionHistoryPoint[]>([])
const historyPeriod = ref<CardInclusionPeriod>('week')
const startDate = ref('')
const endDate = ref('')
const minimumPlayers = ref(0)
const minimumCompleteDecks = ref(1)
const maximumStanding = ref<number>()
const tier = ref<InclusionTier>()
const typeFilter = ref('')
const sortBy = ref<'inclusion' | 'name' | 'top16' | 'first'>('inclusion')
const countryCode = ref<string>()
const stateRegion = ref<string>()
const regionKey = ref<string>()
const onlineFilter = ref<boolean>()
const locations = ref<TournamentLocationOptions>({
  countries: [], states: [], regions: [], hasOnline: false,
})
const tiers: InclusionTier[] = ['Core', 'Common', 'Flexible', 'Rare']
const sortItems = [
  { title: 'Inclusion rate', value: 'inclusion' },
  { title: 'Card name', value: 'name' },
  { title: 'Top-16 inclusion', value: 'top16' },
  { title: 'First-place inclusion', value: 'first' },
]
const onlineItems = [
  { title: 'Online', value: true },
  { title: 'In person', value: false },
]
const historyPeriodItems: Array<{
  title: string
  value: CardInclusionPeriod
}> = [
  { title: '1 day', value: 'day' },
  { title: '1 week', value: 'week' },
  { title: '1 month', value: 'month' },
  { title: '1 year', value: 'year' },
]
const totalEligibleDecks = computed(() => cards.value[0]?.totalEligibleDecks ?? 0)
const top16EligibleDecks = computed(() =>
  getSubsetSize('top16DeckCount', 'top16InclusionRate'),
)
const firstPlaceEligibleDecks = computed(() =>
  getSubsetSize('firstPlaceDeckCount', 'firstPlaceInclusionRate'),
)
const top16SampleRate = computed(() =>
  ratio(top16EligibleDecks.value, totalEligibleDecks.value),
)
const firstPlaceSampleRate = computed(() =>
  ratio(firstPlaceEligibleDecks.value, totalEligibleDecks.value),
)
const filteredCards = computed(() => cards.value.filter((card) =>
  (!tier.value || getInclusionTier(card.inclusionRate) === tier.value) &&
  (!typeFilter.value || card.typeLine?.toLocaleLowerCase().includes(typeFilter.value.toLocaleLowerCase()))
))
const sortedCards = computed(() => [...filteredCards.value].sort((left, right) => {
  if (sortBy.value === 'name') return left.cardName.localeCompare(right.cardName)
  if (sortBy.value === 'top16') return right.top16InclusionRate - left.top16InclusionRate
  if (sortBy.value === 'first') return right.firstPlaceInclusionRate - left.firstPlaceInclusionRate
  return right.inclusionRate - left.inclusionRate
}))
const historyPercentages = computed(() =>
  historyPoints.value.map((point) => point.inclusionRate * 100),
)
const historyTickLabels = computed(() =>
  historyPoints.value.map((point) => formatTick(point.periodStart)),
)
const historyChartWidth = computed(() =>
  Math.max(640, historyPoints.value.length * 72),
)
const latestHistoryRate = computed(() =>
  historyPoints.value.at(-1)?.inclusionRate ?? 0,
)
const hasSmallHistorySamples = computed(() =>
  historyPoints.value.some((point) => point.totalEligibleDecks < 5),
)
const periodLabel = computed(() =>
  historyPeriod.value.charAt(0).toUpperCase() + historyPeriod.value.slice(1),
)
const periodCountLabel = computed(() =>
  `${historyPeriod.value}${historyPoints.value.length === 1 ? '' : 's'}`,
)

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    cards.value = await tournamentRepository.getCommanderCardInclusion(
      commanderKey,
      {
        startDate: startDate.value || undefined,
        endDate: endDate.value || undefined,
        minimumPlayers: minimumPlayers.value,
        maximumStanding: maximumStanding.value || undefined,
        minimumCompleteDecks: minimumCompleteDecks.value,
        countryCode: countryCode.value,
        stateRegion: stateRegion.value,
        regionKey: regionKey.value,
        isOnline: onlineFilter.value,
      },
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load card inclusion.'
  } finally {
    loading.value = false
  }
}

async function openHistory(card: CommanderCardInclusion) {
  selectedCard.value = card
  historyPoints.value = []
  historyError.value = ''
  historyDialog.value = true
  await loadHistory()
}

async function loadHistory() {
  if (!selectedCard.value) return
  historyLoading.value = true
  try {
    historyPoints.value = await tournamentRepository.getCardInclusionOverTime(
      commanderKey,
      selectedCard.value,
      historyPeriod.value,
      {
        startDate: startDate.value || undefined,
        endDate: endDate.value || undefined,
        minimumPlayers: minimumPlayers.value,
        maximumStanding: maximumStanding.value || undefined,
        countryCode: countryCode.value,
        stateRegion: stateRegion.value,
        regionKey: regionKey.value,
        isOnline: onlineFilter.value,
      },
    )
  } catch (error) {
    historyError.value = error instanceof Error
      ? error.message
      : 'Unable to load card inclusion history.'
  } finally {
    historyLoading.value = false
  }
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatTick(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  if (historyPeriod.value === 'year') {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  }
  if (historyPeriod.value === 'month') {
    return new Intl.DateTimeFormat(undefined, {
      year: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** HSL provides a continuous red → yellow → green inclusion scale. */
function inclusionColor(value: number) {
  const boundedValue = Math.max(0, Math.min(value, 1))
  const hue = Math.round(boundedValue * 120)
  return `hsl(${hue}, 68%, 48%)`
}

function getSubsetSize(
  countField: 'top16DeckCount' | 'firstPlaceDeckCount',
  rateField: 'top16InclusionRate' | 'firstPlaceInclusionRate',
) {
  const row = cards.value.find((card) => card[rateField] > 0)
  return row ? Math.round(row[countField] / row[rateField]) : 0
}

function ratio(value: number, total: number) {
  return total === 0 ? 0 : value / total
}

onMounted(async () => {
  try {
    commanderIdentity.value =
      await tournamentRepository.getCommanderIdentity(commanderKey)
  } catch {
    // The normalized key remains a safe label if identity metadata is missing.
  }
  try {
    locations.value = await tournamentRepository.getLocationOptions()
  } catch {
    // Inclusion data remains usable when optional filter metadata is unavailable.
  }
  await load()
})
</script>
