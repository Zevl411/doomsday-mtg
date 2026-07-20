<template>
  <v-card
    ref="contentElement"
    border
    class="recommendations-panel w-100"
    color="surface-bright"
    rounded="lg"
    variant="flat"
  >
    <v-card-title
      class="widget-header-bar d-flex align-center justify-space-between px-5 py-2"
    >
      <span>Top Recommendations</span>
      <div class="d-flex align-center ga-2">
        <v-select
          v-model="timeframe"
          aria-label="Recommendation timeframe"
          class="recommendations-timeframe"
          density="compact"
          hide-details
          :items="timeframeOptions"
          variant="outlined"
        />
        <v-btn
          aria-label="Reload recommendations"
          class="recommendations-reload"
          :disabled="!canLoad"
          :loading="loading"
          icon
          size="small"
          variant="text"
          @click="reload"
        >
          <svg
            aria-hidden="true"
            class="recommendations-reload__icon"
            viewBox="0 0 24 24"
          >
            <path
              d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"
            />
          </svg>
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text class="recommendations-content pa-4">
      <div
        v-if="loading"
        aria-label="Loading recommendations"
        class="recommendation-grid"
      >
        <div
          v-for="index in 3"
          :key="index"
          class="recommendation-skeleton"
        >
          <div class="recommendation-skeleton__image skeleton-pulse" />
          <div class="recommendation-skeleton__controls d-flex ga-2">
            <div class="recommendation-skeleton__chip skeleton-pulse" />
            <div class="recommendation-skeleton__chip skeleton-pulse" />
          </div>
        </div>
      </div>
      <v-alert v-else-if="errorMessage" type="error" variant="tonal">
        {{ errorMessage }}
      </v-alert>
      <div
        v-else-if="!canLoad"
        class="d-flex h-100 align-center justify-center text-center text-medium-emphasis"
      >
        Add a Commander and Oracle-identified mainboard cards to view observed
        tournament associations.
      </div>
      <div
        v-else-if="!suggestions.length"
        class="d-flex h-100 align-center justify-center text-center text-medium-emphasis"
      >
        No cards meet the current association and sample thresholds.
      </div>
      <div v-else class="recommendation-grid">
        <v-card
          v-for="suggestion in visibleSuggestions"
          :key="suggestion.suggestedOracleId"
          border
          class="recommendation-card"
          tabindex="0"
          variant="tonal"
          @blur="deckStore.restoreSelectedPreviewCard()"
          @click="openDetails(suggestion)"
          @focusin="previewSuggestion(suggestion)"
          @mouseleave="deckStore.restoreSelectedPreviewCard()"
          @mouseenter="previewSuggestion(suggestion)"
        >
          <v-img
            v-if="cardImage(suggestion)"
            :alt="`${suggestion.suggestedCardName} card`"
            aspect-ratio="0.714"
            class="recommendation-card__image"
            cover
            :src="cardImage(suggestion)"
          />
          <div class="recommendation-card__controls d-flex align-center ga-1">
            <div class="d-flex flex-wrap ga-1">
              <v-chip size="x-small" variant="outlined">
                {{ suggestion.supportingCardCount }} evidence
              </v-chip>
              <v-chip size="x-small" variant="outlined">
                {{ suggestion.sampleSize }} Decks
              </v-chip>
            </div>
            <v-spacer />
            <v-btn
              :aria-label="`Add ${suggestion.suggestedCardName} to Mainboard`"
              class="recommendation-card__add"
              :disabled="addOnCooldown"
              icon
              :ripple="false"
              size="x-small"
              variant="text"
              @click.stop="addToBoard(suggestion, 'mainboard')"
            >
              <svg
                aria-hidden="true"
                class="recommendation-card__add-icon"
                viewBox="0 0 24 24"
              >
                <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
              </svg>
            </v-btn>
          </div>
        </v-card>
        <div
          v-for="index in backgroundSkeletonCount"
          :key="`background-skeleton-${index}`"
          aria-label="Loading recommendation"
          class="recommendation-skeleton"
        >
          <div class="recommendation-skeleton__image skeleton-pulse" />
          <div class="recommendation-skeleton__controls d-flex ga-2">
            <div class="recommendation-skeleton__chip skeleton-pulse" />
            <div class="recommendation-skeleton__chip skeleton-pulse" />
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>

  <v-dialog
    :model-value="Boolean(selectedSuggestion)"
    max-width="760"
    @update:model-value="closeDetails"
  >
    <v-card v-if="selectedSuggestion">
      <v-card-title class="d-flex align-center ga-3">
        <div class="mr-auto">
          <div>{{ selectedSuggestion.suggestedCardName }}</div>
          <div class="text-caption text-medium-emphasis">
            Cards played with {{ selectedSuggestion.suggestedCardName }} in
            {{ comparisonCommanderName }} Decks
          </div>
        </div>
        <v-btn
          aria-label="Close recommendation details"
          icon="mdi-close"
          variant="text"
          @click="closeDetails"
        />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <div class="recommendation-details__top">
          <div class="recommendation-details__preview">
            <DoubleFacedCardImage
              v-if="dialogPreviewCard"
              aspect-ratio="0.716"
              :card="dialogPreviewCard"
              class="recommendation-details__card rounded-lg"
              cover
            />
          </div>
          <div class="recommendation-history">
            <div class="d-flex flex-wrap align-center ga-2 mb-3">
              <v-chip size="small" variant="outlined">
                {{ selectedSuggestion.sampleSize }} complete Deck sample
              </v-chip>
              <v-chip size="small" variant="outlined">
                {{ selectedSuggestion.supportingCardCount }} supporting cards
              </v-chip>
            </div>
            <div class="d-flex flex-wrap align-center ga-2 mb-3">
              <v-btn
                :to="tournamentDecksLink(selectedSuggestion)"
                size="small"
                variant="outlined"
              >
                View Tournament Decks
              </v-btn>
              <v-menu location="bottom" open-on-hover>
                <template #activator="{ props }">
                  <v-btn
                    color="primary"
                    size="small"
                    v-bind="props"
                    variant="flat"
                  >
                    Add to board
                  </v-btn>
                </template>
                <v-list>
                  <v-list-item
                    v-for="board in boards"
                    :key="board.value"
                    :title="board.title"
                    @click="addToBoard(selectedSuggestion!, board.value)"
                  />
                </v-list>
              </v-menu>
            </div>
            <div class="d-flex flex-wrap ga-3 text-caption mb-2">
              <span class="recommendation-history__legend">
                <span class="recommendation-history__key recommendation-history__key--deck" />
                Deck inclusion
              </span>
              <span class="recommendation-history__legend">
                <span class="recommendation-history__key recommendation-history__key--event" />
                Tournament appearance
              </span>
            </div>
            <v-progress-linear v-if="historyLoading" indeterminate />
            <v-alert
              v-else-if="historyError"
              density="compact"
              type="error"
              variant="tonal"
            >
              {{ historyError }}
            </v-alert>
            <v-alert
              v-else-if="!historyPoints.length"
              density="compact"
              type="info"
              variant="tonal"
            >
              No inclusion history matches this timeframe.
            </v-alert>
            <div v-else class="recommendation-history__chart">
              <svg
                aria-label="Deck inclusion and tournament appearance over time"
                role="img"
                viewBox="0 0 600 230"
              >
                <g class="recommendation-history__grid">
                  <template v-for="tick in historyYTicks" :key="tick.value">
                    <line
                      x1="42"
                      x2="588"
                      :y1="tick.y"
                      :y2="tick.y"
                    />
                    <text x="35" :y="tick.y + 4" text-anchor="end">
                      {{ tick.value }}%
                    </text>
                  </template>
                </g>
                <path
                  class="recommendation-history__line recommendation-history__line--deck"
                  :d="deckHistoryPath"
                />
                <path
                  class="recommendation-history__line recommendation-history__line--event"
                  :d="eventHistoryPath"
                />
                <g
                  v-for="point in historyChartPoints"
                  :key="point.periodStart"
                >
                  <circle
                    class="recommendation-history__point recommendation-history__point--deck"
                    :cx="point.x"
                    :cy="point.deckY"
                    r="4"
                  >
                    <title>{{ point.tooltip }}</title>
                  </circle>
                  <circle
                    class="recommendation-history__point recommendation-history__point--event"
                    :cx="point.x"
                    :cy="point.eventY"
                    r="4"
                  >
                    <title>{{ point.tooltip }}</title>
                  </circle>
                </g>
                <text class="recommendation-history__date" x="42" y="224">
                  {{ historyFirstDate }}
                </text>
                <text
                  class="recommendation-history__date"
                  x="588"
                  y="224"
                  text-anchor="end"
                >
                  {{ historyLastDate }}
                </text>
              </svg>
            </div>
          </div>
        </div>
        <div class="recommendation-evidence-keys my-4">
          <div class="recommendation-evidence-key">
            <div class="text-caption font-weight-bold mb-2">
              Card metrics
            </div>
            <div class="recommendation-metric-row text-caption">
              <v-chip size="x-small" variant="flat">42.0%</v-chip>
              <span>
                Confidence: focused-card Decks that also contained this card
              </span>
            </div>
            <div class="recommendation-metric-row text-caption">
              <v-chip size="x-small" variant="flat">1.25×</v-chip>
              <span>
                Lift: observed frequency compared with its sample baseline
              </span>
            </div>
          </div>
          <div class="recommendation-evidence-key">
            <div class="text-caption font-weight-bold mb-2">
              Association strength
            </div>
            <div class="d-flex flex-wrap ga-2">
              <v-chip color="success" size="x-small" variant="outlined">
                Strong association
              </v-chip>
              <v-chip color="warning" size="x-small" variant="outlined">
                Moderate association
              </v-chip>
              <v-chip color="error" size="x-small" variant="outlined">
                Weak association
              </v-chip>
            </div>
          </div>
        </div>
        <v-progress-linear
          v-if="evidenceLoading"
          class="mb-4"
          indeterminate
        />
        <v-alert
          v-else-if="evidenceError"
          class="mb-4"
          density="compact"
          type="error"
          variant="tonal"
        >
          {{ evidenceError }}
        </v-alert>
        <div v-else class="recommendation-evidence-grid">
          <div
            v-for="evidence in sortedDialogEvidence"
            :key="evidence.sourceOracleId"
            :aria-label="`Associated card ${evidence.sourceCardName}`"
            :class="[
              'recommendation-evidence-card',
              `recommendation-evidence-card--${evidenceStrength(evidence)}`,
            ]"
            :title="exactEvidence(evidence)"
            :tabindex="evidenceCard(evidence) ? 0 : undefined"
            @blur="restoreDialogPreview"
            @focus="previewEvidence(evidence)"
            @mouseleave="restoreDialogPreview"
            @mouseenter="previewEvidence(evidence)"
            @click="focusEvidence(evidence)"
          >
            <DoubleFacedCardImage
              v-if="evidenceCard(evidence)"
              aspect-ratio="0.716"
              :card="evidenceCard(evidence)!"
              class="recommendation-evidence-card__image"
              cover
            />
            <v-img
              v-else
              :alt="`${evidence.sourceCardName} card`"
              aspect-ratio="0.716"
              class="recommendation-evidence-card__image"
              cover
              :src="namedCardImage(evidence.sourceCardName)"
            />
            <div class="recommendation-evidence-card__controls">
              <v-chip size="x-small" variant="flat">
                {{ percent(evidence.confidence) }}
              </v-chip>
              <v-chip size="x-small" variant="flat">
                {{ evidence.lift.toFixed(2) }}×
              </v-chip>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { getCardsByExactNames } from '../api/scryfall'
import DoubleFacedCardImage from './DoubleFacedCardImage.vue'
import type {
  AssociationBasedSuggestion,
  AssociationSuggestionEvidence,
} from '../models/associationSuggestion'
import type { TrackedDeckBoard } from '../models/deck'
import type {
  CardInclusionHistoryPoint,
  CardInclusionPeriod,
} from '../models/tournament'
import { cardAssociationRepository } from '../repositories/cardAssociationRepository'
import { tournamentRepository } from '../repositories/tournamentRepository'
import type { ScryfallCard } from '../types/card'
import { associationSuggestionRepository } from '../repositories/associationSuggestionRepository'
import {
  associationSuggestionService,
  formatSuggestionEvidence,
} from '../services/associationSuggestionService'
import { getComparisonCommander } from '../services/deckComparison'
import { useDeckStore } from '../stores/deck'
import { getCardImage } from '../utils/cardDisplay'
import { getCompactCardName } from '../utils/cardName'

const emit = defineEmits<{
  add: [card: NonNullable<AssociationBasedSuggestion['suggestedCard']>, board: TrackedDeckBoard]
  contentResized: [height: number]
}>()
const deckStore = useDeckStore()
const loading = ref(false)
const refreshing = ref(false)
const errorMessage = ref('')
const suggestions = ref<AssociationBasedSuggestion[]>([])
const selectedSuggestion = ref<AssociationBasedSuggestion | null>(null)
const sortedDialogEvidence = computed(() =>
  [...(selectedSuggestion.value?.evidence ?? [])].sort(
    (left, right) =>
      right.confidence - left.confidence
      || right.jointDeckCount - left.jointDeckCount
      || right.lift - left.lift
      || left.sourceCardName.localeCompare(right.sourceCardName),
  ),
)
const dialogPreviewCard = ref<ScryfallCard | null>(null)
const visibleSuggestions = computed(() => suggestions.value.slice(0, 3))
const backgroundSkeletonCount = computed(() =>
  refreshing.value
    ? Math.max(0, 3 - visibleSuggestions.value.length)
    : 0,
)
const historyLoading = ref(false)
const historyError = ref('')
const historyPoints = ref<CardInclusionHistoryPoint[]>([])
const evidenceLoading = ref(false)
const evidenceError = ref('')
const dialogCardsByOracleId = ref(new Map<string, ScryfallCard>())
let historyRequestId = 0
let recommendationRequestId = 0
let refillTimer: number | null = null
let addCooldownTimer: number | null = null
const addOnCooldown = ref(false)
const hydratedCardsByOracleId = new Map<string, ScryfallCard>()
const historyChartPoints = computed(() => {
  const left = 42
  const right = 588
  const top = 12
  const bottom = 204
  const count = historyPoints.value.length
  return historyPoints.value.map((point, index) => {
    const x = count === 1
      ? (left + right) / 2
      : left + index * ((right - left) / (count - 1))
    const deckY = bottom - point.inclusionRate * (bottom - top)
    const eventY = bottom - point.eventInclusionRate * (bottom - top)
    return {
      periodStart: point.periodStart,
      x,
      deckY,
      eventY,
      tooltip: [
        formatHistoryDate(point.periodStart),
        `Deck inclusion: ${percent(point.inclusionRate)} (${point.deckCount}/${point.totalEligibleDecks})`,
        `Tournament appearance: ${percent(point.eventInclusionRate)} (${point.cardEventCount}/${point.eventCount})`,
      ].join('\n'),
    }
  })
})
const deckHistoryPath = computed(() =>
  historyPath(historyChartPoints.value.map((point) => [point.x, point.deckY])),
)
const eventHistoryPath = computed(() =>
  historyPath(historyChartPoints.value.map((point) => [point.x, point.eventY])),
)
const historyYTicks = [0, 25, 50, 75, 100].map((value) => ({
  value,
  y: 204 - (value / 100) * 192,
}))
const historyFirstDate = computed(() =>
  formatHistoryDate(historyPoints.value[0]?.periodStart),
)
const historyLastDate = computed(() =>
  formatHistoryDate(historyPoints.value.at(-1)?.periodStart),
)
const contentElement = ref<ComponentPublicInstance | null>(null)
let contentResizeObserver: ResizeObserver | null = null
type RecommendationTimeframe =
  | 'week'
  | 'month'
  | 'three-months'
  | 'six-months'
  | 'year'
  | 'all'
const timeframe = ref<RecommendationTimeframe>('all')
const timeframeOptions: Array<{
  title: string
  value: RecommendationTimeframe
}> = [
  { title: '1 week', value: 'week' },
  { title: '1 month', value: 'month' },
  { title: '3 months', value: 'three-months' },
  { title: '6 months', value: 'six-months' },
  { title: '1 year', value: 'year' },
  { title: 'All time', value: 'all' },
]
const sourceOracleIds = computed(() => [
  ...new Set(
    deckStore.deck.cards
      .map((entry) => entry.card.oracle_id)
      .filter((value): value is string => Boolean(value)),
  ),
])
const ownedOracleIds = computed(() => [
  ...sourceOracleIds.value,
  ...[
    deckStore.deck.commander?.oracle_id,
    deckStore.deck.partnerCommander?.oracle_id,
  ].filter((value): value is string => Boolean(value)),
])
const sourceCardsByOracleId = computed(() => new Map(
  deckStore.deck.cards
    .filter((entry) => entry.card.oracle_id)
    .map((entry) => [entry.card.oracle_id!.toLowerCase(), entry.card]),
))
const canLoad = computed(() =>
  Boolean(deckStore.deck.commander && sourceOracleIds.value.length),
)
const comparisonCommanderName = computed(() => {
  const commanders = [
    deckStore.deck.commander,
    deckStore.deck.partnerCommander,
  ].filter((card): card is ScryfallCard => Boolean(card))
  if (commanders.length > 1) {
    return commanders.map((card) => getCompactCardName(card.name)).join('/')
  }
  return getComparisonCommander(deckStore.deck).name || 'this Commander'
})
const boards: Array<{ title: string; value: TrackedDeckBoard }> = [
  { title: 'Mainboard', value: 'mainboard' },
  { title: 'Sideboard', value: 'sideboard' },
  { title: 'Maybeboard', value: 'maybeboard' },
]

watch(
  [
    () => deckStore.deck.id,
    () => deckStore.deck.commander?.oracle_id,
    timeframe,
  ],
  () => void load(false),
  { immediate: true },
)

// Adding a recommendation changes the source identities. Debounce the refill
// so several quick additions produce one RPC and one Scryfall hydration batch.
let sourceWatcherReady = false
watch(
  () => sourceOracleIds.value.join(','),
  () => {
    if (!sourceWatcherReady) {
      sourceWatcherReady = true
      return
    }
    scheduleRefill()
  },
  { immediate: true },
)

watch(timeframe, () => {
  if (selectedSuggestion.value) {
    void loadDialogHistory(selectedSuggestion.value)
  }
})

onMounted(() => {
  const element = contentElement.value?.$el
  if (!(element instanceof HTMLElement)) return
  const reportHeight = () => {
    emit('contentResized', element.getBoundingClientRect().height)
  }
  reportHeight()
  contentResizeObserver = new ResizeObserver(reportHeight)
  contentResizeObserver.observe(element)
})

onBeforeUnmount(() => {
  contentResizeObserver?.disconnect()
  if (refillTimer !== null) window.clearTimeout(refillTimer)
  if (addCooldownTimer !== null) window.clearTimeout(addCooldownTimer)
})

async function load(showLoader: boolean) {
  const requestId = ++recommendationRequestId
  errorMessage.value = ''
  if (!canLoad.value || !deckStore.deck.commander) {
    suggestions.value = []
    refreshing.value = false
    return
  }
  loading.value = showLoader || suggestions.value.length === 0
  refreshing.value = !loading.value
  try {
    const commander = getComparisonCommander(deckStore.deck)
    const rows = await associationSuggestionRepository.getSuggestionEvidence(
      commander.key,
      sourceOracleIds.value,
      {
        startDate: timeframeStartDate(timeframe.value),
        minimumSampleSize: 20,
        minimumOccurrenceCount: 3,
        minimumConfidence: 0.05,
        minimumLift: 1,
        minimumSupportingCards: 1,
        limit: 5,
      },
    )
    const grouped = associationSuggestionService.buildSuggestions(
      rows,
      ownedOracleIds.value,
      { minimumSupportingCards: 1, limit: 5 },
    )
    const cachedCards = grouped.flatMap((item) => {
      const card = hydratedCardsByOracleId.get(
        item.suggestedOracleId.toLowerCase(),
      )
      return card ? [card] : []
    })
    const missingSuggestions = grouped.filter(
      (item) => !hydratedCardsByOracleId.has(
        item.suggestedOracleId.toLowerCase(),
      ),
    )
    try {
      const cards = await getCardsByExactNames(
        missingSuggestions.map((item) => item.suggestedCardName),
      )
      for (const card of cards) {
        if (card.oracle_id) {
          hydratedCardsByOracleId.set(card.oracle_id.toLowerCase(), card)
        }
      }
    } catch {
      // Card images and rich Scryfall metadata are progressive enhancement.
      // The Oracle-backed association row is still sufficient to add a card.
    }
    if (requestId === recommendationRequestId) {
      const hydratedCards = [
        ...cachedCards,
        ...hydratedCardsByOracleId.values(),
      ]
      suggestions.value = associationSuggestionService.attachCards(
        grouped,
        hydratedCards,
      ).map((suggestion) => ({
        ...suggestion,
        suggestedCard:
          suggestion.suggestedCard ?? fallbackSuggestionCard(suggestion),
      }))
    }
  } catch (error) {
    if (
      requestId === recommendationRequestId &&
      !suggestions.value.length
    ) {
      errorMessage.value = error instanceof Error
        ? error.message
        : 'Unable to load observed recommendations.'
    }
  } finally {
    if (requestId === recommendationRequestId) {
      loading.value = false
      refreshing.value = false
    }
  }
}

function reload() {
  if (refillTimer !== null) {
    window.clearTimeout(refillTimer)
    refillTimer = null
  }
  void load(true)
}

function scheduleRefill() {
  if (refillTimer !== null) window.clearTimeout(refillTimer)
  refreshing.value = true
  refillTimer = window.setTimeout(() => {
    refillTimer = null
    void load(false)
  }, 600)
}

function addToBoard(
  suggestion: AssociationBasedSuggestion,
  board: TrackedDeckBoard,
) {
  if (addOnCooldown.value) return
  const card = suggestion.suggestedCard ?? fallbackSuggestionCard(suggestion)
  suggestions.value = suggestions.value.filter(
    (item) => item.suggestedOracleId !== suggestion.suggestedOracleId,
  )
  if (
    selectedSuggestion.value?.suggestedOracleId
    === suggestion.suggestedOracleId
  ) {
    closeDetails()
  }
  addOnCooldown.value = true
  if (addCooldownTimer !== null) window.clearTimeout(addCooldownTimer)
  addCooldownTimer = window.setTimeout(() => {
    addOnCooldown.value = false
    addCooldownTimer = null
  }, 250)
  emit('add', card, board)
}

function fallbackSuggestionCard(
  suggestion: AssociationBasedSuggestion,
): ScryfallCard {
  return {
    id: suggestion.suggestedOracleId,
    oracle_id: suggestion.suggestedOracleId,
    name: suggestion.suggestedCardName,
    type_line: '',
    color_identity: [],
  }
}

function previewSuggestion(suggestion: AssociationBasedSuggestion) {
  if (suggestion.suggestedCard) {
    deckStore.setPreviewCard(suggestion.suggestedCard)
  }
}

function openDetails(suggestion: AssociationBasedSuggestion) {
  selectedSuggestion.value = suggestion
  dialogPreviewCard.value = suggestion.suggestedCard
  evidenceError.value = ''
  dialogCardsByOracleId.value = new Map()
  if (suggestion.suggestedCard) {
    dialogCardsByOracleId.value.set(
      suggestion.suggestedOracleId.toLowerCase(),
      suggestion.suggestedCard,
    )
  }
  void loadDialogHistory(suggestion)
}

function previewEvidence(evidence: AssociationSuggestionEvidence) {
  const card = evidenceCard(evidence)
  if (card) dialogPreviewCard.value = card
}

function restoreDialogPreview() {
  dialogPreviewCard.value = selectedSuggestion.value?.suggestedCard ?? null
}

async function focusEvidence(evidence: AssociationSuggestionEvidence) {
  const focusedCard = evidenceCard(evidence)
  const commanderKey = selectedSuggestion.value?.commanderKey
  if (!focusedCard || !commanderKey || evidenceLoading.value) return

  evidenceLoading.value = true
  evidenceError.value = ''
  try {
    const associations = await cardAssociationRepository.getAssociations(
      commanderKey,
      evidence.sourceOracleId,
      {
        startDate: timeframeStartDate(timeframe.value),
        minimumSampleSize: 20,
        minimumOccurrenceCount: 3,
        minimumConfidence: 0.05,
        minimumLift: 1,
        limit: 24,
      },
    )
    const cards = await getCardsByExactNames(
      associations.map((association) => association.associatedCardName),
    )
    const nextCards = new Map(dialogCardsByOracleId.value)
    nextCards.set(evidence.sourceOracleId.toLowerCase(), focusedCard)
    for (const card of cards) {
      if (card.oracle_id) nextCards.set(card.oracle_id.toLowerCase(), card)
    }
    dialogCardsByOracleId.value = nextCards

    const nextSuggestion: AssociationBasedSuggestion = {
      suggestedOracleId: evidence.sourceOracleId,
      suggestedCardName: evidence.sourceCardName,
      suggestedCard: focusedCard,
      supportingCardCount: associations.length,
      evidence: associations.map((association) => ({
        sourceOracleId: association.associatedOracleId,
        sourceCardName: association.associatedCardName,
        support: association.support,
        confidence: association.confidence,
        lift: association.lift,
        jointDeckCount: association.deckCount,
        sourceDeckCount: association.confidence > 0
          ? Math.round(association.deckCount / association.confidence)
          : association.sampleSize,
        sampleSize: association.sampleSize,
      })),
      aggregateScore: 0,
      sampleSize: associations[0]?.sampleSize
        ?? selectedSuggestion.value?.sampleSize
        ?? 0,
      commanderKey,
    }
    selectedSuggestion.value = nextSuggestion
    dialogPreviewCard.value = focusedCard
    void loadDialogHistory(nextSuggestion)
  } catch (error) {
    evidenceError.value = error instanceof Error
      ? error.message
      : 'Unable to load observed card associations.'
  } finally {
    evidenceLoading.value = false
  }
}

async function loadDialogHistory(suggestion: AssociationBasedSuggestion) {
  const requestId = ++historyRequestId
  historyLoading.value = true
  historyError.value = ''
  historyPoints.value = []
  try {
    const points = await tournamentRepository.getCardInclusionOverTime(
      suggestion.commanderKey,
      {
        oracleId: suggestion.suggestedOracleId,
        normalizedCardKey: suggestion.suggestedCardName
          .trim()
          .toLocaleLowerCase()
          .replace(/\s+/g, '-'),
      },
      historyPeriod(timeframe.value),
      { startDate: timeframeStartDate(timeframe.value) },
    )
    if (requestId === historyRequestId) historyPoints.value = points
  } catch (error) {
    if (requestId === historyRequestId) {
      historyError.value = error instanceof Error
        ? error.message
        : 'Unable to load inclusion history.'
    }
  } finally {
    if (requestId === historyRequestId) historyLoading.value = false
  }
}

function historyPeriod(value: RecommendationTimeframe): CardInclusionPeriod {
  if (value === 'week') return 'day'
  if (value === 'month' || value === 'three-months') return 'week'
  return 'month'
}

function historyPath(points: Array<[number, number]>): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')
}

function formatHistoryDate(value?: string): string {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function exactEvidence(evidence: AssociationSuggestionEvidence): string {
  return formatSuggestionEvidence(
    evidence.sourceCardName,
    evidence.jointDeckCount,
    evidence.sourceDeckCount,
  )
}

function evidenceCard(evidence: AssociationSuggestionEvidence) {
  const oracleId = evidence.sourceOracleId.toLowerCase()
  return dialogCardsByOracleId.value.get(oracleId)
    ?? sourceCardsByOracleId.value.get(oracleId)
}

function evidenceStrength(
  evidence: AssociationSuggestionEvidence,
): 'strong' | 'moderate' | 'weak' {
  if (
    evidence.lift >= 1.5
    && evidence.confidence >= 0.5
    && evidence.jointDeckCount >= 10
  ) return 'strong'
  if (
    evidence.lift >= 1.2
    && evidence.confidence >= 0.25
    && evidence.jointDeckCount >= 5
  ) return 'moderate'
  return 'weak'
}

function namedCardImage(cardName: string) {
  return 'https://api.scryfall.com/cards/named'
    + `?exact=${encodeURIComponent(cardName)}`
    + '&format=image&version=normal'
}

function tournamentDecksLink(suggestion: AssociationBasedSuggestion) {
  return {
    name: 'commander-metagame',
    params: { commanderKey: suggestion.commanderKey },
    query: { cards: [suggestion.suggestedCardName] },
  }
}

function cardImage(suggestion: AssociationBasedSuggestion): string {
  return suggestion.suggestedCard
    ? getCardImage(suggestion.suggestedCard, 'small') ?? ''
    : ''
}

function closeDetails(value = false) {
  if (!value) {
    selectedSuggestion.value = null
    historyRequestId += 1
    dialogPreviewCard.value = null
    historyPoints.value = []
    historyError.value = ''
    evidenceError.value = ''
    dialogCardsByOracleId.value = new Map()
  }
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function timeframeStartDate(
  value: RecommendationTimeframe,
): string | undefined {
  if (value === 'all') return undefined
  const date = new Date()
  if (value === 'week') date.setUTCDate(date.getUTCDate() - 7)
  if (value === 'month') date.setUTCMonth(date.getUTCMonth() - 1)
  if (value === 'three-months') date.setUTCMonth(date.getUTCMonth() - 3)
  if (value === 'six-months') date.setUTCMonth(date.getUTCMonth() - 6)
  if (value === 'year') date.setUTCFullYear(date.getUTCFullYear() - 1)
  return date.toISOString().slice(0, 10)
}
</script>

<style scoped>
.recommendations-panel {
  overflow: hidden;
}

.recommendations-content {
  padding-bottom: 8px !important;
}

.recommendation-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.recommendation-card {
  cursor: pointer;
  overflow: hidden;
  position: relative;
}

.recommendation-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.recommendation-card__image {
  width: 100%;
}

.recommendation-details__top {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(180px, 230px) minmax(0, 1fr);
}

.recommendation-details__card {
  width: 100%;
}

.recommendation-details__preview {
  align-self: start;
  position: sticky;
  top: 16px;
}

.recommendation-history {
  min-width: 0;
}

.recommendation-history__chart {
  background: rgba(var(--v-theme-surface), 0.45);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
  padding: 8px;
}

.recommendation-history__chart svg {
  display: block;
  overflow: visible;
  width: 100%;
}

.recommendation-history__grid line {
  stroke: rgba(var(--v-theme-on-surface), 0.14);
  stroke-width: 1;
}

.recommendation-history__grid text,
.recommendation-history__date {
  fill: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 12px;
}

.recommendation-history__line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 4;
}

.recommendation-history__line--deck,
.recommendation-history__point--deck {
  stroke: rgb(var(--v-theme-primary));
}

.recommendation-history__line--event,
.recommendation-history__point--event {
  stroke: rgb(var(--v-theme-info));
}

.recommendation-history__point {
  fill: rgb(var(--v-theme-surface));
  stroke-width: 3;
}

.recommendation-history__legend {
  align-items: center;
  display: inline-flex;
  gap: 6px;
}

.recommendation-history__key {
  border-radius: 999px;
  display: inline-block;
  height: 3px;
  width: 22px;
}

.recommendation-history__key--deck {
  background: rgb(var(--v-theme-primary));
}

.recommendation-history__key--event {
  background: rgb(var(--v-theme-info));
}

.recommendation-evidence-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.recommendation-evidence-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.recommendation-evidence-keys {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.recommendation-evidence-key {
  background: rgba(var(--v-theme-surface), 0.45);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  padding: 10px 12px;
}

.recommendation-metric-row {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: auto minmax(0, 1fr);
}

.recommendation-metric-row + .recommendation-metric-row {
  margin-top: 8px;
}

.recommendation-evidence-card {
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
}

.recommendation-evidence-card--strong {
  border-color: rgb(var(--v-theme-success));
}

.recommendation-evidence-card--moderate {
  border-color: rgb(var(--v-theme-warning));
}

.recommendation-evidence-card--weak {
  border-color: rgb(var(--v-theme-error));
}

.recommendation-evidence-card__controls {
  align-items: center;
  display: flex;
  gap: 4px;
  min-height: 36px;
  padding: 5px 6px;
}

.recommendation-evidence-card__controls :deep(.v-chip) {
  flex: 0 0 auto;
}

.recommendation-card__controls,
.recommendation-skeleton__controls {
  min-height: 34px;
  padding: 5px 7px;
}

.recommendation-card__add {
  color: rgb(var(--v-theme-primary)) !important;
  flex: 0 0 auto;
}

.recommendation-card__add-icon {
  fill: currentColor;
  height: 16px;
  width: 16px;
}

.recommendations-reload {
  color: rgb(var(--v-theme-primary)) !important;
  opacity: 1;
}

.recommendations-reload__icon {
  fill: currentColor;
  height: 21px;
  width: 21px;
}

.recommendations-timeframe {
  width: 132px;
}

.recommendations-timeframe :deep(.v-field) {
  background: rgba(var(--v-theme-surface), 0.7);
}

.recommendation-skeleton {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.recommendation-skeleton__image {
  aspect-ratio: 0.714;
  width: 100%;
}

.recommendation-skeleton__chip {
  border-radius: 999px;
  height: 22px;
  width: 72px;
}

.skeleton-pulse {
  animation: skeleton-pulse 1.25s ease-in-out infinite alternate;
  background: rgba(var(--v-theme-on-surface), 0.09);
}

@keyframes skeleton-pulse {
  to {
    background: rgba(var(--v-theme-on-surface), 0.18);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-pulse {
    animation: none;
  }
}

@media (max-width: 599px) {
  .recommendation-details__top {
    grid-template-columns: 1fr;
  }

  .recommendation-evidence-keys {
    grid-template-columns: 1fr;
  }

  .recommendation-details__card {
    margin-inline: auto;
    max-width: 240px;
  }
}
</style>
