<template>
  <v-container class="pa-0" fluid>
    <v-card v-if="!deck" border class="pa-8 text-center">
      <v-card-title>Deck not found</v-card-title>
      <v-card-text>The selected personal Deck is no longer available.</v-card-text>
      <v-btn :to="{ name: 'deck-library' }" color="primary">Back to Decks</v-btn>
    </v-card>

    <template v-else>
      <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-5">
        <div>
          <div class="text-overline text-medium-emphasis">Deck comparison</div>
          <h1 class="text-h4 font-weight-bold">{{ deck.name }}</h1>
          <p class="text-medium-emphasis">
            {{ commanderName || 'No Commander selected' }}
          </p>
        </div>
        <v-btn :to="{ name: 'deck-builder' }" variant="text">
          Back to Deck
        </v-btn>
      </div>

      <v-alert v-if="!deck.commander" type="warning" variant="tonal">
        Select a Commander before comparing this Deck.
      </v-alert>

      <template v-else>
        <v-card border class="mb-5 pa-4">
          <v-card-title>Sample filters</v-card-title>
          <v-row>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field v-model="filters.startDate" label="Start date" type="date" />
            </v-col>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field v-model="filters.endDate" label="End date" type="date" />
            </v-col>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field v-model.number="filters.minimumTournamentSize" label="Minimum event size" min="0" type="number" />
            </v-col>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field v-model.number="filters.maximumStanding" clearable label="Maximum placing" min="1" type="number" />
            </v-col>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field v-model.number="filters.minimumCompleteDecks" label="Minimum Deck sample" min="1" type="number" />
            </v-col>
            <v-col class="d-flex align-center" cols="12" sm="4" lg="2">
              <v-btn color="primary" block @click="loadComparison">Apply filters</v-btn>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" sm="3">
              <v-select v-model="filters.countryCode" clearable :items="locations.countries" label="Country" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-select v-model="filters.stateRegion" clearable :items="locations.states" label="State / province" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-select v-model="filters.regionKey" clearable :items="locations.regions" label="Region" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-select
                v-model="filters.isOnline"
                clearable
                :items="eventFormatItems"
                item-title="title"
                item-value="value"
                label="Event format"
              />
            </v-col>
          </v-row>
        </v-card>

        <v-progress-linear
          v-if="loading"
          aria-label="Loading Deck comparison"
          class="mb-5"
          indeterminate
        />
        <v-alert v-else-if="errorMessage" type="error" variant="tonal">
          {{ errorMessage }}
        </v-alert>

        <template v-else-if="summary">
          <v-alert
            class="mb-5"
            :type="sampleAlertType"
            variant="tonal"
          >
            <strong>{{ summary.totalEligibleDecks }} eligible Decks</strong>
            are included. {{ sampleMessage }}
            Tournament inclusion does not prove card quality.
          </v-alert>

          <!-- A missing normalized sample is unavailable data, not a 0% result. -->
          <v-card
            v-if="!hasEligibleSample"
            border
            class="pa-6 text-center"
          >
            <v-card-title>No normalized comparison data</v-card-title>
            <v-card-text>
              No normalized tournament card data matches this Commander and
              filter set. Tournament metadata alone cannot calculate card
              overlap.
            </v-card-text>
            <v-btn
              :to="{ name: 'admin-ingestion' }"
              color="primary"
              variant="tonal"
            >
              Open Admin Panel
            </v-btn>
          </v-card>

          <template v-else>
            <v-alert
              v-if="summary.unresolvedUserCardCount"
              class="mb-5"
              type="warning"
              variant="tonal"
            >
              {{ summary.unresolvedUserCardCount }} user
              {{ summary.unresolvedUserCardCount === 1 ? 'card uses' : 'cards use' }}
              fallback identity and could not be matched to this sample.
            </v-alert>

            <v-row class="mb-5">
              <v-col v-for="metric in summaryMetrics" :key="metric.label" cols="6" md="3">
                <v-card border class="pa-4 h-100">
                  <div class="text-caption text-medium-emphasis">{{ metric.label }}</div>
                  <div class="text-h5 font-weight-bold">{{ metric.value }}</div>
                </v-card>
              </v-col>
            </v-row>

            <v-alert class="mb-5" type="info" variant="tonal">
              Aggregate overlap is the share of cards played in at least 20% of
              the eligible sample that are also present in your mainboard. It is
              not a power or optimization score.
            </v-alert>

            <v-card border class="mb-6">
              <v-card-title>Card comparison</v-card-title>
              <v-card-text>
                Categories describe frequency and presence only. An absent card
                is not an error, and an uncommon card is not a bad choice.
                <div class="d-flex flex-wrap ga-2 mt-4">
                  <v-chip
                    v-for="option in cardFilterItems"
                    :key="option.value"
                    :color="cardFilter === option.value ? 'primary' : undefined"
                    filter
                    :model-value="cardFilter === option.value"
                    @click="cardFilter = option.value"
                  >
                    {{ option.title }}
                  </v-chip>
                </div>
                <div
                  aria-label="In-deck row highlight legend"
                  class="d-flex flex-wrap ga-2 mt-4"
                >
                  <v-chip color="success" size="small" variant="outlined">
                    In my Deck · 75%+
                  </v-chip>
                  <v-chip color="warning" size="small" variant="outlined">
                    In my Deck · 25–75%
                  </v-chip>
                  <v-chip color="error" size="small" variant="outlined">
                    In my Deck · 25% or less
                  </v-chip>
                </div>
                <v-select
                  v-model="sortBy"
                  class="mt-4"
                  :items="sortItems"
                  item-title="title"
                  item-value="value"
                  label="Sort cards"
                  max-width="320"
                />
              </v-card-text>
              <section
                v-for="section in cardSections"
                :key="section.key"
                class="comparison-card-section"
              >
                <div class="comparison-card-section__header px-4 py-3">
                  <h3 class="text-h6">{{ section.title }}</h3>
                  <p class="text-body-2 text-medium-emphasis">
                    {{ section.description }}
                  </p>
                </div>
                <v-table v-if="section.cards.length">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th><span class="sr-only">Card image</span></th>
                      <th>Card</th>
                      <th>Status</th>
                      <th>Inclusion</th>
                      <th>Decks</th>
                      <th>Average quantity</th>
                      <th>Top 16</th>
                      <th>First place</th>
                      <th>My quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(card, index) in section.cards"
                      :key="card.identityKey"
                      :class="comparisonRowClass(card)"
                    >
                      <td>
                        <v-chip
                          :aria-label="`${section.title} row ${index + 1}`"
                          size="small"
                          variant="tonal"
                        >
                          {{ index + 1 }}
                        </v-chip>
                      </td>
                      <td class="comparison-card-image-cell">
                        <v-img
                          :alt="`${card.cardName} card`"
                          aspect-ratio="0.714"
                          class="comparison-card-image"
                          contain
                          :src="comparisonCardImageUrl(card)"
                          width="72"
                        />
                      </td>
                      <td>
                        <div class="font-weight-medium">{{ card.cardName }}</div>
                        <div class="text-caption text-medium-emphasis">
                          {{ card.typeLine || 'Type unavailable' }}
                        </div>
                      </td>
                      <td><v-chip size="small" variant="tonal">{{ categoryLabel(card.category) }}</v-chip></td>
                      <td>{{ percent(card.inclusionRate) }}</td>
                      <td>{{ card.deckCount }} / {{ card.totalEligibleDecks }}</td>
                      <td>{{ card.averageQuantity.toFixed(2) }}</td>
                      <td>{{ percent(card.top16InclusionRate) }}</td>
                      <td>{{ percent(card.firstPlaceInclusionRate) }}</td>
                      <td>{{ card.userQuantity }}</td>
                    </tr>
                  </tbody>
                </v-table>
                <v-card-text v-else class="text-medium-emphasis">
                  {{ section.emptyMessage }}
                </v-card-text>
              </section>
            </v-card>

            <v-card border>
              <v-card-title>Similar tournament Decks</v-card-title>
              <v-card-text>
                Jaccard similarity compares unique mainboard identities:
                shared cards divided by the union of both Decks.
              </v-card-text>
              <v-table v-if="similarities.length">
              <thead>
                <tr>
                  <th>Similarity</th><th>Tournament</th><th>Pilot</th>
                  <th>Standing</th><th>Date</th><th>Region</th><th>Shared</th><th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in similarities" :key="item.tournamentDeckId">
                  <td>{{ percent(item.similarityRate) }}</td>
                  <td>{{ item.tournamentName }}</td>
                  <td>{{ item.pilotName || 'Unknown' }}</td>
                  <td>{{ item.standing ?? '—' }}</td>
                  <td>{{ formatDate(item.eventDate) }}</td>
                  <td>{{ item.regionKey || 'Unknown' }}</td>
                  <td>{{ item.sharedCardCount }} / {{ item.unionCardCount }}</td>
                  <td>
                    <v-btn
                      :aria-label="`View ${item.tournamentName} Deck`"
                      :to="{ name: 'tournament-deck-detail', params: { deckId: item.tournamentDeckId } }"
                      variant="text"
                    >
                      View Deck
                    </v-btn>
                  </td>
                </tr>
              </tbody>
              </v-table>
              <v-card-text v-else class="text-medium-emphasis">
                No eligible tournament Decks match these filters.
              </v-card-text>
            </v-card>
          </template>
        </template>
      </template>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import type {
  DeckComparisonCard,
  DeckComparisonCategory,
  DeckComparisonFilters,
  TournamentDeckSimilarity,
} from '../models/deckComparison'
import {
  deckComparisonRepository,
} from '../repositories/deckComparisonRepository'
import {
  tournamentRepository,
  type TournamentLocationOptions,
} from '../repositories/tournamentRepository'
import {
  buildDeckComparisonSummary,
  getComparisonCommander,
  getUserMainboardCards,
} from '../services/deckComparison'
import { useDeckStore } from '../stores/deck'

type CardFilter = 'all' | 'shared' | 'absent' | 'uncommon' |
  'core' | 'common' | 'flexible' | 'rare'
type CardSort = 'default' | 'inclusion' | 'name' | 'average' |
  'quantity' | 'top16' | 'first'

const route = useRoute()
const deckStore = useDeckStore()
const deck = computed(() =>
  deckStore.library.decks.find((item) => item.id === String(route.params.deckId)),
)
const commanderName = computed(() =>
  deck.value ? getComparisonCommander(deck.value).name : '',
)
const filters = reactive<DeckComparisonFilters>({
  minimumTournamentSize: 0,
  minimumCompleteDecks: 1,
})
const loading = ref(false)
const errorMessage = ref('')
const summary = ref<ReturnType<typeof buildDeckComparisonSummary> | null>(null)
const similarities = ref<TournamentDeckSimilarity[]>([])
const locations = ref<TournamentLocationOptions>({
  countries: [], states: [], regions: [], hasOnline: false,
})
const cardFilter = ref<CardFilter>('all')
// Inclusion is the most useful first scan for an aggregate comparison.
const sortBy = ref<CardSort>('inclusion')
const eventFormatItems = [
  { title: 'Online', value: true },
  { title: 'In person', value: false },
]
const cardFilterItems: Array<{ title: string; value: CardFilter }> = [
  { title: 'All', value: 'all' },
  { title: 'Shared', value: 'shared' },
  { title: 'Absent from my Deck', value: 'absent' },
  { title: 'Uncommon in sample', value: 'uncommon' },
  { title: 'Core', value: 'core' },
  { title: 'Common', value: 'common' },
  { title: 'Flexible', value: 'flexible' },
  { title: 'Rare', value: 'rare' },
]
const sortItems = [
  { title: 'Descriptive category', value: 'default' },
  { title: 'Inclusion rate', value: 'inclusion' },
  { title: 'Card name', value: 'name' },
  { title: 'Average quantity', value: 'average' },
  { title: 'My quantity', value: 'quantity' },
  { title: 'Top-16 inclusion', value: 'top16' },
  { title: 'First-place inclusion', value: 'first' },
]
const visibleCards = computed(() => {
  if (!summary.value) return []
  const cards = summary.value.cards.filter((card) => matchesFilter(card.category))
  if (sortBy.value === 'default') return cards
  return [...cards].sort((left, right) => {
    if (sortBy.value === 'name') return left.cardName.localeCompare(right.cardName)
    if (sortBy.value === 'average') return right.averageQuantity - left.averageQuantity
    if (sortBy.value === 'quantity') return right.userQuantity - left.userQuantity
    if (sortBy.value === 'top16') return right.top16InclusionRate - left.top16InclusionRate
    if (sortBy.value === 'first') return right.firstPlaceInclusionRate - left.firstPlaceInclusionRate
    return right.inclusionRate - left.inclusionRate
  })
})
const cardSections = computed(() => [
  {
    key: 'in-deck',
    title: 'Cards in Your Deck',
    description:
      'Your mainboard cards and how often they appear in the tournament sample.',
    emptyMessage: 'No cards in your deck match the selected filter.',
    cards: visibleCards.value.filter((card) => card.isInUserDeck),
  },
  {
    key: 'usual-inclusions',
    title: 'Usual Inclusions Not in Your Deck',
    description:
      'Common tournament inclusions that are not currently in your mainboard.',
    emptyMessage: 'No absent usual inclusions match the selected filter.',
    cards: visibleCards.value.filter((card) => !card.isInUserDeck),
  },
])
const summaryMetrics = computed(() => summary.value ? [
  { label: 'My unique mainboard cards', value: summary.value.userMainboardUniqueCards },
  { label: 'Aggregate card set', value: summary.value.aggregateUniqueCards },
  { label: 'Shared cards', value: summary.value.sharedCardCount },
  { label: 'Aggregate overlap', value: percent(summary.value.aggregateOverlapRate) },
] : [])
const hasEligibleSample = computed(() =>
  (summary.value?.totalEligibleDecks ?? 0) > 0,
)
const sampleAlertType = computed(() =>
  summary.value?.sampleStatus === 'sufficient' ? 'info' : 'warning',
)
const sampleMessage = computed(() => {
  if (summary.value?.sampleStatus === 'sufficient') return 'This is a sufficient descriptive sample.'
  if (summary.value?.sampleStatus === 'limited') return 'This limited sample may be volatile.'
  if (summary.value?.sampleStatus === 'insufficient') return 'This very small sample is volatile.'
  return 'No eligible tournament sample is available.'
})

async function loadComparison() {
  if (!deck.value?.commander) return
  loading.value = true
  errorMessage.value = ''
  try {
    const commander = getComparisonCommander(deck.value)
    const keys = [...getUserMainboardCards(deck.value).keys()]
    const data = await deckComparisonRepository.compare(
      commander.key,
      keys,
      filters,
    )
    summary.value = buildDeckComparisonSummary(deck.value, data.inclusion, filters)
    similarities.value = data.similarities
  } catch (error) {
    summary.value = null
    similarities.value = []
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Unable to compare this Deck.'
  } finally {
    loading.value = false
  }
}

function matchesFilter(category: DeckComparisonCategory) {
  if (cardFilter.value === 'all') return true
  if (cardFilter.value === 'shared') return category.startsWith('shared-')
  if (cardFilter.value === 'absent') return category.startsWith('absent-')
  if (cardFilter.value === 'uncommon') return category === 'user-uncommon'
  return category.endsWith(`-${cardFilter.value}`)
}

function categoryLabel(category: DeckComparisonCategory) {
  return category.split('-').map((word) =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

/** Scryfall's named endpoint redirects to a complete card image. */
function comparisonCardImageUrl(card: DeckComparisonCard): string {
  return 'https://api.scryfall.com/cards/named' +
    `?exact=${encodeURIComponent(card.cardName)}` +
    '&format=image&version=small'
}

function comparisonRowClass(card: DeckComparisonCard): string | undefined {
  if (!card.isInUserDeck) return undefined
  if (card.inclusionRate >= 0.75) return 'comparison-row--high'
  if (card.inclusionRate <= 0.25) return 'comparison-row--low'
  return 'comparison-row--medium'
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Unknown'
}

onMounted(async () => {
  if (deck.value) deckStore.openDeck(deck.value.id)
  try {
    locations.value = await tournamentRepository.getLocationOptions()
  } catch {
    // Comparison remains usable when optional location metadata is unavailable.
  }
  await loadComparison()
})
</script>

<style scoped>
.comparison-card-section {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.comparison-card-section__header {
  background: rgba(var(--v-theme-on-surface), 0.035);
}

.comparison-row--high {
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-success));
}

.comparison-row--medium {
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-warning));
}

.comparison-row--low {
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-error));
}
</style>
