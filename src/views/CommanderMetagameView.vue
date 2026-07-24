<template>
  <v-container class="pa-0" fluid>
    <AppLoadingSkeleton v-if="loading" variant="detail" />
    <v-alert v-else-if="errorMessage" type="error">{{ errorMessage }}</v-alert>
    <template v-else-if="detail?.stats">
      <div class="d-flex align-center flex-wrap ga-3">
        <h1 class="text-h4 font-weight-bold">
          {{ detail.stats.commanderName }}
        </h1>
        <ColorIdentitySymbols :colors="detail.stats.colorIdentity" />
        <v-spacer />
        <v-btn variant="outlined" @click="associationDialog = true">
          Card associations
        </v-btn>
      </div>
      <div class="d-flex flex-wrap ga-2 my-5">
        <v-chip>{{ detail.stats.entries }} entries</v-chip>
        <v-chip>{{ percent(detail.stats.metaShare) }} meta share</v-chip>
        <v-chip>{{ percent(detail.stats.matchWinRate) }} match win rate</v-chip>
        <v-chip>{{ percent(detail.stats.topCutRate) }} top-16 rate</v-chip>
      </div>
      <v-card border class="mb-5 pa-4">
        <div class="text-subtitle-1 font-weight-bold mb-2">
          Filter Commander Decks by cards
        </div>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Select up to five cards. Results must contain every selected card in
          the same complete tournament mainboard.
        </p>
        <CardSearch
          clear-on-select
          elevated-results
          :selected-card-ids="selectedCards.map((card) => card.id)"
          :selected-cards="selectedCards"
          @card-removed="removeCardFilter"
          @card-selected="addCardFilter"
        />
        <v-alert
          v-if="cardFilterMessage"
          class="mt-3"
          type="warning"
          variant="tonal"
        >
          {{ cardFilterMessage }}
        </v-alert>
      </v-card>
      <v-row align="start">
        <v-col cols="12" md="6">
          <v-card border>
            <v-card-title>Tournament Decks</v-card-title>
            <v-divider />
          <AppLoadingSkeleton
            v-if="filterLoading"
            class="ma-3"
            :count="6"
            label="Loading tournament Decks"
            variant="table"
          />
          <v-alert
            v-else-if="filterError"
            class="mb-3"
            type="error"
            variant="tonal"
          >
            {{ filterError }}
          </v-alert>
          <v-list v-if="selectedCards.length" class="commander-event-list">
        <v-list-item
          v-for="entry in paginatedFilteredEvents"
          :key="entry.tournamentEntryId"
          class="commander-event-list__item"
          :subtitle="`${entry.playerName || 'Unknown pilot'} · Place ${entry.standing ?? '—'} · ${entry.wins}-${entry.losses}-${entry.draws}`"
          :title="entry.tournamentName"
          :to="{
            name: 'tournament-detail',
            params: { tournamentId: entry.tournamentId },
          }"
        >
          <template #append>
            <v-btn
              :to="{
                name: 'tournament-detail',
                params: { tournamentId: entry.tournamentId },
                query: { entryId: entry.tournamentEntryId },
              }"
              variant="text"
              @click.stop
            >
              View Deck
            </v-btn>
          </template>
        </v-list-item>
        <v-list-item
          v-if="!filterLoading && !filteredEvents.length"
          subtitle="Try removing a card filter."
          title="No complete Commander Decks contain every selected card"
        />
          </v-list>
          <v-list v-else class="commander-event-list">
        <v-list-item
          v-for="entry in paginatedEntries"
          :key="entry.id"
          class="commander-event-list__item"
          :subtitle="`${entry.playerName || 'Unknown pilot'} · Place ${entry.standing ?? '—'} · ${entry.wins}-${entry.losses}-${entry.draws}`"
          :title="entry.tournamentName || 'Unknown tournament'"
          :to="{ name: 'tournament-detail', params: { tournamentId: entry.tournamentId } }"
        >
          <template #append>
            <v-btn
              v-if="entry.tournamentDeckId"
              :to="{
                name: 'tournament-detail',
                params: { tournamentId: entry.tournamentId },
                query: { entryId: entry.id },
              }"
              variant="text"
              @click.stop
            >
              View Deck
            </v-btn>
            <v-btn v-else-if="entry.decklistUrl" :href="entry.decklistUrl" target="_blank" variant="text">Decklist</v-btn>
          </template>
        </v-list-item>
          </v-list>
          <v-pagination
            v-if="eventPageCount > 1"
            v-model="eventPage"
            class="my-4"
            :length="eventPageCount"
            rounded="circle"
          />
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card
            border
            width="100%"
          >
            <v-card-title class="d-flex align-center">
              <span>Card inclusions</span>
              <v-spacer />
              <v-select
                v-model="inclusionTimeframe"
                aria-label="Card inclusion timeframe"
                class="inclusion-timeframe mr-2"
                density="comfortable"
                hide-details
                :items="inclusionTimeframeOptions"
                variant="outlined"
              />
              <v-btn
                size="small"
                variant="text"
                @click="inclusionDialog = true"
              >
                View all
              </v-btn>
            </v-card-title>
            <v-divider />
            <AppLoadingSkeleton
              v-if="inclusionLoading"
              class="ma-3"
              :count="6"
              label="Loading card inclusions"
              variant="cards"
            />
            <v-alert
              v-else-if="inclusionError"
              class="ma-3"
              density="comfortable"
              type="warning"
              variant="tonal"
            >
              {{ inclusionError }}
            </v-alert>
            <div
              v-else-if="cardInclusions.length"
              class="card-inclusions-grid pa-4"
            >
              <v-card
                v-for="card in topCardInclusions"
                :key="card.oracleId ?? card.normalizedCardKey"
                border
                class="card-inclusion-tile"
                color="surface"
                variant="flat"
              >
                <v-img
                  v-if="card.imageUrl"
                  :alt="`${card.cardName} card image`"
                  aspect-ratio="0.716"
                  class="full-card-image"
                  cover
                  :src="card.imageUrl"
                />
                <v-sheet
                  v-else
                  class="d-flex align-center justify-center text-caption"
                  color="surface-light"
                  height="180"
                >
                  Image unavailable
                </v-sheet>
                <v-card-text class="pa-2">
                  <div class="text-body-2 font-weight-medium text-truncate">
                    {{ card.cardName }}
                  </div>
                  <div class="d-flex align-center justify-space-between ga-2 mt-2">
                    <span class="text-caption text-medium-emphasis">
                      {{ card.deckCount }}/{{ card.totalEligibleDecks }}
                    </span>
                  <v-chip color="primary" size="small" variant="tonal">
                    {{ percent(card.inclusionRate) }}
                  </v-chip>
                  </div>
                </v-card-text>
              </v-card>
            </div>
            <v-card-text v-else class="text-medium-emphasis">
              No card-inclusion data is available for this Commander.
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-dialog v-model="inclusionDialog" max-width="1400">
        <v-card>
          <v-card-title class="dialog-toolbar d-flex align-center ga-3">
            <div>
              <div>Card inclusions</div>
              <div class="text-caption text-medium-emphasis">
                {{ detail.stats.commanderName }}
              </div>
            </div>
            <v-spacer />
            <v-select
              v-model="inclusionTimeframe"
              aria-label="Dialog card inclusion timeframe"
              class="inclusion-timeframe"
              density="comfortable"
              hide-details
              :items="inclusionTimeframeOptions"
              variant="outlined"
            />
            <v-btn
              aria-label="Close card inclusions"
              color="primary"
              icon
              variant="text"
              @click="inclusionDialog = false"
            >
              <DeckActionIcon compact name="close" />
            </v-btn>
          </v-card-title>
          <v-divider />
          <AppLoadingSkeleton
            v-if="inclusionLoading"
            class="ma-4"
            :count="8"
            label="Loading card inclusions"
            variant="cards"
          />
          <v-alert
            v-else-if="inclusionError"
            class="ma-4"
            type="warning"
            variant="tonal"
          >
            {{ inclusionError }}
          </v-alert>
          <div
            v-else-if="cardInclusions.length"
            class="card-inclusions-grid card-inclusions-grid--dialog pa-4"
          >
            <v-card
              v-for="card in cardInclusions"
              :key="card.oracleId ?? card.normalizedCardKey"
              border
              class="card-inclusion-tile"
              color="surface"
              variant="flat"
            >
              <v-img
                v-if="card.imageUrl"
                :alt="`${card.cardName} card image`"
                aspect-ratio="0.716"
                class="full-card-image"
                cover
                :src="card.imageUrl"
              />
              <v-sheet
                v-else
                class="d-flex align-center justify-center text-caption"
                color="surface-light"
                height="220"
              >
                Image unavailable
              </v-sheet>
              <v-card-text class="pa-2">
                <div class="text-body-2 font-weight-medium text-truncate">
                  {{ card.cardName }}
                </div>
                <div class="d-flex align-center justify-space-between ga-2 mt-2">
                  <span class="text-caption text-medium-emphasis">
                    {{ card.deckCount }}/{{ card.totalEligibleDecks }}
                  </span>
                  <v-chip color="primary" size="small" variant="tonal">
                    {{ percent(card.inclusionRate) }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </div>
          <v-card-text v-else class="text-medium-emphasis">
            No card-inclusion data is available for this timeframe.
          </v-card-text>
        </v-card>
      </v-dialog>

      <v-dialog v-model="associationDialog" max-width="1400">
        <v-card>
          <v-card-title class="dialog-toolbar d-flex align-center">
            <span>Card associations</span>
            <v-spacer />
            <v-btn
              aria-label="Close card associations"
              color="primary"
              icon
              variant="text"
              @click="associationDialog = false"
            >
              <DeckActionIcon compact name="close" />
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text>
            <CardAssociationsView
              :allowed-color-identity="detail.stats.colorIdentity"
              embedded
              :initial-commander-key="detail.stats.commanderKey"
            />
          </v-card-text>
        </v-card>
      </v-dialog>
      <p class="mt-4 text-caption text-medium-emphasis">
        Data provided by
        <a href="https://topdeck.gg" target="_blank" rel="noopener noreferrer">TopDeck.gg</a>
        and
        <a href="https://edhtop16.com" target="_blank" rel="noopener noreferrer">EDHTop16</a>.
      </p>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getCardsByExactNames } from '../api/scryfall'
import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue'
import CardSearch from '../components/CardSearch.vue'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import DeckActionIcon from '../components/DeckActionIcon.vue'
import CardAssociationsView from './CardAssociationsView.vue'
import type { CommanderDeckEvent } from '../models/commanderDeckEvent'
import type { CommanderCardInclusion } from '../models/tournament'
import { commanderDeckEventRepository } from '../repositories/commanderDeckEventRepository'
import {
  tournamentRepository,
  type CommanderDetail,
} from '../repositories/tournamentRepository'
import type { ScryfallCard } from '../types/card'

const route = useRoute()
const detail = ref<CommanderDetail | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const selectedCards = ref<ScryfallCard[]>([])
const filteredEvents = ref<CommanderDeckEvent[]>([])
const filterLoading = ref(false)
const filterError = ref('')
const cardFilterMessage = ref('')
const cardInclusions = ref<CommanderCardInclusion[]>([])
const topCardInclusions = computed(() => cardInclusions.value.slice(0, 20))
const inclusionLoading = ref(true)
const inclusionError = ref('')
const inclusionDialog = ref(false)
const associationDialog = ref(false)
type InclusionTimeframe =
  | 'week'
  | 'month'
  | 'three-months'
  | 'six-months'
  | 'year'
  | 'all'
const inclusionTimeframe = ref<InclusionTimeframe>('all')
const inclusionTimeframeOptions: Array<{
  title: string
  value: InclusionTimeframe
}> = [
  { title: '1 week', value: 'week' },
  { title: '1 month', value: 'month' },
  { title: '3 months', value: 'three-months' },
  { title: '6 months', value: 'six-months' },
  { title: '1 year', value: 'year' },
  { title: 'All time', value: 'all' },
]
const eventPage = ref(1)
const EVENTS_PER_PAGE = 40
const paginatedEntries = computed(() => {
  const start = (eventPage.value - 1) * EVENTS_PER_PAGE
  return detail.value?.entries.slice(start, start + EVENTS_PER_PAGE) ?? []
})
const paginatedFilteredEvents = computed(() => {
  const start = (eventPage.value - 1) * EVENTS_PER_PAGE
  return filteredEvents.value.slice(start, start + EVENTS_PER_PAGE)
})
const eventPageCount = computed(() => {
  const count = selectedCards.value.length
    ? filteredEvents.value.length
    : detail.value?.entries.length ?? 0
  return Math.max(1, Math.ceil(count / EVENTS_PER_PAGE))
})

watch(inclusionTimeframe, () => {
  void loadCardInclusions()
})

onMounted(async () => {
  try {
    detail.value = await tournamentRepository.getCommanderDetails(
      String(route.params.commanderKey),
    )
    if (!detail.value.stats) errorMessage.value = 'Commander data not found.'
    await loadCardInclusions()
    await restoreCardFiltersFromRoute()
    inclusionDialog.value = route.query.inclusions === 'all'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load Commander data.'
  } finally {
    loading.value = false
  }
})

async function loadCardInclusions() {
  inclusionLoading.value = true
  inclusionError.value = ''
  try {
    const cards = await tournamentRepository.getCommanderCardInclusion(
      String(route.params.commanderKey),
      { startDate: timeframeStartDate(inclusionTimeframe.value) },
    )
    cardInclusions.value = [...cards]
      .sort((left, right) =>
        right.inclusionRate - left.inclusionRate
        || right.deckCount - left.deckCount
        || left.cardName.localeCompare(right.cardName),
      )
  } catch (error) {
    cardInclusions.value = []
    inclusionError.value = error instanceof Error
      ? error.message
      : 'Unable to load card inclusions.'
  } finally {
    inclusionLoading.value = false
  }
}

async function addCardFilter(card: ScryfallCard) {
  cardFilterMessage.value = ''
  if (!card.oracle_id) {
    cardFilterMessage.value = 'That card does not have an Oracle identity.'
    return
  }
  if (selectedCards.value.some((item) => item.oracle_id === card.oracle_id)) {
    return
  }
  if (selectedCards.value.length >= 5) {
    cardFilterMessage.value = 'You can filter by up to five cards.'
    return
  }
  selectedCards.value.push(card)
  eventPage.value = 1
  await loadFilteredEvents()
}

async function removeCardFilter(card: ScryfallCard) {
  selectedCards.value = selectedCards.value.filter(
    (item) => item.id !== card.id,
  )
  eventPage.value = 1
  cardFilterMessage.value = ''
  if (selectedCards.value.length) await loadFilteredEvents()
  else filteredEvents.value = []
}

async function loadFilteredEvents() {
  const oracleIds = selectedCards.value
    .map((card) => card.oracle_id)
    .filter((value): value is string => Boolean(value))
  if (!oracleIds.length) return
  filterLoading.value = true
  filterError.value = ''
  try {
    filteredEvents.value = await commanderDeckEventRepository.getByCards(
      String(route.params.commanderKey),
      oracleIds,
    )
  } catch (error) {
    filteredEvents.value = []
    filterError.value = error instanceof Error
      ? error.message
      : 'Unable to filter Commander Decks by cards.'
  } finally {
    filterLoading.value = false
  }
}

async function restoreCardFiltersFromRoute() {
  const queryValue = route.query.cards
  const names = (Array.isArray(queryValue) ? queryValue : [queryValue])
    .filter((value): value is string => typeof value === 'string')
    .slice(0, 5)
  if (!names.length) return
  try {
    const cards = await getCardsByExactNames(names)
    selectedCards.value = cards
      .filter((card) => card.oracle_id)
      .slice(0, 5)
    eventPage.value = 1
    await loadFilteredEvents()
  } catch {
    cardFilterMessage.value =
      'The linked card filter could not be resolved through Scryfall.'
  }
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function timeframeStartDate(value: InclusionTimeframe): string | undefined {
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
.card-inclusions-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
}

.card-inclusions-grid--dialog {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  max-height: 75vh;
  overflow-y: auto;
}

.card-inclusion-tile {
  min-width: 0;
}

.inclusion-timeframe {
  flex: 0 0 140px;
  max-width: 140px;
}

@media (max-width: 599px) {
  .commander-event-list__item {
    align-items: flex-start;
    padding-block: 10px;
  }

  .commander-event-list__item :deep(.v-list-item-subtitle) {
    margin-top: 4px;
    white-space: normal;
  }

  .commander-event-list__item :deep(.v-list-item__append) {
    align-self: flex-end;
  }

  .commander-event-list__item :deep(.v-list-item__append .v-btn) {
    min-width: 44px;
    padding-inline: 8px;
  }

  .card-inclusions-grid,
  .card-inclusions-grid--dialog {
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 8px !important;
  }

  .dialog-toolbar {
    align-items: stretch !important;
    flex-wrap: wrap;
  }

  .dialog-toolbar > .v-spacer {
    display: none;
  }

  .dialog-toolbar .inclusion-timeframe {
    flex: 1 1 calc(100% - 52px);
    max-width: none;
    order: 2;
  }
}
</style>
