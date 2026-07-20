<template>
  <v-container class="pa-0" fluid>
    <div v-if="!embedded" class="mb-5">
      <h1 class="text-h4 font-weight-bold">Card associations</h1>
      <p class="text-medium-emphasis">
        Explore observed co-occurrence in complete tournament
        Decks. These relationships are not causal and are not recommendations.
      </p>
    </div>

    <v-card border class="association-controls mb-3 pa-3">
      <v-row dense>
        <v-col v-if="!initialCommanderKey" cols="12" md="6">
          <v-autocomplete
            v-model="commanderKey"
            clearable
            density="compact"
            hide-details
            :items="commanderOptions"
            item-title="title"
            item-value="value"
            label="Commander"
            no-data-text="No Commanders found"
          />
        </v-col>
        <v-col cols="12" :md="initialCommanderKey ? 12 : 6">
          <CardSearch
            v-model="cardSearchQuery"
            clearable
            compact
            elevated-results
            :search-filter="colorIdentitySearchFilter"
            :selected-card="selectedCard"
            @card-selected="selectCard"
            @cleared="selectedCard = null"
          />
        </v-col>
      </v-row>
      <div class="association-filter-grid mt-2">
        <v-text-field
          v-model="startDate"
          density="compact"
          hide-details
          label="Start date"
          type="date"
        />
        <v-text-field
          v-model="endDate"
          density="compact"
          hide-details
          label="End date"
          type="date"
        />
        <v-text-field
          v-model.number="minimumSampleSize"
          density="compact"
          hide-details
          label="Min sample"
          min="1"
          type="number"
        />
        <v-text-field
          v-model.number="minimumSupportPercent"
          density="compact"
          hide-details
          label="Min support (%)"
          min="0"
          max="100"
          step="1"
          type="number"
        />
        <v-text-field
          v-model.number="minimumConfidencePercent"
          density="compact"
          hide-details
          label="Min confidence (%)"
          min="0"
          max="100"
          step="1"
          type="number"
        />
        <v-text-field
          v-model.number="minimumLift"
          density="compact"
          hide-details
          label="Min lift"
          min="0"
          step="0.1"
          type="number"
        />
        <v-text-field
          v-model.number="minimumEventSize"
          density="compact"
          hide-details
          label="Min event size"
          min="0"
          type="number"
        />
        <v-text-field
          v-model.number="maximumStanding"
          clearable
          density="compact"
          hide-details
          label="Max placing"
          min="1"
          type="number"
        />
        <div class="association-actions d-flex align-center ga-2">
          <v-btn density="compact" variant="text" @click="resetFilters">
            Reset
          </v-btn>
          <v-btn
            color="primary"
            density="compact"
            :disabled="!canLoad"
            :loading="loading"
            @click="loadAssociations"
          >
            View associations
          </v-btn>
        </div>
      </div>
    </v-card>

    <v-card border class="metric-key mb-3 pa-3">
      <div><strong>Support</strong> — Percent of all sampled Decks containing both cards.</div>
      <div><strong>Confidence</strong> — Percent of Decks with the searched card that also contain this card.</div>
      <div><strong>Lift</strong> — Co-occurrence compared with the card's usual inclusion rate; 1× means no observed increase.</div>
      <div><strong>Sample</strong> — Complete tournament Decks included after applying the filters.</div>
    </v-card>

    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <v-card v-else-if="hasSearched && !associations.length" border class="pa-8 text-center">
      No statistically reliable associations match these filters. Widen the
      sample or choose another card.
    </v-card>
    <v-card v-else-if="associations.length" border>
      <v-card-title>
        Strongest observed associations for {{ selectedCard?.name }}
      </v-card-title>
      <div class="association-grid pa-4">
        <v-card
          v-for="association in associations"
          :key="association.associatedOracleId"
          border
          class="association-card"
          color="surface"
          variant="flat"
        >
          <v-img
            v-if="associationImages.get(association.associatedOracleId)"
            :alt="`${association.associatedCardName} card image`"
            aspect-ratio="0.716"
            class="full-card-image"
            cover
            :src="associationImages.get(association.associatedOracleId)"
          />
          <v-sheet
            v-else
            class="d-flex align-center justify-center text-medium-emphasis"
            color="surface-light"
            height="265"
          >
            Image unavailable
          </v-sheet>
          <v-card-text class="pa-3">
            <div class="font-weight-bold mb-2">
              {{ association.associatedCardName }}
            </div>
            <div class="association-metrics">
              <span title="Share of eligible Decks containing both cards.">
                Support <strong>{{ percent(association.support) }}</strong>
              </span>
              <span title="Share of Decks with the selected card that also contain this card.">
                Confidence
                <strong>{{ percent(association.confidence) }}</strong>
              </span>
              <span title="Co-occurrence divided by baseline inclusion rate.">
                Lift <strong>{{ association.lift.toFixed(2) }}×</strong>
              </span>
              <span title="Complete tournament Decks in this sample.">
                Sample <strong>{{ association.sampleSize }}</strong>
              </span>
            </div>
            <div class="text-caption text-medium-emphasis mt-2">
              {{ association.deckCount }} joint Decks ·
              {{ association.strength }} observed association
            </div>
          </v-card-text>
        </v-card>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCardsByOracleIds } from '../api/scryfall'
import CardSearch from '../components/CardSearch.vue'
import { getCardImage } from '../utils/cardDisplay'
import type { AssociationAnalysis } from '../models/cardAssociation'
import { cardAssociationRepository } from '../repositories/cardAssociationRepository'
import { tournamentRepository } from '../repositories/tournamentRepository'
import {
  cardAssociationService,
  DEFAULT_ASSOCIATION_THRESHOLDS,
} from '../services/cardAssociationService'
import type { ScryfallCard } from '../types/card'

const props = withDefaults(defineProps<{
  embedded?: boolean
  initialCommanderKey?: string
  allowedColorIdentity?: string[]
}>(), {
  embedded: false,
  initialCommanderKey: undefined,
  allowedColorIdentity: () => [],
})

const commanderKey = ref<string | undefined>(props.initialCommanderKey)
const commanderOptions = ref<Array<{ title: string; value: string }>>([])
const selectedCard = ref<ScryfallCard | null>(null)
const cardSearchQuery = ref('')
const startDate = ref('')
const endDate = ref('')
const minimumSampleSize = ref(20)
const minimumEventSize = ref(0)
const maximumStanding = ref<number>()
const minimumSupportPercent = ref(0)
const minimumConfidencePercent = ref(
  DEFAULT_ASSOCIATION_THRESHOLDS.minimumConfidence * 100,
)
const minimumLift = ref(DEFAULT_ASSOCIATION_THRESHOLDS.minimumLift)
const associations = ref<AssociationAnalysis[]>([])
const loading = ref(false)
const hasSearched = ref(false)
const errorMessage = ref('')
const associationImages = ref(new Map<string, string>())

const canLoad = computed(
  () => Boolean(commanderKey.value && selectedCard.value?.oracle_id),
)
const colorIdentitySearchFilter = computed(() => {
  if (!props.initialCommanderKey && !props.allowedColorIdentity.length) {
    return ''
  }
  return props.allowedColorIdentity.length
    ? `id<=${props.allowedColorIdentity.join('').toLowerCase()}`
    : 'id:c'
})

function selectCard(card: ScryfallCard) {
  selectedCard.value = card
}

async function loadAssociations() {
  const oracleId = selectedCard.value?.oracle_id
  if (!commanderKey.value || !oracleId) return

  loading.value = true
  hasSearched.value = true
  errorMessage.value = ''
  try {
    const thresholds = {
      ...DEFAULT_ASSOCIATION_THRESHOLDS,
      minimumSampleSize: Math.max(1, minimumSampleSize.value || 20),
      minimumConfidence: toRate(minimumConfidencePercent.value),
      minimumLift: Math.max(0, minimumLift.value || 0),
    }
    const rows = await cardAssociationRepository.getAssociations(
      commanderKey.value,
      oracleId,
      {
        startDate: startDate.value || undefined,
        endDate: endDate.value || undefined,
        minimumTournamentSize: Math.max(0, minimumEventSize.value || 0),
        maximumStanding: maximumStanding.value,
        minimumSampleSize: thresholds.minimumSampleSize,
        minimumOccurrenceCount: thresholds.minimumOccurrenceCount,
        minimumConfidence: thresholds.minimumConfidence,
        minimumLift: thresholds.minimumLift,
      },
    )
    const minimumSupport = toRate(minimumSupportPercent.value)
    associations.value = cardAssociationService
      .analyze(rows, thresholds)
      .filter((association) => association.support >= minimumSupport)
    await loadAssociationImages()
  } catch (error) {
    associations.value = []
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Unable to load card associations.'
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  if (!props.initialCommanderKey) {
    commanderKey.value = undefined
  }
  selectedCard.value = null
  cardSearchQuery.value = ''
  startDate.value = ''
  endDate.value = ''
  minimumSampleSize.value = 20
  minimumEventSize.value = 0
  maximumStanding.value = undefined
  minimumSupportPercent.value = 0
  minimumConfidencePercent.value =
    DEFAULT_ASSOCIATION_THRESHOLDS.minimumConfidence * 100
  minimumLift.value = DEFAULT_ASSOCIATION_THRESHOLDS.minimumLift
  associations.value = []
  associationImages.value = new Map()
  hasSearched.value = false
  errorMessage.value = ''
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function toRate(value: number) {
  return Math.min(100, Math.max(0, value || 0)) / 100
}

async function loadAssociationImages() {
  associationImages.value = new Map()
  try {
    const cards = await getCardsByOracleIds(
      associations.value.map((association) => association.associatedOracleId),
    )
    associationImages.value = new Map(cards.flatMap((card) => {
      const image = getCardImage(card)
      return card.oracle_id && image ? [[card.oracle_id, image]] : []
    }))
  } catch {
    // Statistical results remain useful during a temporary image outage.
  }
}

onMounted(async () => {
  if (props.initialCommanderKey) return
  try {
    const commanders = await tournamentRepository.getCommanderMetagame({
      minimumEntries: 1,
    })
    commanderOptions.value = commanders.map((commander) => ({
      title: commander.commanderName,
      value: commander.commanderKey,
    }))
  } catch {
    // The primary analysis action reports RPC errors. An empty Commander
    // selector is a safe fallback when metadata cannot be loaded.
  }
})
</script>

<style scoped>
.association-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
}

.association-filter-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
}

.association-actions {
  grid-column: 3 / -1;
  justify-self: end;
}

.association-metrics {
  display: grid;
  font-size: 0.75rem;
  gap: 6px 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.association-metrics span {
  display: flex;
  flex-direction: column;
}

.association-metrics strong {
  font-size: 0.875rem;
}

.metric-key {
  display: grid;
  gap: 8px;
}

@media (max-width: 959px) {
  .association-filter-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }

  .association-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 599px) {
  .association-filter-grid {
    grid-template-columns: 1fr;
  }

  .association-actions {
    grid-column: 1;
    justify-self: end;
  }
}
</style>
