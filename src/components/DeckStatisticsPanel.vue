<template>
  <v-card
    border
    class="deck-statistics-panel h-100 w-100"
    color="surface-bright"
    rounded="lg"
    variant="flat"
  >
    <v-card-title class="widget-header-bar px-5 py-3">
      Deck Statistics
    </v-card-title>
    <v-card-text class="statistics-content pa-4">
      <v-row density="comfortable">
        <v-col v-for="stat in summaryStats" :key="stat.label" cols="6" sm="3">
          <v-sheet class="pa-3 text-center" color="surface-light" rounded="lg">
            <div class="text-h6 font-weight-bold">{{ stat.value }}</div>
            <div class="text-caption text-medium-emphasis">{{ stat.label }}</div>
          </v-sheet>
        </v-col>
      </v-row>
      <v-divider class="my-4" />
      <div class="d-flex align-center justify-space-between ga-3 mb-2">
        <div class="text-subtitle-2">Mana Curve</div>
        <div class="d-flex flex-wrap justify-end ga-3">
          <v-switch
            v-model="showTrendLine"
            class="mana-curve__toggle"
            color="primary"
            density="comfortable"
            hide-details
            label="Show line"
          />
          <v-switch
            v-model="excludeLands"
            class="mana-curve__toggle"
            color="primary"
            density="comfortable"
            hide-details
            label="Exclude lands"
          />
        </div>
      </div>
      <v-sheet
        aria-label="Mainboard mana curve"
        class="mana-curve pa-3"
        color="surface-light"
        rounded="lg"
      >
        <v-row density="comfortable">
          <v-col cols="12" md="8">
            <div class="mana-curve__plot">
              <div
                v-for="bucket in manaCurve"
                :key="bucket.value"
                class="mana-curve__column"
              >
                <span class="mana-curve__count text-caption">
                  {{ bucket.count }}
                </span>
                <v-btn
                  :aria-label="`Show mana value ${bucket.label} cards`"
                  block
                  class="mana-curve__bar"
                  :color="
                    selectedManaValue === bucket.value
                      ? 'primary'
                      : 'primary-darken-2'
                  "
                  :disabled="bucket.count === 0"
                  :height="`${bucket.height}%`"
                  min-height="0"
                  rounded="t"
                  variant="flat"
                  @click="selectedManaValue = bucket.value"
                />
                <span
                  class="text-caption"
                  :class="{
                    'font-weight-bold text-primary':
                      selectedManaValue === bucket.value,
                    'text-medium-emphasis':
                      selectedManaValue !== bucket.value,
                  }"
                >
                  {{ bucket.label }}
                </span>
              </div>
              <svg
                v-if="showTrendLine"
                aria-hidden="true"
                class="mana-curve__line"
                preserveAspectRatio="none"
                viewBox="0 0 700 100"
              >
                <path
                  :d="manaCurvePath"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="4"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
            </div>
          </v-col>
          <v-col cols="12" md="4">
            <v-card
              border
              class="mana-curve__card-list"
              variant="tonal"
            >
              <v-list
                aria-label="Cards at selected mana value"
                class="mana-curve__cards"
                density="comfortable"
              >
                <v-list-item
                  v-for="entry in selectedCards"
                  :key="entry.card.id"
                  class="mana-curve__card-item"
                  tabindex="0"
                  :title="entry.card.name"
                  @blur="deckStore.restoreSelectedPreviewCard()"
                  @focusin="deckStore.setPreviewCard(entry.card)"
                  @mouseleave="deckStore.restoreSelectedPreviewCard()"
                  @mouseenter="deckStore.setPreviewCard(entry.card)"
                >
                  <template v-if="entry.quantity > 1" #append>
                    <v-chip size="x-small" variant="outlined">
                      ×{{ entry.quantity }}
                    </v-chip>
                  </template>
                </v-list-item>
                <v-list-item
                  v-if="selectedCards.length === 0"
                  subtitle="Select a populated mana value."
                  title="No cards"
                />
              </v-list>
            </v-card>
          </v-col>
        </v-row>
      </v-sheet>
      <v-divider class="my-4" />
      <div class="d-flex flex-wrap ga-2">
        <v-chip
          v-for="type in typeCounts"
          :key="type.label"
          size="small"
          variant="outlined"
        >
          {{ type.label }} {{ type.count }}
        </v-chip>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Deck } from '../models/deck'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'
import { getCardManaValue } from '../utils/cardManaValue'

const deckStore = useDeckStore()
const props = defineProps<{
  deck?: Deck
}>()
const displayedDeck = computed(() => props.deck ?? deckStore.deck)
const excludeLands = ref(true)
const showTrendLine = ref(true)
const selectedManaValue = ref(0)
const curveCards = computed(() =>
  displayedDeck.value.cards.filter(
    (entry) => !excludeLands.value || !isLand(entry.card),
  ),
)
const mainboardCount = computed(() =>
  displayedDeck.value.cards.reduce((sum, entry) => sum + entry.quantity, 0),
)
const averageManaValue = computed(() => {
  const total = curveCards.value.reduce(
    (sum, entry) => sum + getCardManaValue(entry.card) * entry.quantity,
    0,
  )
  const includedCardCount = curveCards.value.reduce(
    (sum, entry) => sum + entry.quantity,
    0,
  )
  return includedCardCount
    ? (total / includedCardCount).toFixed(2)
    : '0.00'
})
const summaryStats = computed(() => [
  { label: 'Mainboard', value: mainboardCount.value },
  { label: 'Unique Cards', value: displayedDeck.value.cards.length },
  { label: 'Avg. Mana Value', value: averageManaValue.value },
  {
    label: 'Colors',
    value: new Set([
      ...(displayedDeck.value.commander?.color_identity ?? []),
      ...(displayedDeck.value.partnerCommander?.color_identity ?? []),
    ]).size,
  },
])
const manaCurve = computed(() => {
  const counts = Array.from({ length: 7 }, () => 0)
  for (const entry of curveCards.value) {
    counts[getManaValueBucket(entry.card)] += entry.quantity
  }
  const maximum = Math.max(...counts, 1)
  return counts.map((count, index) => ({
    value: index,
    label: index === 6 ? '6+' : String(index),
    count,
    // Keep a small amount of headroom above the tallest point so its bar and
    // trend-line stroke remain clear of the count-label row.
    height: count === 0 ? 0 : Math.max(8, (count / maximum) * 90),
  }))
})
const manaCurvePath = computed(() => {
  const points = manaCurve.value.map((bucket, index) => ({
    x: 50 + index * 100,
    y: 100 - bucket.height,
  }))
  const first = points[0]
  if (!first) return ''

  let path = `M ${first.x} ${first.y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]
    const current = points[index]
    const next = points[index + 1]
    const following = points[index + 2] ?? next
    if (!previous || !current || !next || !following) continue

    // Convert the neighboring Catmull-Rom points to cubic Bézier controls.
    // This keeps the line passing through every mana-value data point.
    const firstControlX = current.x + (next.x - previous.x) / 6
    const firstControlY = current.y + (next.y - previous.y) / 6
    const secondControlX = next.x - (following.x - current.x) / 6
    const secondControlY = next.y - (following.y - current.y) / 6
    path +=
      ` C ${firstControlX} ${firstControlY},` +
      ` ${secondControlX} ${secondControlY}, ${next.x} ${next.y}`
  }
  return path
})
const selectedCards = computed(() =>
  curveCards.value
    .filter((entry) => getManaValueBucket(entry.card) === selectedManaValue.value)
    .slice()
    .sort((left, right) => left.card.name.localeCompare(right.card.name)),
)
watch(
  manaCurve,
  (buckets) => {
    if (buckets[selectedManaValue.value]?.count) return
    selectedManaValue.value =
      buckets.find((bucket) => bucket.count > 0)?.value ?? 0
  },
  { immediate: true },
)

function getManaValueBucket(card: ScryfallCard) {
  return Math.min(Math.max(0, Math.floor(getCardManaValue(card))), 6)
}

function isLand(card: ScryfallCard) {
  const typeLine = card.card_faces?.[0]?.type_line ?? card.type_line
  return /\bLand\b/i.test(typeLine)
}
const typeCounts = computed(() => {
  const types = [
    'Planeswalker',
    'Creature',
    'Sorcery',
    'Instant',
    'Artifact',
    'Enchantment',
    'Land',
  ]
  return types
    .map((label) => ({
      label,
      count: displayedDeck.value.cards.reduce((sum, entry) => {
        const typeLine =
          entry.card.card_faces?.[0]?.type_line ?? entry.card.type_line
        return sum +
          (new RegExp(`\\b${label}\\b`, 'i').test(typeLine)
            ? entry.quantity
            : 0)
      }, 0),
    }))
    .filter((entry) => entry.count > 0)
})
</script>

<style scoped>
.deck-statistics-panel {
  display: flex;
  flex-direction: column;
  height: 530px !important;
  max-height: 530px;
  min-height: 530px;
  min-width: 0;
  overflow: hidden;
}

.statistics-content {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.mana-curve {
  flex: 0 0 240px;
  height: 240px;
}

.mana-curve :deep(.v-row),
.mana-curve :deep(.v-col) {
  height: 100%;
}

.mana-curve__plot {
  align-items: end;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(7, 1fr);
  height: 100%;
  position: relative;
}

.mana-curve__column {
  align-items: center;
  display: grid;
  grid-template-rows: 34px 1fr 20px;
  height: 100%;
  text-align: center;
}

.mana-curve__count {
  align-self: start;
}

.mana-curve__bar {
  align-self: end;
  min-width: 10px;
  width: 100%;
}

.mana-curve__line {
  color: rgb(var(--v-theme-secondary));
  height: calc(100% - 54px);
  left: 0;
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 34px;
  width: 100%;
  z-index: 1;
}

.mana-curve__toggle :deep(.v-selection-control) {
  min-height: 32px;
}

.mana-curve__card-list,
.mana-curve__cards {
  height: 100%;
}

.mana-curve__cards {
  overflow-y: auto;
}

.mana-curve__card-item :deep(.v-list-item-title) {
  overflow: visible;
  text-overflow: initial;
  white-space: normal;
}

.mana-curve__card-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.mana-curve__card-item:nth-child(even) {
  background: color-mix(
    in srgb,
    rgb(var(--v-theme-surface)) 72%,
    black
  );
}

.mana-curve__card-item:last-child {
  border-bottom: 0;
}
</style>
