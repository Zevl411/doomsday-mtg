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
          <v-card border color="surface" height="100%" variant="flat">
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
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { CommanderCardInclusion } from '../models/tournament'
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

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
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
