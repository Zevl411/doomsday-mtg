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
        <v-btn :to="{ name: 'deck-builder', params: { deckId: deck.id } }" variant="text">
          Back to Deck
        </v-btn>
      </div>

      <v-alert v-if="!deck.commander" type="warning" variant="tonal">
        Select a Commander before comparing this Deck.
      </v-alert>

      <template v-else>
        <v-expansion-panels
          v-model="mobileFilterPanel"
          class="comparison-mobile-filter-panel d-sm-none mb-5"
        >
          <v-expansion-panel value="filters">
            <v-expansion-panel-title> Filters </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="comparison-mobile-filter-grid">
                <v-text-field
                  v-model="filters.startDate"
                  hide-details
                  label="Start date"
                  type="date"
                />
                <v-text-field v-model="filters.endDate" hide-details label="End date" type="date" />
                <v-text-field
                  v-model.number="filters.minimumTournamentSize"
                  hide-details
                  label="Minimum event size"
                  min="0"
                  type="number"
                />
                <v-text-field
                  v-model.number="filters.maximumStanding"
                  clearable
                  hide-details
                  label="Maximum placing"
                  min="1"
                  type="number"
                />
                <v-text-field
                  v-model.number="filters.minimumCompleteDecks"
                  hide-details
                  label="Minimum Deck sample"
                  min="1"
                  type="number"
                />
                <v-btn color="primary" block @click="loadComparison"> Apply filters </v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <v-card border class="d-none d-sm-block mb-5 pa-4">
          <v-card-title>Sample filters</v-card-title>
          <v-row>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field v-model="filters.startDate" label="Start date" type="date" />
            </v-col>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field v-model="filters.endDate" label="End date" type="date" />
            </v-col>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field
                v-model.number="filters.minimumTournamentSize"
                label="Minimum event size"
                min="0"
                type="number"
              />
            </v-col>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field
                v-model.number="filters.maximumStanding"
                clearable
                label="Maximum placing"
                min="1"
                type="number"
              />
            </v-col>
            <v-col cols="12" sm="4" lg="2">
              <v-text-field
                v-model.number="filters.minimumCompleteDecks"
                label="Minimum Deck sample"
                min="1"
                type="number"
              />
            </v-col>
            <v-col class="d-flex align-center" cols="12" sm="4" lg="2">
              <v-btn color="primary" block @click="loadComparison">Apply filters</v-btn>
            </v-col>
          </v-row>
        </v-card>

        <AppLoadingSkeleton
          v-if="loading"
          class="mb-5"
          :count="6"
          label="Loading Deck comparison"
          variant="cards"
        />
        <v-alert v-else-if="errorMessage" type="error" variant="tonal">
          {{ errorMessage }}
        </v-alert>

        <template v-else-if="summary">
          <v-alert class="d-none d-sm-block mb-5" :type="sampleAlertType" variant="tonal">
            <strong>{{ summary.totalEligibleDecks }} eligible Decks</strong>
            are included. {{ sampleMessage }}
            Tournament inclusion does not prove card quality.
          </v-alert>

          <!-- A missing comparison sample is unavailable data, not a 0% result. -->
          <v-card v-if="!hasEligibleSample" border class="pa-6 text-center">
            <v-card-title>No comparison data</v-card-title>
            <v-card-text>
              No complete tournament card data matches this Commander and filter set. Tournament
              metadata alone cannot calculate card overlap.
            </v-card-text>
            <v-btn :to="{ name: 'admin-ingestion' }" color="primary" variant="tonal">
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

            <v-row class="d-none d-sm-flex mb-5">
              <v-col v-for="metric in summaryMetrics" :key="metric.label" cols="6" md="3">
                <v-card border class="pa-4 h-100">
                  <div class="text-caption text-medium-emphasis">{{ metric.label }}</div>
                  <div class="text-h5 font-weight-bold">{{ metric.value }}</div>
                </v-card>
              </v-col>
            </v-row>

            <v-expansion-panels
              v-model="mobileStatsPanel"
              class="comparison-mobile-stats-panel d-sm-none mb-5"
            >
              <v-expansion-panel value="stats">
                <v-expansion-panel-title> Statistics </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-alert class="mb-3" :type="sampleAlertType" variant="tonal">
                    <strong> {{ summary.totalEligibleDecks }} eligible Decks </strong>
                    are included. {{ sampleMessage }}
                    Tournament inclusion does not prove card quality.
                  </v-alert>
                  <div class="comparison-mobile-stats">
                    <v-sheet
                      v-for="metric in summaryMetrics"
                      :key="metric.label"
                      border
                      class="pa-3"
                      color="surface-light"
                    >
                      <div class="text-caption text-medium-emphasis">
                        {{ metric.label }}
                      </div>
                      <div class="text-h6 font-weight-bold">
                        {{ metric.value }}
                      </div>
                    </v-sheet>
                  </div>
                  <v-alert class="mt-3" type="info" variant="tonal">
                    Aggregate overlap is the share of cards played in at least 20% of the eligible
                    sample that are also present in your mainboard. It is not a power or
                    optimization score.
                  </v-alert>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <v-alert class="d-none d-sm-block mb-5" type="info" variant="tonal">
              Aggregate overlap is the share of cards played in at least 20% of the eligible sample
              that are also present in your mainboard. It is not a power or optimization score.
            </v-alert>

            <v-card border class="mb-6">
              <v-card-title>Card comparison</v-card-title>
              <v-card-text>
                Categories describe frequency and presence only. An absent card is not an error, and
                an uncommon card is not a bad choice.
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
                <div aria-label="In-deck row highlight legend" class="d-flex flex-wrap ga-2 mt-4">
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
                <v-table
                  v-if="section.cards.length"
                  class="comparison-table comparison-table--cards d-none d-sm-block"
                >
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
                      <td class="comparison-rank-cell" data-label="Rank">
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
                          class="comparison-card-image full-card-image"
                          cover
                          :src="comparisonCardImageUrl(card)"
                          width="72"
                        />
                      </td>
                      <td class="comparison-card-name-cell" data-label="Card">
                        <div class="font-weight-medium">{{ card.cardName }}</div>
                        <div class="text-caption text-medium-emphasis">
                          {{ card.typeLine || 'Type unavailable' }}
                        </div>
                      </td>
                      <td data-label="Status">
                        <v-chip size="small" variant="tonal">{{
                          categoryLabel(card.category)
                        }}</v-chip>
                      </td>
                      <td data-label="Inclusion">{{ percent(card.inclusionRate) }}</td>
                      <td data-label="Decks">
                        {{ card.deckCount }} / {{ card.totalEligibleDecks }}
                      </td>
                      <td data-label="Average quantity">{{ card.averageQuantity.toFixed(2) }}</td>
                      <td data-label="Top 16">{{ percent(card.top16InclusionRate) }}</td>
                      <td data-label="First place">{{ percent(card.firstPlaceInclusionRate) }}</td>
                      <td data-label="My quantity">{{ card.userQuantity }}</td>
                    </tr>
                  </tbody>
                </v-table>
                <div v-if="section.cards.length" class="comparison-mobile-card-list d-sm-none">
                  <v-card
                    v-for="card in section.cards"
                    :key="`mobile-${card.identityKey}`"
                    border
                    :class="['comparison-mobile-card', comparisonRowClass(card)]"
                    color="surface"
                    variant="flat"
                  >
                    <v-card-text class="pa-3">
                      <div class="comparison-mobile-card__top">
                        <v-img
                          :alt="`${card.cardName} card`"
                          aspect-ratio="0.714"
                          class="comparison-mobile-card__image"
                          :src="comparisonCardImageUrl(card)"
                        />
                        <div class="comparison-mobile-card__summary">
                          <div class="font-weight-bold">
                            {{ card.cardName }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{ card.typeLine || 'Type unavailable' }}
                          </div>
                          <v-chip class="mt-2" size="small" variant="tonal">
                            {{ categoryLabel(card.category) }}
                          </v-chip>
                        </div>
                      </div>
                      <div class="comparison-mobile-card__metrics">
                        <div v-for="metric in mobileCardMetrics(card)" :key="metric.label">
                          <span>{{ metric.label }}</span>
                          <strong>{{ metric.value }}</strong>
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
                <v-card-text v-else class="text-medium-emphasis">
                  {{ section.emptyMessage }}
                </v-card-text>
              </section>
            </v-card>

            <v-card border>
              <v-card-title>Similar tournament Decks</v-card-title>
              <v-card-text>
                Jaccard similarity compares unique mainboard identities: shared cards divided by the
                union of both Decks.
              </v-card-text>
              <v-table
                v-if="similarities.length"
                class="comparison-table comparison-table--similar"
              >
                <thead>
                  <tr>
                    <th>Similarity</th>
                    <th>Tournament</th>
                    <th>Pilot</th>
                    <th>Standing</th>
                    <th>Date</th>
                    <th>Region</th>
                    <th>Shared</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in similarities" :key="item.tournamentDeckId">
                    <td data-label="Similarity">{{ percent(item.similarityRate) }}</td>
                    <td data-label="Tournament">{{ item.tournamentName }}</td>
                    <td data-label="Pilot">{{ item.pilotName || 'Unknown' }}</td>
                    <td data-label="Standing">{{ item.standing ?? '—' }}</td>
                    <td data-label="Date">{{ formatDate(item.eventDate) }}</td>
                    <td data-label="Region">{{ item.regionKey || 'Unknown' }}</td>
                    <td data-label="Shared">
                      {{ item.sharedCardCount }} / {{ item.unionCardCount }}
                    </td>
                    <td class="comparison-action-cell">
                      <v-btn
                        :aria-label="`View ${item.tournamentName} Deck`"
                        :to="{
                          name: 'tournament-deck-detail',
                          params: { deckId: item.tournamentDeckId },
                        }"
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
import { computed, onMounted, reactive, ref } from 'vue';

import { useRoute } from 'vue-router';

import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue';
import { deckComparisonRepository } from '../repositories/deckComparisonRepository';
import {
  buildDeckComparisonSummary,
  getComparisonCommander,
  getUserMainboardCards,
} from '../services/deckComparison';
import { useDeckStore } from '../stores/deck';

import type {
  DeckComparisonCard,
  DeckComparisonCategory,
  DeckComparisonFilters,
  TournamentDeckSimilarity,
} from '../models/deckComparison';

type CardFilter =
  'all' | 'shared' | 'absent' | 'uncommon' | 'core' | 'common' | 'flexible' | 'rare';
type CardSort = 'default' | 'inclusion' | 'name' | 'average' | 'quantity' | 'top16' | 'first';

const route = useRoute();
const deckStore = useDeckStore();
const deck = computed(() =>
  deckStore.library.decks.find((item) => item.id === String(route.params.deckId)),
);
const commanderName = computed(() => (deck.value ? getComparisonCommander(deck.value).name : ''));
const filters = reactive<DeckComparisonFilters>({
  minimumTournamentSize: 0,
  minimumCompleteDecks: 1,
});
const loading = ref(false);
const errorMessage = ref('');
const mobileFilterPanel = ref<string>();
const mobileStatsPanel = ref<string>();
const summary = ref<ReturnType<typeof buildDeckComparisonSummary> | null>(null);
const similarities = ref<TournamentDeckSimilarity[]>([]);
const cardFilter = ref<CardFilter>('all');
// Inclusion is the most useful first scan for an aggregate comparison.
const sortBy = ref<CardSort>('inclusion');
const cardFilterItems: Array<{ title: string; value: CardFilter }> = [
  { title: 'All', value: 'all' },
  { title: 'Shared', value: 'shared' },
  { title: 'Absent from my Deck', value: 'absent' },
  { title: 'Uncommon in sample', value: 'uncommon' },
  { title: 'Core', value: 'core' },
  { title: 'Common', value: 'common' },
  { title: 'Flexible', value: 'flexible' },
  { title: 'Rare', value: 'rare' },
];
const sortItems = [
  { title: 'Descriptive category', value: 'default' },
  { title: 'Inclusion rate', value: 'inclusion' },
  { title: 'Card name', value: 'name' },
  { title: 'Average quantity', value: 'average' },
  { title: 'My quantity', value: 'quantity' },
  { title: 'Top-16 inclusion', value: 'top16' },
  { title: 'First-place inclusion', value: 'first' },
];
const visibleCards = computed(() => {
  if (!summary.value) return [];
  const cards = summary.value.cards.filter((card) => matchesFilter(card.category));
  if (sortBy.value === 'default') return cards;
  return [...cards].sort((left, right) => {
    if (sortBy.value === 'name') return left.cardName.localeCompare(right.cardName);
    if (sortBy.value === 'average') return right.averageQuantity - left.averageQuantity;
    if (sortBy.value === 'quantity') return right.userQuantity - left.userQuantity;
    if (sortBy.value === 'top16') return right.top16InclusionRate - left.top16InclusionRate;
    if (sortBy.value === 'first')
      return right.firstPlaceInclusionRate - left.firstPlaceInclusionRate;
    return right.inclusionRate - left.inclusionRate;
  });
});
const cardSections = computed(() => [
  {
    key: 'in-deck',
    title: 'Cards in Your Deck',
    description: 'Your mainboard cards and how often they appear in the tournament sample.',
    emptyMessage: 'No cards in your deck match the selected filter.',
    cards: visibleCards.value.filter((card) => card.isInUserDeck),
  },
  {
    key: 'usual-inclusions',
    title: 'Usual Inclusions Not in Your Deck',
    description: 'Common tournament inclusions that are not currently in your mainboard.',
    emptyMessage: 'No absent usual inclusions match the selected filter.',
    cards: visibleCards.value.filter((card) => !card.isInUserDeck),
  },
]);
const summaryMetrics = computed(() =>
  summary.value
    ? [
        { label: 'My unique mainboard cards', value: summary.value.userMainboardUniqueCards },
        { label: 'Aggregate card set', value: summary.value.aggregateUniqueCards },
        { label: 'Shared cards', value: summary.value.sharedCardCount },
        { label: 'Aggregate overlap', value: percent(summary.value.aggregateOverlapRate) },
      ]
    : [],
);
const hasEligibleSample = computed(() => (summary.value?.totalEligibleDecks ?? 0) > 0);
const sampleAlertType = computed(() =>
  summary.value?.sampleStatus === 'sufficient' ? 'info' : 'warning',
);
const sampleMessage = computed(() => {
  if (summary.value?.sampleStatus === 'sufficient')
    return 'This is a sufficient descriptive sample.';
  if (summary.value?.sampleStatus === 'limited') return 'This limited sample may be volatile.';
  if (summary.value?.sampleStatus === 'insufficient') return 'This very small sample is volatile.';
  return 'No eligible tournament sample is available.';
});

async function loadComparison() {
  if (!deck.value?.commander) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const commander = getComparisonCommander(deck.value);
    const keys = [...getUserMainboardCards(deck.value).keys()];
    const data = await deckComparisonRepository.compare(commander.key, keys, filters);
    summary.value = buildDeckComparisonSummary(deck.value, data.inclusion, filters);
    similarities.value = data.similarities;
  } catch (error) {
    summary.value = null;
    similarities.value = [];
    errorMessage.value = error instanceof Error ? error.message : 'Unable to compare this Deck.';
  } finally {
    loading.value = false;
  }
}

function matchesFilter(category: DeckComparisonCategory) {
  if (cardFilter.value === 'all') return true;
  if (cardFilter.value === 'shared') return category.startsWith('shared-');
  if (cardFilter.value === 'absent') return category.startsWith('absent-');
  if (cardFilter.value === 'uncommon') return category === 'user-uncommon';
  return category.endsWith(`-${cardFilter.value}`);
}

function categoryLabel(category: DeckComparisonCategory) {
  return category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Scryfall's named endpoint redirects to a complete card image. */
function comparisonCardImageUrl(card: DeckComparisonCard): string {
  return (
    'https://api.scryfall.com/cards/named' +
    `?exact=${encodeURIComponent(card.cardName)}` +
    '&format=image&version=small'
  );
}

function comparisonRowClass(card: DeckComparisonCard): string | undefined {
  if (!card.isInUserDeck) return undefined;
  if (card.inclusionRate >= 0.75) return 'comparison-row--high';
  if (card.inclusionRate <= 0.25) return 'comparison-row--low';
  return 'comparison-row--medium';
}

function mobileCardMetrics(card: DeckComparisonCard) {
  return [
    { label: 'Inclusion', value: percent(card.inclusionRate) },
    {
      label: 'Decks',
      value: `${card.deckCount} / ${card.totalEligibleDecks}`,
    },
    { label: 'Average quantity', value: card.averageQuantity.toFixed(2) },
    { label: 'Top 16', value: percent(card.top16InclusionRate) },
    { label: 'First place', value: percent(card.firstPlaceInclusionRate) },
    { label: 'My quantity', value: card.userQuantity.toString() },
  ];
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Unknown';
}

onMounted(async () => {
  if (deck.value) deckStore.openDeck(deck.value.id);
  await loadComparison();
});
</script>

<style scoped>
.comparison-card-section {
  border-top: 1px solid rgb(var(--v-border-color), var(--v-border-opacity));
}

.comparison-card-section__header {
  background: rgb(var(--v-theme-on-surface), 0.035);
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

.comparison-mobile-filter-grid,
.comparison-mobile-stats {
  display: grid;
  gap: 10px;
}

.comparison-mobile-stats {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.comparison-mobile-card-list {
  display: grid;
  gap: 10px;
  padding: 10px;
}

.comparison-mobile-card {
  overflow: hidden;
}

.comparison-mobile-card__top {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.comparison-mobile-card__image {
  width: 96px;
  overflow: hidden;
  background: rgb(var(--v-theme-background));
  border-radius: 6px;
}

.comparison-mobile-card__summary {
  min-width: 0;
  overflow-wrap: anywhere;
}

.comparison-mobile-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid rgb(var(--v-border-color), var(--v-border-opacity));
}

.comparison-mobile-card__metrics div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.comparison-mobile-card__metrics span {
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface), 0.62);
}

.comparison-mobile-card__metrics strong {
  font-size: 0.9rem;
}

@media (width <= 599px) {
  .comparison-table :deep(thead) {
    display: none;
  }

  .comparison-table :deep(table),
  .comparison-table :deep(tbody) {
    display: block;
    width: 100%;
    min-width: 0 !important;
  }

  .comparison-table :deep(tbody tr) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 12px;
    padding: 12px;
    border-bottom: 1px solid rgb(var(--v-border-color), var(--v-border-opacity));
  }

  .comparison-table :deep(tbody td) {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: auto;
    padding: 0;
    white-space: normal;
    border: 0;
  }

  .comparison-table :deep(tbody td[data-label]::before) {
    font-size: 0.6875rem;
    font-weight: 700;
    color: rgb(var(--v-theme-on-surface));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    content: attr(data-label);
    opacity: 0.62;
  }

  .comparison-table--similar :deep(tbody td:nth-child(2)) {
    grid-row: 1;
    grid-column: 1 / -1;
  }

  .comparison-table :deep(.comparison-action-cell) {
    grid-column: 1 / -1;
  }

  .comparison-table :deep(.comparison-action-cell .v-btn) {
    width: 100%;
  }
}
</style>
