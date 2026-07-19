<template>
  <v-container class="pa-0" fluid>
    <div class="mb-5">
      <h1 class="text-h4 font-weight-bold">Card associations</h1>
      <p class="text-medium-emphasis">
        Explore observed co-occurrence in complete normalized tournament
        Decks. These relationships are not causal and are not recommendations.
      </p>
    </div>

    <v-card border class="mb-5 pa-4">
      <v-row>
        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="commanderKey"
            clearable
            :items="commanderOptions"
            item-title="title"
            item-value="value"
            label="Commander"
            no-data-text="No normalized Commanders found"
          />
        </v-col>
        <v-col cols="12" md="6">
          <CardSearch
            clearable
            elevated-results
            :selected-card="selectedCard"
            @card-selected="selectCard"
            @cleared="selectedCard = null"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" sm="6" md="3">
          <v-text-field v-model="startDate" label="Start date" type="date" />
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-text-field v-model="endDate" label="End date" type="date" />
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-select
            v-model="regionKey"
            clearable
            :items="regions"
            label="Region"
          />
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-text-field
            v-model.number="minimumSampleSize"
            label="Minimum sample size"
            min="1"
            type="number"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model.number="minimumEventSize"
            label="Minimum event size"
            min="0"
            type="number"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model.number="maximumStanding"
            clearable
            label="Maximum placing"
            min="1"
            type="number"
          />
        </v-col>
        <v-col class="d-flex align-center ga-2" cols="12" sm="4">
          <v-btn
            color="primary"
            :disabled="!canLoad"
            :loading="loading"
            @click="loadAssociations"
          >
            View associations
          </v-btn>
          <v-btn variant="text" @click="resetFilters">Reset</v-btn>
        </v-col>
      </v-row>
    </v-card>

    <v-alert class="mb-5" type="info" variant="tonal">
      Results describe observed tournament associations: when the selected card
      appeared, these cards also appeared at the displayed rate. Correlation
      does not establish causation, card quality, or performance impact.
    </v-alert>

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
      <v-table>
        <thead>
          <tr>
            <th>Card</th>
            <MetricHeader
              label="Support"
              tooltip="The share of all eligible Decks containing both cards."
            />
            <MetricHeader
              label="Confidence"
              tooltip="Among eligible Decks containing the selected card, the share also containing this card."
            />
            <MetricHeader
              label="Lift"
              tooltip="Observed co-occurrence divided by this card's baseline inclusion rate. Values above 1 indicate a positive association."
            />
            <MetricHeader
              label="Sample Size"
              tooltip="The number of complete normalized Commander Decks eligible under the current filters."
            />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="association in associations"
            :key="association.associatedOracleId"
          >
            <td>
              <div class="font-weight-bold">
                {{ association.associatedCardName }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ association.deckCount }} joint Decks ·
                {{ association.strength }} observed association
              </div>
            </td>
            <td>{{ percent(association.support) }}</td>
            <td>{{ percent(association.confidence) }}</td>
            <td>{{ association.lift.toFixed(2) }}×</td>
            <td>{{ association.sampleSize }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import CardSearch from '../components/CardSearch.vue'
import type { AssociationAnalysis } from '../models/cardAssociation'
import { cardAssociationRepository } from '../repositories/cardAssociationRepository'
import { tournamentRepository } from '../repositories/tournamentRepository'
import {
  cardAssociationService,
  DEFAULT_ASSOCIATION_THRESHOLDS,
} from '../services/cardAssociationService'
import type { ScryfallCard } from '../types/card'

const commanderKey = ref<string>()
const commanderOptions = ref<Array<{ title: string; value: string }>>([])
const selectedCard = ref<ScryfallCard | null>(null)
const startDate = ref('')
const endDate = ref('')
const regionKey = ref<string>()
const regions = ref<string[]>([])
const minimumSampleSize = ref(20)
const minimumEventSize = ref(0)
const maximumStanding = ref<number>()
const associations = ref<AssociationAnalysis[]>([])
const loading = ref(false)
const hasSearched = ref(false)
const errorMessage = ref('')

const canLoad = computed(
  () => Boolean(commanderKey.value && selectedCard.value?.oracle_id),
)

const MetricHeader = defineComponent({
  props: {
    label: { type: String, required: true },
    tooltip: { type: String, required: true },
  },
  setup(props) {
    return () => h('th', [
      h('span', props.label),
      h('span', {
        class: 'metric-help ml-1',
        title: props.tooltip,
        'aria-label': `${props.label}: ${props.tooltip}`,
      }, '?'),
    ])
  },
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
    }
    const rows = await cardAssociationRepository.getAssociations(
      commanderKey.value,
      oracleId,
      {
        startDate: startDate.value || undefined,
        endDate: endDate.value || undefined,
        regionKey: regionKey.value,
        minimumTournamentSize: Math.max(0, minimumEventSize.value || 0),
        maximumStanding: maximumStanding.value,
        minimumSampleSize: thresholds.minimumSampleSize,
        minimumOccurrenceCount: thresholds.minimumOccurrenceCount,
        minimumConfidence: thresholds.minimumConfidence,
        minimumLift: thresholds.minimumLift,
      },
    )
    associations.value = cardAssociationService.analyze(rows, thresholds)
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
  startDate.value = ''
  endDate.value = ''
  regionKey.value = undefined
  minimumSampleSize.value = 20
  minimumEventSize.value = 0
  maximumStanding.value = undefined
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

onMounted(async () => {
  try {
    const [commanders, locations] = await Promise.all([
      tournamentRepository.getCommanderMetagame({ minimumEntries: 1 }),
      tournamentRepository.getLocationOptions(),
    ])
    commanderOptions.value = commanders.map((commander) => ({
      title: commander.commanderName,
      value: commander.commanderKey,
    }))
    regions.value = locations.regions
  } catch {
    // The primary analysis action reports RPC errors. Empty selector data is a
    // safe fallback when optional filter metadata cannot be loaded.
  }
})
</script>

<style scoped>
.metric-help {
  align-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  cursor: help;
  display: inline-flex;
  font-size: 0.65rem;
  height: 1rem;
  justify-content: center;
  opacity: 0.72;
  width: 1rem;
}
</style>
