<template>
  <v-container class="pa-0" fluid>
    <div class="d-flex flex-wrap align-start justify-space-between ga-3 mb-6">
      <div>
      <h1 class="text-h4 font-weight-bold">Commander metagame</h1>
      <p class="text-medium-emphasis">
        Tournament results from TopDeck and EDHTop16. Percentages
        include their sample sizes and reflect the selected filters.
      </p>
      <p class="text-caption">
        Data provided by
        <a href="https://topdeck.gg" target="_blank" rel="noopener noreferrer">TopDeck.gg</a>
        and
        <a href="https://edhtop16.com" target="_blank" rel="noopener noreferrer">EDHTop16</a>.
      </p>
      </div>
    </div>

    <v-card border class="mb-6 pa-4" color="surface" rounded="lg">
      <AppMobileFilterPanel>
        <v-row>
        <v-col cols="12" sm="6" md="2">
          <v-select
            v-model="timeframe"
            label="Timeframe"
            :items="timeframeOptions"
          />
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-text-field
            v-model="startDate"
            label="Start date"
            type="date"
            @update:model-value="selectCustomTimeframe"
          />
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-text-field
            v-model="endDate"
            label="End date"
            type="date"
            @update:model-value="selectCustomTimeframe"
          />
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-text-field
            v-model.number="minimumPlayers"
            label="Minimum players"
            min="0"
            type="number"
          />
        </v-col>
        <v-col cols="12" sm="6" md="2">
          <v-text-field
            v-model.number="minimumEntries"
            label="Minimum entries"
            min="1"
            type="number"
          />
        </v-col>
        <v-col class="d-flex ga-2" cols="12" md="2">
          <v-btn color="primary" @click="load">Apply</v-btn>
          <v-btn variant="text" @click="reset">Reset</v-btn>
        </v-col>
        </v-row>
      </AppMobileFilterPanel>
    </v-card>

    <AppLoadingSkeleton
      v-if="loading"
      :count="8"
      label="Loading Commander metagame"
      variant="cards"
    />
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <v-card v-else-if="!stats.length" border class="pa-8 text-center">
      No tournament results match these filters.
    </v-card>
    <v-row v-else class="commander-grid">
      <v-col
        v-for="item in stats"
        :key="item.commanderKey"
        cols="12"
        sm="6"
        md="6"
        lg="4"
        xl="3"
      >
        <v-card
          border
          class="commander-card fill-height"
          color="surface"
          rounded="lg"
          :to="{
            name: 'commander-metagame',
            params: { commanderKey: item.commanderKey },
          }"
        >
          <div
            v-if="item.imageUrls?.length"
            class="commander-card__images"
          >
            <v-img
              :alt="item.commanderName"
              class="commander-card__image commander-card__image--primary"
              cover
              position="center 40%"
              :src="item.imageUrls[0]"
            />
            <v-img
              v-if="item.imageUrls[1]"
              alt=""
              class="commander-card__image commander-card__image--partner"
              cover
              position="center 40%"
              :src="item.imageUrls[1]"
            />
          </div>
          <div
            v-else
            class="commander-card__placeholder d-flex align-center justify-center"
          >
            No card image
          </div>

          <v-card-title class="commander-card__title">
            <span>{{ item.commanderName }}</span>
            <ColorIdentitySymbols
              :colors="item.colorIdentity"
              size="small"
            />
          </v-card-title>
          <v-card-text>
            <div class="commander-card__metrics">
              <div>
                <span>Entries</span>
                <strong>{{ item.entries }}</strong>
              </div>
              <div>
                <span>Meta share</span>
                <strong>{{ percent(item.metaShare) }}</strong>
              </div>
              <div>
                <span>Win rate</span>
                <strong>{{ percent(item.matchWinRate) }}</strong>
              </div>
              <div>
                <span>Top {{ topFinishThreshold }}</span>
                <strong>{{ item.top16Finishes }}</strong>
              </div>
              <div>
                <span>Top-cut rate</span>
                <strong>{{ percent(item.topCutRate) }}</strong>
              </div>
              <div>
                <span>Wins</span>
                <strong>{{ item.firstPlaceFinishes }}</strong>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue'
import AppMobileFilterPanel from '../components/AppMobileFilterPanel.vue'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import type { CommanderMetagameStats } from '../models/tournament'
import { tournamentRepository } from '../repositories/tournamentRepository'

const stats = ref<CommanderMetagameStats[]>([])
const loading = ref(false)
const errorMessage = ref('')
const startDate = ref('')
const endDate = ref('')
const minimumPlayers = ref(0)
const minimumEntries = ref(1)
const topFinishThreshold = 16
type MetagameTimeframe =
  | 'week'
  | 'month'
  | 'three-months'
  | 'six-months'
  | 'year'
  | 'all'
  | 'custom'
const timeframe = ref<MetagameTimeframe>('all')
const timeframeOptions: Array<{
  title: string
  value: MetagameTimeframe
}> = [
  { title: '1 week', value: 'week' },
  { title: '1 month', value: 'month' },
  { title: '3 months', value: 'three-months' },
  { title: '6 months', value: 'six-months' },
  { title: '1 year', value: 'year' },
  { title: 'All time', value: 'all' },
  { title: 'Custom dates', value: 'custom' },
]

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    stats.value = await tournamentRepository.getCommanderMetagame({
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      minimumPlayers: minimumPlayers.value,
      minimumEntries: minimumEntries.value,
      topFinishThreshold,
    })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load metagame data.'
  } finally {
    loading.value = false
  }
}

function reset() {
  const timeframeWillReload = timeframe.value !== 'all'
  timeframe.value = 'all'
  startDate.value = ''
  endDate.value = ''
  minimumPlayers.value = 0
  minimumEntries.value = 1
  if (!timeframeWillReload) void load()
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function selectCustomTimeframe() {
  timeframe.value = 'custom'
}

function timeframeStartDate(value: MetagameTimeframe): string {
  if (value === 'all' || value === 'custom') return ''
  const date = new Date()
  if (value === 'week') date.setUTCDate(date.getUTCDate() - 7)
  if (value === 'month') date.setUTCMonth(date.getUTCMonth() - 1)
  if (value === 'three-months') date.setUTCMonth(date.getUTCMonth() - 3)
  if (value === 'six-months') date.setUTCMonth(date.getUTCMonth() - 6)
  if (value === 'year') date.setUTCFullYear(date.getUTCFullYear() - 1)
  return date.toISOString().slice(0, 10)
}

watch(timeframe, (value) => {
  if (value === 'custom') return
  startDate.value = timeframeStartDate(value)
  endDate.value = ''
  void load()
})

onMounted(load)
</script>

<style scoped>
.commander-card {
  overflow: hidden;
  transition: border-color 160ms ease, box-shadow 160ms ease,
    transform 160ms ease;
}

.commander-card:hover {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 14px rgba(var(--v-theme-primary), 0.2);
  transform: translateY(-2px);
}

.commander-card__images {
  /* Match deck tiles and reveal a little more vertical artwork. */
  aspect-ratio: 1.55;
  background: rgb(var(--v-theme-background));
  overflow: hidden;
  position: relative;
}

.commander-card__image {
  inset: 0;
  position: absolute;
}

.commander-card__image--primary:has(+ .commander-card__image--partner) {
  right: auto;
  width: 58%;
  mask-image: linear-gradient(
    90deg,
    black 0%,
    black 72%,
    transparent 100%
  );
}

.commander-card__image--partner {
  left: auto;
  width: 58%;
  mask-image: linear-gradient(
    90deg,
    transparent 0%,
    black 28%,
    black 100%
  );
}

.commander-card__placeholder {
  aspect-ratio: 1.55;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
}

.commander-card__title {
  align-items: center;
  display: flex;
  font-size: 1rem;
  gap: 0.5rem;
  justify-content: space-between;
  line-height: 1.3;
  white-space: normal;
}

.commander-card__metrics {
  display: grid;
  gap: 0.65rem 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.commander-card__metrics div {
  display: flex;
  flex-direction: column;
}

.commander-card__metrics span {
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.75rem;
  opacity: 0.68;
}

.commander-card__metrics strong {
  font-size: 0.95rem;
}
</style>
