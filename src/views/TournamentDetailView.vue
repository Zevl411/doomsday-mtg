<template>
  <v-container class="pa-0" fluid>
    <v-progress-linear v-if="loading" color="primary" indeterminate />
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <template v-else-if="detail">
      <div class="d-flex flex-wrap align-start justify-space-between ga-3 mb-5">
        <div>
          <h1 class="text-h4 font-weight-bold">
            {{ detail.tournament.name }}
          </h1>
          <p class="text-medium-emphasis">
            {{ detail.tournament.playerCount ?? 'Unknown' }} players ·
            {{ displayTournamentLocation(detail.tournament) }}
          </p>
          <a
            :href="sourceAttribution(detail.tournament.source).url"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ sourceAttribution(detail.tournament.source).label }}
          </a>
        </div>
        <v-btn
          v-if="detail.tournament.url"
          :href="detail.tournament.url"
          rel="noopener noreferrer"
          target="_blank"
          variant="outlined"
        >
          View original event
        </v-btn>
      </div>

      <v-expansion-panels
        v-model="expandedEntryIds"
        multiple
        variant="accordion"
        @update:model-value="loadExpandedDecklists"
      >
        <v-expansion-panel
          v-for="entry in detail.entries"
          :id="`tournament-entry-${entry.id}`"
          :key="entry.id"
          :class="getPlacementClass(entry.standing)"
          :value="entry.id"
        >
          <v-expansion-panel-title
            :readonly="!hasRegisteredCommander(entry)"
          >
            <v-row align="center" class="py-1" no-gutters>
              <v-col cols="2" sm="1">
                <v-chip color="secondary" size="small" variant="tonal">
                  {{ formatStanding(entry.standing) }}
                </v-chip>
              </v-col>
              <v-col cols="10" sm="3">
                <div class="font-weight-medium">
                  {{ entry.playerName || 'Unknown pilot' }}
                </div>
              </v-col>
              <v-col class="mt-2 mt-sm-0" cols="8" sm="5">
                <div class="d-flex flex-wrap align-center ga-2">
                  <span>{{ entry.commanderName }}</span>
                  <ColorIdentitySymbols
                    v-if="hasRegisteredCommander(entry)"
                    :colors="entry.colorIdentity"
                    size="small"
                  />
                </div>
                <v-tooltip
                  v-if="!hasRegisteredCommander(entry)"
                  text="This entry has no registered commander, so its decklist cannot be opened."
                >
                  <template #activator="{ props }">
                    <span
                      v-bind="props"
                      aria-label="Decklist unavailable: no registered commander"
                      class="ml-2 text-error"
                      role="img"
                    >
                      ⚠
                    </span>
                  </template>
                </v-tooltip>
              </v-col>
              <v-col class="text-right" cols="4" sm="3">
                {{ entry.wins }}-{{ entry.losses }}-{{ entry.draws }}
              </v-col>
            </v-row>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <div
              v-if="decklistLoading[entry.id]"
              class="d-flex align-center ga-3 py-6"
            >
              <v-progress-circular
                color="primary"
                indeterminate
                size="28"
                width="3"
              />
              <span class="text-medium-emphasis">Loading decklist…</span>
            </div>

            <v-alert
              v-else-if="decklistErrors[entry.id]"
              type="warning"
              variant="tonal"
            >
              {{ decklistErrors[entry.id] }}
              <template #append>
                <v-btn
                  v-if="entry.sourceEntryId"
                  size="small"
                  variant="text"
                  @click="loadDecklist(entry, true)"
                >
                  Retry
                </v-btn>
              </template>
            </v-alert>

            <template v-else-if="decklists[entry.id]">
              <div
                :class="[
                  'deck-overview',
                  'mb-5',
                  {
                    'deck-overview--partners':
                      (decklists[entry.id]?.commanders.length ?? 0) > 1,
                  },
                ]"
              >
                <section
                  v-if="decklists[entry.id]?.commanders.length"
                  :class="[
                    'commander-column',
                    {
                      'commander-column--partners':
                        (decklists[entry.id]?.commanders.length ?? 0) > 1,
                    },
                  ]"
                >
                  <div class="text-subtitle-1 font-weight-bold mb-2">
                    Commander
                  </div>
                  <div
                    :class="[
                      'commander-grid',
                      {
                        'commander-grid--partners':
                          (decklists[entry.id]?.commanders.length ?? 0) > 1,
                      },
                    ]"
                  >
                    <div
                      v-for="card in decklists[entry.id]?.commanders"
                      :key="card.oracleId ?? card.name"
                      :class="[
                        'tournament-card-shell',
                        {
                          'tournament-card-shell--selected':
                            isSelectedPreview(entry.id, card),
                        },
                      ]"
                      tabindex="0"
                      @click="selectPreview(entry.id, card)"
                      @focus="previewCards[entry.id] = card"
                      @blur="restorePreview(entry.id)"
                      @mouseenter="previewCards[entry.id] = card"
                      @mouseleave="restorePreview(entry.id)"
                    >
                      <TournamentCardImage :card="card" />
                    </div>
                  </div>
                </section>

                <section class="deck-statistics">
                  <div class="d-flex align-center flex-wrap ga-2 mb-3">
                    <div class="text-subtitle-1 font-weight-bold">
                      Deck Overview
                    </div>
                    <v-chip
                      v-if="admin.isAdmin && normalizedDecks[entry.id]"
                      :color="
                        normalizedDecks[entry.id]?.parsingStatus === 'complete'
                          ? 'success'
                          : 'warning'
                      "
                      size="x-small"
                      variant="tonal"
                    >
                      {{ normalizedDecks[entry.id]?.parsingStatus }} deck data
                    </v-chip>
                  </div>
                  <div class="summary-grid">
                    <v-sheet
                      v-for="stat in getDeckSummary(entry.id)"
                      :key="stat.label"
                      class="pa-3 text-center"
                      color="surface-light"
                      rounded="lg"
                    >
                      <div class="text-h6 font-weight-bold">
                        {{ stat.value }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        {{ stat.label }}
                      </div>
                    </v-sheet>
                  </div>
                  <div class="text-subtitle-2 mt-4 mb-2">
                    Mainboard mana curve
                  </div>
                  <div class="mana-curve">
                    <div
                      v-for="bucket in getManaCurve(entry.id)"
                      :key="bucket.label"
                      class="mana-curve__column"
                    >
                      <span class="text-caption">{{ bucket.count }}</span>
                      <div class="mana-curve__track">
                        <div
                          class="mana-curve__bar"
                          :style="{ height: `${bucket.height}%` }"
                        />
                      </div>
                      <span class="text-caption text-medium-emphasis">
                        {{ bucket.label }}
                      </span>
                    </div>
                    <svg
                      aria-hidden="true"
                      class="mana-curve__line"
                      preserveAspectRatio="none"
                      viewBox="0 0 700 100"
                    >
                      <path
                        :d="getManaCurvePath(entry.id)"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="4"
                        vector-effect="non-scaling-stroke"
                      />
                    </svg>
                  </div>
                  <div class="d-flex flex-wrap ga-2 mt-4">
                    <v-chip
                      v-for="type in getTypeCounts(entry.id)"
                      :key="type.label"
                      size="x-small"
                      variant="outlined"
                    >
                      {{ type.label }} {{ type.count }}
                    </v-chip>
                  </div>
                </section>

                <section class="preview-column">
                  <div class="text-subtitle-1 font-weight-bold mb-2">
                    Card Preview
                  </div>
                  <TournamentCardImage
                    v-if="previewCards[entry.id]"
                    :card="previewCards[entry.id]!"
                  />
                  <div class="text-body-2 text-center mt-2">
                    {{ previewCards[entry.id]?.name }}
                  </div>
                </section>
              </div>

              <v-alert
                v-if="
                  admin.isAdmin &&
                  normalizedDecks[entry.id]?.parsingIssues.length
                "
                class="mb-4"
                type="warning"
                variant="tonal"
              >
                {{
                  normalizedDecks[entry.id]?.parsingIssues
                    .map((issue) => issue.message)
                    .join(' ')
                }}
              </v-alert>

              <section>
                <div class="board-header d-flex flex-wrap align-center ga-3 mb-3">
                  <h2 class="text-h6">Mainboard</h2>
                  <v-chip size="small" variant="tonal">
                    {{ getDeckCardCount(entry.id) }} cards
                  </v-chip>
                  <v-spacer />
                  <TournamentDecklistExport
                    :cards="decklists[entry.id]?.cards ?? []"
                    compact
                    :commanders="decklists[entry.id]?.commanders ?? []"
                  />
                  <v-btn
                    :aria-label="`Duplicate ${entry.commanderName} Deck`"
                    class="decklist-toolbar-button"
                    density="compact"
                    :disabled="!normalizedDecks[entry.id]"
                    variant="outlined"
                    @click="copyDeck(entry)"
                  >
                    <DeckActionIcon compact name="duplicate" />
                    Duplicate
                  </v-btn>
                  <v-select
                    v-model="decklistGrouping"
                    aria-label="Group tournament decklist"
                    class="decklist-toolbar-select"
                    density="compact"
                    hide-details
                    :items="groupingOptions"
                    label="Group by"
                    style="max-width: 180px"
                    variant="outlined"
                  />
                  <v-select
                    v-model="decklistOrder"
                    aria-label="Order tournament decklist"
                    class="decklist-toolbar-select"
                    density="compact"
                    hide-details
                    :items="orderOptions"
                    label="Order by"
                    style="max-width: 180px"
                    variant="outlined"
                  />
                  <v-btn-toggle
                    v-model="decklistView"
                    class="decklist-view-toggle"
                    density="compact"
                    mandatory
                    variant="outlined"
                  >
                    <v-btn
                      aria-label="Grid view"
                      density="compact"
                      value="grid"
                    >
                      <svg
                        aria-hidden="true"
                        class="view-toggle-icon"
                        viewBox="0 0 24 24"
                      >
                        <path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />
                      </svg>
                    </v-btn>
                    <v-btn
                      aria-label="List view"
                      density="compact"
                      value="list"
                    >
                      <svg
                        aria-hidden="true"
                        class="view-toggle-icon"
                        viewBox="0 0 24 24"
                      >
                        <path d="M4 5h3v3H4V5Zm5 0h11v3H9V5ZM4 10.5h3v3H4v-3Zm5 0h11v3H9v-3ZM4 16h3v3H4v-3Zm5 0h11v3H9v-3Z" />
                      </svg>
                    </v-btn>
                  </v-btn-toggle>
                </div>
                <div
                  v-for="group in groupedDeckCards(entry.id)"
                  :key="group.label"
                  class="deck-card-group"
                >
                  <h3 class="text-subtitle-2 text-medium-emphasis mb-2">
                    {{ group.label }} ({{ group.count }})
                  </h3>
                  <div v-if="decklistView === 'grid'" class="card-grid">
                    <div
                      v-for="card in group.cards"
                      :key="card.oracleId ?? card.name"
                      :class="[
                        'tournament-card-shell',
                        {
                          'tournament-card-shell--selected':
                            isSelectedPreview(entry.id, card),
                        },
                      ]"
                      tabindex="0"
                      @blur="restorePreview(entry.id)"
                      @click="selectPreview(entry.id, card)"
                      @focus="previewCards[entry.id] = card"
                      @mouseenter="previewCards[entry.id] = card"
                      @mouseleave="restorePreview(entry.id)"
                    >
                      <TournamentCardImage :card="card" />
                    </div>
                  </div>
                  <div v-else class="deck-card-list">
                    <v-list
                      v-for="(column, columnIndex) in listColumns(group.cards)"
                      :key="columnIndex"
                      :class="[
                        'deck-card-list-column',
                        {
                          'deck-card-list-column--inverted':
                            columnIndex === 1,
                        },
                      ]"
                      density="compact"
                    >
                      <v-list-item
                        v-for="card in column"
                        :key="card.oracleId ?? card.name"
                        border
                        :class="{
                          'tournament-list-item--selected':
                            isSelectedPreview(entry.id, card),
                        }"
                        rounded="lg"
                        @click="selectPreview(entry.id, card)"
                        @focusin="previewCards[entry.id] = card"
                        @focusout="restorePreview(entry.id)"
                        @mouseenter="previewCards[entry.id] = card"
                        @mouseleave="restorePreview(entry.id)"
                      >
                        <v-list-item-title class="tournament-list-row">
                          <span>{{ card.quantity }}× {{ card.name }}</span>
                          <ManaCost
                            v-if="card.manaCost"
                            :cost="card.manaCost"
                          />
                          <span class="text-body-2 text-medium-emphasis">
                            {{ card.typeLine }}
                          </span>
                        </v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </div>
                </div>
              </section>
            </template>

            <v-alert v-else type="info" variant="tonal">
              No submitted decklist is available for this placing.
            </v-alert>

            <v-btn
              v-if="entry.decklistUrl"
              class="mt-4"
              :href="entry.decklistUrl"
              rel="noopener noreferrer"
              target="_blank"
              variant="text"
            >
              Open source decklist
            </v-btn>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import DeckActionIcon from '../components/DeckActionIcon.vue'
import ManaCost from '../components/ManaCost.vue'
import TournamentCardImage from '../components/TournamentCardImage.vue'
import TournamentDecklistExport from '../components/TournamentDecklistExport.vue'
import {
  tournamentRepository,
  type TournamentDetail,
} from '../repositories/tournamentRepository'
import type {
  TournamentEntry,
  TournamentEntryDecklist,
  NormalizedTournamentDeck,
  TournamentDeckCard,
} from '../models/tournament'
import { createEmptyDeck } from '../models/createDeck'
import { getCardsByExactNames } from '../api/scryfall'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'
import type {
  DeckGrouping,
  DeckSecondaryGrouping,
} from '../models/userPreferences'
import {
  displayTournamentLocation,
  sourceAttribution,
} from '../utils/tournamentLocation'
import {
  createTournamentCardLookup,
  toCopiedDeckCard,
} from '../utils/tournamentDeckCopy'

const route = useRoute()
const router = useRouter()
const admin = useAdminStore()
const deckStore = useDeckStore()
const detail = ref<TournamentDetail | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const expandedEntryIds = ref<string[]>([])
const decklists = ref<Record<string, TournamentEntryDecklist>>({})
const decklistLoading = ref<Record<string, boolean>>({})
const decklistErrors = ref<Record<string, string>>({})
const normalizedDecks = ref<Record<string, NormalizedTournamentDeck>>({})
const previewCards = ref<Record<string, TournamentDeckCard | undefined>>({})
const selectedPreviewCards =
  ref<Record<string, TournamentDeckCard | undefined>>({})
const decklistGrouping = ref<DeckGrouping>('type')
const decklistOrder = ref<DeckSecondaryGrouping>('name')
const decklistView = ref<'grid' | 'list'>('grid')
const groupingOptions = [
  { title: 'Name', value: 'name' },
  { title: 'Mana cost', value: 'mana' },
  { title: 'Card type', value: 'type' },
  { title: 'Color', value: 'color' },
]
const orderOptions = [
  { title: 'None', value: 'none' },
  ...groupingOptions,
]
const typeGroupOrder = [
  'Planeswalker', 'Creature', 'Sorcery', 'Instant',
  'Artifact', 'Enchantment', 'Land',
]

function getDeckCardCount(entryId: string): number {
  return decklists.value[entryId]?.cards.reduce(
    (total, card) => total + card.quantity,
    0,
  ) ?? 0
}

function groupedDeckCards(entryId: string) {
  const groups = new Map<string, TournamentDeckCard[]>()
  for (const card of decklists.value[entryId]?.cards ?? []) {
    const label = cardSortValue(card, decklistGrouping.value, true)
    groups.set(label, [...(groups.get(label) ?? []), card])
  }
  return [...groups.entries()]
    .sort(([left], [right]) =>
      compareGroupLabels(left, right, decklistGrouping.value),
    )
    .map(([label, cards]) => ({
      label,
      count: cards.reduce((total, card) => total + card.quantity, 0),
      cards: decklistOrder.value === 'none'
        ? cards
        : cards.sort((left, right) =>
          cardSortValue(left, decklistOrder.value as DeckGrouping)
            .localeCompare(
              cardSortValue(right, decklistOrder.value as DeckGrouping),
              undefined,
              { numeric: true },
            )
          || left.name.localeCompare(right.name)),
    }))
}

function cardSortValue(
  card: TournamentDeckCard,
  key: DeckGrouping,
  group = false,
) {
  if (key === 'name') {
    return group ? card.name.charAt(0).toUpperCase() : card.name
  }
  if (key === 'mana') {
    return `${card.manaValue ?? 0}`.padStart(3, '0')
  }
  if (key === 'color') {
    return card.colorIdentity?.slice().sort().join('') || 'Colorless'
  }
  const type = getCardTypeGroup(card.typeLine)
  return group
    ? type
    : `${typeOrder(type).toString().padStart(2, '0')}-${type}`
}

function listColumns(cards: TournamentDeckCard[]) {
  const secondColumnStart = Math.ceil(cards.length / 2)
  return [
    cards.slice(0, secondColumnStart),
    cards.slice(secondColumnStart),
  ]
}

function getCardTypeGroup(typeLine: string) {
  const frontFaceTypeLine = typeLine.split('//')[0] ?? typeLine
  const cardTypes = frontFaceTypeLine.split('—')[0] ?? frontFaceTypeLine
  if (/\bLand\b/i.test(cardTypes)) return 'Land'
  if (/\bCreature\b/i.test(cardTypes)) return 'Creature'
  if (/\bPlaneswalker\b/i.test(cardTypes)) return 'Planeswalker'
  if (/\bSorcery\b/i.test(cardTypes)) return 'Sorcery'
  if (/\bInstant\b/i.test(cardTypes)) return 'Instant'
  if (/\bArtifact\b/i.test(cardTypes)) return 'Artifact'
  if (/\bEnchantment\b/i.test(cardTypes)) return 'Enchantment'
  return 'Other'
}

function typeOrder(type: string) {
  const index = typeGroupOrder.indexOf(type)
  return index === -1 ? typeGroupOrder.length : index
}

function compareGroupLabels(
  left: string,
  right: string,
  key: DeckGrouping,
) {
  if (key === 'type') return typeOrder(left) - typeOrder(right)
  return left.localeCompare(right, undefined, { numeric: true })
}

function getDeckSummary(entryId: string) {
  const cards = decklists.value[entryId]?.cards ?? []
  const nonlands = cards.filter((card) => !isCardType(card, 'Land'))
  const nonlandCount = nonlands.reduce(
    (total, card) => total + card.quantity,
    0,
  )
  const totalManaValue = nonlands.reduce(
    (total, card) => total + (card.manaValue ?? 0) * card.quantity,
    0,
  )
  return [
    { label: 'Mainboard', value: getDeckCardCount(entryId) },
    {
      label: 'Avg. mana value',
      value: nonlandCount
        ? (totalManaValue / nonlandCount).toFixed(2)
        : '0.00',
    },
    {
      label: 'Lands',
      value: cards
        .filter((card) => isCardType(card, 'Land'))
        .reduce((total, card) => total + card.quantity, 0),
    },
  ]
}

function getManaCurve(entryId: string) {
  const counts = Array.from({ length: 7 }, () => 0)
  for (const card of decklists.value[entryId]?.cards ?? []) {
    if (isCardType(card, 'Land')) continue
    const bucket = Math.min(6, Math.max(0, Math.floor(card.manaValue ?? 0)))
    counts[bucket] += card.quantity
  }
  const maximum = Math.max(...counts, 1)
  return counts.map((count, index) => ({
    label: index === 6 ? '6+' : String(index),
    count,
    height: count === 0 ? 0 : Math.max(6, (count / maximum) * 100),
  }))
}

function getManaCurvePath(entryId: string) {
  const points = getManaCurve(entryId).map((bucket, index) => ({
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

    const firstControlX = current.x + (next.x - previous.x) / 6
    const firstControlY = current.y + (next.y - previous.y) / 6
    const secondControlX = next.x - (following.x - current.x) / 6
    const secondControlY = next.y - (following.y - current.y) / 6
    path +=
      ` C ${firstControlX} ${firstControlY},` +
      ` ${secondControlX} ${secondControlY}, ${next.x} ${next.y}`
  }
  return path
}

function getTypeCounts(entryId: string) {
  const labels = [
    'Planeswalker', 'Creature', 'Sorcery', 'Instant',
    'Artifact', 'Enchantment', 'Land',
  ]
  const cards = decklists.value[entryId]?.cards ?? []
  return labels.map((label) => ({
    label,
    count: cards
      .filter((card) => isCardType(card, label))
      .reduce((total, card) => total + card.quantity, 0),
  })).filter((item) => item.count > 0)
}

function isCardType(card: TournamentDeckCard, type: string) {
  const frontFaceTypeLine = card.typeLine.split('//')[0] ?? card.typeLine
  return new RegExp(`\\b${type}\\b`, 'i').test(frontFaceTypeLine)
}

function restorePreview(entryId: string) {
  previewCards.value[entryId] =
    selectedPreviewCards.value[entryId] ??
    decklists.value[entryId]?.commanders[0] ??
    decklists.value[entryId]?.cards[0]
}

async function copyDeck(entry: TournamentEntry) {
  const normalized = normalizedDecks.value[entry.id]
  if (!normalized) return

  let resolvedCards: ScryfallCard[] = []
  try {
    resolvedCards = await getCardsByExactNames(
      normalized.cards.map((card) => card.cardName),
    )
  } catch (error) {
    console.warn('Unable to hydrate copied tournament card images.', error)
  }
  const lookup = createTournamentCardLookup(resolvedCards)
  const copy = createEmptyDeck(
    `${normalized.commanderName} — ${normalized.tournament.name}`,
  )
  const copyBoard = (board: NormalizedTournamentDeck['cards'][number]['board']) =>
    normalized.cards
      .filter((card) => card.board === board)
      .map((card) => toCopiedDeckCard(card, lookup))
  const commanders = copyBoard('commander')
  copy.commander = commanders[0]?.card ?? null
  copy.partnerCommander = commanders[1]?.card ?? null
  copy.cards = copyBoard('mainboard')
  copy.sideboard = copyBoard('sideboard')
  copy.maybeboard = copyBoard('maybeboard')
  copy.considering = copyBoard('considering')

  deckStore.createDeck(copy.name, 'Tournament import')
  deckStore.replaceActiveDeck(copy)
  if (deckStore.activeDeckId) {
    await router.push({
      name: 'deck-builder',
      params: { deckId: deckStore.activeDeckId },
    })
  }
}

function selectPreview(entryId: string, card: TournamentDeckCard) {
  const selected = selectedPreviewCards.value[entryId]
  selectedPreviewCards.value[entryId] =
    cardIdentity(selected) === cardIdentity(card) ? undefined : card
  restorePreview(entryId)
}

function isSelectedPreview(entryId: string, card: TournamentDeckCard) {
  return cardIdentity(selectedPreviewCards.value[entryId]) ===
    cardIdentity(card)
}

function cardIdentity(card?: TournamentDeckCard) {
  return card?.oracleId ?? card?.name.toLocaleLowerCase()
}

onMounted(async () => {
  try {
    detail.value = await tournamentRepository.getTournament(
      String(route.params.tournamentId),
    )
    if (!detail.value) {
      errorMessage.value = 'Tournament not found.'
      return
    }
    loading.value = false
    await nextTick()
    await openLinkedDeck()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load tournament.'
  } finally {
    loading.value = false
  }
})

async function openLinkedDeck() {
  const entryId = typeof route.query.entryId === 'string'
    ? route.query.entryId
    : ''
  if (!entryId || !detail.value) return

  const entry = detail.value.entries.find((item) => item.id === entryId)
  if (!entry || !hasRegisteredCommander(entry)) return

  expandedEntryIds.value = [entry.id]
  void loadDecklist(entry)
  await nextTick()
  document
    .getElementById(`tournament-entry-${entry.id}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function loadExpandedDecklists(value: unknown) {
  if (!Array.isArray(value) || !detail.value) return
  for (const entryId of value) {
    const entry = detail.value.entries.find((item) => item.id === entryId)
    if (entry && hasRegisteredCommander(entry)) void loadDecklist(entry)
  }
}

async function loadDecklist(entry: TournamentEntry, retry = false) {
  if (
    decklistLoading.value[entry.id] ||
    (!retry && (decklists.value[entry.id] || decklistErrors.value[entry.id]))
  ) {
    return
  }
  if (!entry.sourceEntryId) {
    decklistErrors.value[entry.id] =
      'No submitted decklist is available for this placing.'
    return
  }

  decklistLoading.value[entry.id] = true
  delete decklistErrors.value[entry.id]
  try {
    const [decklist, normalized] = await Promise.all([
      tournamentRepository.getEntryDecklist(entry),
      entry.tournamentDeckId
        ? tournamentRepository.getNormalizedTournamentDeck(
            entry.tournamentDeckId,
          )
        : Promise.resolve(null),
    ])
    decklists.value[entry.id] = decklist
    if (normalized) normalizedDecks.value[entry.id] = normalized
    restorePreview(entry.id)
  } catch (error) {
    decklistErrors.value[entry.id] =
      error instanceof Error
        ? error.message
        : 'Unable to load this tournament decklist.'
  } finally {
    decklistLoading.value[entry.id] = false
  }
}

function formatStanding(standing?: number): string {
  return standing ? `#${standing}` : '—'
}

function hasRegisteredCommander(entry: TournamentEntry): boolean {
  const name = entry.commanderName.trim().toLowerCase()
  const key = entry.commanderKey.trim().toLowerCase()
  return (
    name !== '' &&
    name !== 'unknown commander' &&
    key !== '' &&
    key !== 'unknown-commander'
  )
}

function getPlacementClass(standing?: number): string {
  if (standing === 1) return 'placement-panel placement-panel--gold'
  if (standing === 2) return 'placement-panel placement-panel--silver'
  if (standing === 3 || standing === 4) {
    return 'placement-panel placement-panel--bronze'
  }
  if (standing !== undefined && standing >= 5 && standing <= 16) {
    return 'placement-panel placement-panel--top-cut'
  }
  return ''
}
</script>

<style scoped>
.placement-panel {
  border-style: solid;
  border-width: 2px;
  scroll-margin-top: 16px;
}

.view-toggle-icon {
  fill: currentColor;
  height: 22px;
  width: 22px;
}

.decklist-toolbar-button,
.decklist-view-toggle,
.decklist-view-toggle :deep(.v-btn) {
  height: 40px;
  min-height: 40px;
}

.decklist-toolbar-select {
  flex: 0 1 180px;
}

.decklist-toolbar-select :deep(.v-field) {
  height: 40px;
  min-height: 40px;
}

.decklist-toolbar-select :deep(.v-field__input) {
  min-height: 40px;
  padding-bottom: 0;
  padding-top: 0;
}

.placement-panel--gold {
  border-color: rgb(var(--v-theme-placement-gold));
}

.placement-panel--silver {
  border-color: rgb(var(--v-theme-placement-silver));
}

.placement-panel--bronze {
  border-color: rgb(var(--v-theme-placement-bronze));
}

.placement-panel--top-cut {
  border-color: rgb(var(--v-theme-placement-top-cut));
}

.card-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.deck-overview {
  align-items: stretch;
  display: grid;
  gap: 20px;
  grid-template-columns:
    minmax(150px, 0.85fr)
    minmax(360px, 1.55fr)
    minmax(150px, 0.85fr);
}

.deck-overview--partners {
  grid-template-columns:
    minmax(300px, 1.25fr)
    minmax(340px, 1.35fr)
    minmax(150px, 0.75fr);
}

.commander-column,
.preview-column {
  max-width: 220px;
  width: 100%;
}

.commander-column--partners {
  max-width: 460px;
}

.commander-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

.commander-grid--partners {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.deck-statistics {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.summary-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, 1fr);
}

.mana-curve {
  align-items: end;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(7, 1fr);
  flex: 1;
  min-height: 145px;
  position: relative;
}

.mana-curve__column {
  align-items: center;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.mana-curve__track {
  align-items: end;
  display: flex;
  flex: 1;
  width: 72%;
}

.mana-curve__bar {
  background: rgb(var(--v-theme-primary));
  border-radius: 5px 5px 0 0;
  width: 100%;
}

.mana-curve__line {
  bottom: 20px;
  color: rgb(var(--v-theme-secondary));
  height: calc(100% - 38px);
  left: 0;
  overflow: visible;
  pointer-events: none;
  position: absolute;
  width: 100%;
  z-index: 2;
}

.preview-column {
  align-self: start;
  position: sticky;
  top: 16px;
}

.tournament-card-shell {
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  outline: 0;
  overflow: hidden;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.tournament-card-shell:hover,
.tournament-card-shell:focus-visible {
  border-color: rgba(var(--v-theme-primary), 0.7);
  box-shadow: 0 0 12px rgba(var(--v-theme-primary), 0.25);
}

.tournament-card-shell--selected,
.tournament-list-item--selected {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.25);
}

.tournament-card-shell :deep(.v-card) {
  border: 0;
  border-radius: 7px !important;
}

.card-grid :deep(.v-card) {
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.card-grid :deep(.v-card:hover) {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 12px rgba(var(--v-theme-primary), 0.25);
}

.deck-card-list {
  align-items: start;
  display: grid;
  gap: 2px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.deck-card-list-column {
  align-content: start;
  align-self: start;
  background: transparent;
  display: grid;
  gap: 1px;
  grid-auto-rows: 42px;
  height: auto;
}

.deck-card-list-column :deep(.v-list-item) {
  height: 42px;
  min-height: 42px;
}

.deck-card-list-column :deep(.v-list-item:nth-child(odd)) {
  background: rgb(var(--v-theme-surface-light));
}

.deck-card-list-column :deep(.v-list-item:nth-child(even)) {
  background: rgba(var(--v-theme-on-surface), 0.035);
}

.deck-card-list-column--inverted :deep(.v-list-item:nth-child(odd)) {
  background: rgba(var(--v-theme-on-surface), 0.035);
}

.deck-card-list-column--inverted :deep(.v-list-item:nth-child(even)) {
  background: rgb(var(--v-theme-surface-light));
}

.tournament-list-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  white-space: normal;
}

.deck-card-group + .deck-card-group {
  margin-top: 20px;
}

@media (max-width: 960px) {
  .deck-overview {
    grid-template-columns: minmax(150px, 0.9fr) minmax(360px, 1.5fr);
  }

  .deck-overview--partners {
    grid-template-columns: minmax(280px, 1.2fr) minmax(340px, 1.3fr);
  }

  .preview-column {
    display: none;
  }
}

@media (max-width: 680px) {
  .deck-overview,
  .summary-grid,
  .deck-card-list {
    grid-template-columns: 1fr;
  }

  .board-header {
    align-items: stretch !important;
    flex-direction: column;
  }

}
</style>
