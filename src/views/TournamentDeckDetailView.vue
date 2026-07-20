<template>
  <v-container class="tournament-deck-view pa-0" fluid>
    <AppLoadingSkeleton
      v-if="loading"
      label="Loading tournament Deck"
      variant="detail"
    />
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>
    <template v-else-if="deck">
      <v-card border class="deck-hero mb-4" rounded="lg" variant="flat">
        <div class="deck-hero__content">
          <div>
            <div class="d-flex align-center flex-wrap ga-3">
              <h1 class="text-h4 font-weight-bold">
                {{ deck.commanderName }}
              </h1>
              <ColorIdentitySymbols
                :colors="deck.entry.colorIdentity"
                size="small"
              />
              <v-chip
                :color="deck.parsingStatus === 'complete' ? 'success' : 'warning'"
                size="small"
                variant="tonal"
              >
                {{ deck.parsingStatus }}
              </v-chip>
            </div>
            <p class="text-body-1 mt-1">
              {{ deck.entry.playerName || 'Unknown pilot' }}
              · Place {{ deck.entry.standing ?? '—' }}
              · {{ recordLabel }}
            </p>
            <p class="text-medium-emphasis">
              {{ deck.tournament.name }} ·
              {{ formattedEventDate }} ·
              {{ displayTournamentLocation(deck.tournament) }}
            </p>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              v-if="deck.entry.decklistUrl"
              :href="deck.entry.decklistUrl"
              rel="noopener noreferrer"
              target="_blank"
              variant="outlined"
            >
              Original decklist
            </v-btn>
            <TournamentDecklistExport
              :cards="exportCardsForBoard('mainboard')"
              :commanders="exportCardsForBoard('commander')"
            />
            <v-btn color="primary" @click="copyToMyDecks">
              Copy to My Decks
            </v-btn>
          </div>
        </div>
      </v-card>

      <v-alert v-if="copyMessage" class="mb-4" type="success" variant="tonal">
        {{ copyMessage }}
      </v-alert>
      <v-alert
        v-if="admin.isAdmin && deck.parsingIssues.length"
        class="mb-4"
        type="warning"
        variant="tonal"
      >
        <div class="font-weight-bold mb-1">Deck data notes</div>
        <ul class="pl-5">
          <li v-for="issue in deck.parsingIssues" :key="issue.code">
            {{ issue.message }}
          </li>
        </ul>
      </v-alert>

      <div class="deck-overview mb-4">
        <v-card
          border
          class="commander-showcase"
          rounded="lg"
          variant="flat"
        >
          <v-card-title class="widget-header-bar">Commander</v-card-title>
          <v-card-text class="commander-showcase__cards">
            <TournamentCardImage
              v-for="card in commanderCards"
              :key="card.oracleId ?? card.name"
              :card="card"
              @mouseenter="previewCard = card"
              @mouseleave="restorePreview"
            />
          </v-card-text>
        </v-card>

        <v-card border rounded="lg" variant="flat">
          <v-card-title class="widget-header-bar">Deck Overview</v-card-title>
          <v-card-text class="pa-4">
            <div class="summary-grid">
              <v-sheet
                v-for="stat in summaryStats"
                :key="stat.label"
                class="pa-3 text-center"
                color="surface-light"
                rounded="lg"
              >
                <div class="text-h6 font-weight-bold">{{ stat.value }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ stat.label }}
                </div>
              </v-sheet>
            </div>
            <v-divider class="my-4" />
            <div class="text-subtitle-2 mb-2">Mainboard mana curve</div>
            <div class="mana-curve">
              <div
                v-for="bucket in manaCurve"
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
            </div>
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

        <v-card
          border
          class="card-preview"
          rounded="lg"
          variant="flat"
        >
          <v-card-title class="widget-header-bar">Card Preview</v-card-title>
          <v-card-text class="pa-4">
            <TournamentCardImage
              v-if="previewCard"
              :card="previewCard"
            />
            <div class="font-weight-bold text-center mt-3">
              {{ previewCard?.name }}
            </div>
          </v-card-text>
        </v-card>
      </div>

      <v-card v-if="comparison" border class="mb-4" rounded="lg" variant="flat">
        <v-card-title class="widget-header-bar">
          Commander Metagame Context
        </v-card-title>
        <v-card-text class="d-flex flex-wrap align-center ga-3 pa-4">
          <v-chip color="primary" variant="tonal">
            {{ comparison.sharedCardCount }} commonly played cards
          </v-chip>
          <v-chip variant="tonal">
            {{ percent(comparison.similarity) }} aggregate overlap
          </v-chip>
          <v-chip color="warning" variant="tonal">
            {{ comparison.missingCoreCards.length }} absent core cards
          </v-chip>
          <v-chip variant="tonal">
            {{ comparison.rareCards.length }} uncommon inclusions
          </v-chip>
          <span class="text-caption text-medium-emphasis">
            Descriptive tournament frequency only; this is not performance advice.
          </span>
        </v-card-text>
      </v-card>

      <v-card
        v-for="board in nonCommanderBoards"
        :key="board"
        border
        class="board-panel mb-4"
        rounded="lg"
        variant="flat"
      >
        <v-card-title class="board-header widget-header-bar">
          <span class="text-capitalize">
            {{ board }} ({{ boardQuantity(board) }})
          </span>
          <div class="d-flex align-center ga-2">
            <v-select
              v-model="decklistSort"
              aria-label="Sort tournament decklist"
              density="compact"
              hide-details
              :items="decklistSortOptions"
              label="Order by"
              variant="outlined"
              width="175"
            />
            <v-btn-toggle
              v-model="viewMode"
              color="primary"
              density="compact"
              mandatory
              variant="tonal"
            >
              <v-btn aria-label="Grid view" value="grid">Grid</v-btn>
              <v-btn aria-label="List view" value="list">List</v-btn>
            </v-btn-toggle>
          </div>
        </v-card-title>

        <v-card-text class="pa-4">
          <div v-if="viewMode === 'grid'" class="card-grid">
            <TournamentCardImage
              v-for="card in displayCardsForBoard(board)"
              :key="card.oracleId ?? card.name"
              :card="card"
              @mouseenter="previewCard = card"
              @mouseleave="restorePreview"
            />
          </div>
          <v-list v-else class="card-list" density="compact">
            <v-list-item
              v-for="card in displayCardsForBoard(board)"
              :key="card.oracleId ?? card.name"
              :subtitle="card.typeLine"
              :title="`${card.quantity}× ${card.name}`"
              @focusin="previewCard = card"
              @focusout="restorePreview"
              @mouseenter="previewCard = card"
              @mouseleave="restorePreview"
            />
          </v-list>
        </v-card-text>
      </v-card>

      <p class="text-caption">
        Tournament decklist provided by
        <a
          :href="sourceAttribution(deck.source).url"
          rel="noopener noreferrer"
          target="_blank"
        >
          {{ deck.source === 'topdeck' ? 'TopDeck.gg' : 'EDHTop16' }}
        </a>.
        Imported {{ formattedImportDate }}.
      </p>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import TournamentCardImage from '../components/TournamentCardImage.vue'
import TournamentDecklistExport from '../components/TournamentDecklistExport.vue'
import type {
  CommanderCardInclusion,
  NormalizedTournamentDeck,
  NormalizedTournamentDeckCard,
  TournamentDeckBoard,
  TournamentDeckCard,
} from '../models/tournament'
import { createEmptyDeck } from '../models/createDeck'
import { getCardsByExactNames } from '../api/scryfall'
import { tournamentRepository } from '../repositories/tournamentRepository'
import { useDeckStore } from '../stores/deck'
import { useAdminStore } from '../stores/admin'
import type { ScryfallCard } from '../types/card'
import { compareDeckToAggregate } from '../utils/cardInclusion'
import {
  displayTournamentLocation,
  sourceAttribution,
} from '../utils/tournamentLocation'
import {
  getSortableCardType,
  type TournamentDeckSort,
} from '../utils/tournamentDeckCards'
import {
  createTournamentCardLookup,
  toCopiedDeckCard,
} from '../utils/tournamentDeckCopy'

const route = useRoute()
const router = useRouter()
const deckStore = useDeckStore()
const admin = useAdminStore()
const deck = ref<NormalizedTournamentDeck | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const copyMessage = ref('')
const aggregate = ref<CommanderCardInclusion[]>([])
const resolvedCards = ref<ScryfallCard[]>([])
const previewCard = ref<TournamentDeckCard | null>(null)
const decklistSort = ref<TournamentDeckSort>('card-type')
const viewMode = ref<'grid' | 'list'>('grid')
const decklistSortOptions = [
  { title: 'Alphabetical', value: 'name' },
  { title: 'Mana value', value: 'mana-value' },
  { title: 'Card type', value: 'card-type' },
]
const boardOrder: TournamentDeckBoard[] = [
  'commander', 'mainboard', 'sideboard', 'maybeboard',
  'considering', 'companion', 'unknown',
]
const populatedBoards = computed(() => boardOrder.filter((board) =>
  deck.value?.cards.some((card) => card.board === board),
))
const nonCommanderBoards = computed(() =>
  populatedBoards.value.filter((board) => board !== 'commander'),
)
const comparison = computed(() =>
  deck.value ? compareDeckToAggregate(deck.value.cards, aggregate.value) : null,
)
const displayCardLookup = computed(() => {
  const lookup = new Map<string, ScryfallCard>()
  for (const card of resolvedCards.value) {
    if (card.oracle_id) lookup.set(`oracle:${card.oracle_id}`, card)
    lookup.set(`name:${card.name.toLowerCase()}`, card)
  }
  return lookup
})
const commanderCards = computed(() =>
  displayCardsForBoard('commander'),
)
const mainboardCards = computed(() =>
  deck.value?.cards.filter((card) => card.board === 'mainboard') ?? [],
)
const summaryStats = computed(() => [
  { label: 'Mainboard', value: boardQuantity('mainboard') },
  { label: 'Unique cards', value: mainboardCards.value.length },
  { label: 'Avg. mana value', value: averageManaValue.value },
  { label: 'Event size', value: deck.value?.tournament.playerCount ?? '—' },
])
const averageManaValue = computed(() => {
  const cards = mainboardCards.value.filter(
    (card) => !/\bLand\b/i.test(card.typeLine ?? ''),
  )
  const quantity = cards.reduce((sum, card) => sum + card.quantity, 0)
  const total = cards.reduce(
    (sum, card) => sum + (card.manaValue ?? 0) * card.quantity,
    0,
  )
  return quantity ? (total / quantity).toFixed(2) : '0.00'
})
const manaCurve = computed(() => {
  const counts = Array.from({ length: 7 }, () => 0)
  for (const card of mainboardCards.value) {
    if (/\bLand\b/i.test(card.typeLine ?? '')) continue
    const bucket = Math.min(6, Math.max(0, Math.floor(card.manaValue ?? 0)))
    counts[bucket] += card.quantity
  }
  const maximum = Math.max(...counts, 1)
  return counts.map((count, index) => ({
    label: index === 6 ? '6+' : String(index),
    count,
    height: count === 0 ? 0 : Math.max(6, (count / maximum) * 100),
  }))
})
const typeCounts = computed(() => {
  const labels = [
    'Planeswalker', 'Creature', 'Sorcery', 'Instant',
    'Artifact', 'Enchantment', 'Land',
  ]
  return labels.map((label) => ({
    label,
    count: mainboardCards.value.reduce(
      (sum, card) =>
        sum + (new RegExp(`\\b${label}\\b`, 'i').test(card.typeLine ?? '')
          ? card.quantity
          : 0),
      0,
    ),
  })).filter((item) => item.count > 0)
})
const recordLabel = computed(() => {
  if (!deck.value) return 'No match record'
  return `${deck.value.entry.wins}-${deck.value.entry.losses}-${deck.value.entry.draws}`
})
const formattedEventDate = computed(() =>
  formatDate(deck.value?.tournament.date),
)
const formattedImportDate = computed(() =>
  formatDate(deck.value?.importedAt),
)

onMounted(async () => {
  try {
    deck.value = await tournamentRepository.getNormalizedTournamentDeck(
      String(route.params.deckId),
    )
    if (!deck.value) {
      errorMessage.value = 'Tournament Deck not found.'
      return
    }
    const [aggregateResult, cardsResult] = await Promise.allSettled([
      tournamentRepository.getCommanderCardInclusion(deck.value.commanderKey),
      getCardsByExactNames(deck.value.cards.map((card) => card.cardName)),
    ])
    if (aggregateResult.status === 'fulfilled') {
      aggregate.value = aggregateResult.value
    }
    if (cardsResult.status === 'fulfilled') {
      resolvedCards.value = cardsResult.value
    }
    previewCard.value = commanderCards.value[0] ??
      displayCardsForBoard('mainboard')[0] ??
      null
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Unable to load tournament Deck.'
  } finally {
    loading.value = false
  }
})

function cardsForBoard(board: TournamentDeckBoard) {
  const cards = deck.value?.cards.filter((card) => card.board === board) ?? []
  if (board === 'commander') return cards
  return [...cards].sort((left, right) => {
    if (decklistSort.value === 'mana-value') {
      const difference =
        (left.manaValue ?? Number.MAX_SAFE_INTEGER) -
        (right.manaValue ?? Number.MAX_SAFE_INTEGER)
      if (difference !== 0) return difference
    }
    if (decklistSort.value === 'card-type') {
      const difference = getSortableCardType(left.typeLine ?? '').localeCompare(
        getSortableCardType(right.typeLine ?? ''),
      )
      if (difference !== 0) return difference
    }
    return left.cardName.localeCompare(right.cardName)
  })
}

function displayCardsForBoard(board: TournamentDeckBoard) {
  return cardsForBoard(board).map(toDisplayCard)
}

function toDisplayCard(card: NormalizedTournamentDeckCard): TournamentDeckCard {
  const resolved = displayCardLookup.value.get(
    card.oracleId ? `oracle:${card.oracleId}` : `name:${card.cardName.toLowerCase()}`,
  )
  return {
    name: card.cardName,
    quantity: card.quantity,
    oracleId: card.oracleId ?? null,
    typeLine: resolved?.type_line ?? card.typeLine ?? '',
    manaCost: resolved?.mana_cost ?? resolved?.card_faces?.[0]?.mana_cost ?? '',
    manaValue: resolved?.cmc ?? card.manaValue ?? null,
    imageUrl:
      resolved?.image_uris?.normal ??
      resolved?.card_faces?.[0]?.image_uris?.normal ??
      '',
    backImageUrl: resolved?.card_faces?.[1]?.image_uris?.normal,
  }
}

function restorePreview() {
  previewCard.value = commanderCards.value[0] ??
    displayCardsForBoard('mainboard')[0] ??
    null
}

function boardQuantity(board: TournamentDeckBoard) {
  return deck.value?.cards
    .filter((card) => card.board === board)
    .reduce((sum, card) => sum + card.quantity, 0) ?? 0
}

function exportCardsForBoard(board: TournamentDeckBoard) {
  return (deck.value?.cards ?? [])
    .filter((card) => card.board === board)
    .map((card) => ({ name: card.cardName, quantity: card.quantity }))
}

async function copyToMyDecks() {
  if (!deck.value) return
  let cards = resolvedCards.value
  if (!cards.length) {
    try {
      cards = await getCardsByExactNames(
        deck.value.cards.map((card) => card.cardName),
      )
    } catch (error) {
      console.warn('Unable to hydrate copied tournament card images.', error)
    }
  }
  const cardLookup = createTournamentCardLookup(cards)
  const copy = createEmptyDeck(
    `${deck.value.commanderName} — ${deck.value.tournament.name}`,
  )
  const copyBoard = (board: TournamentDeckBoard) =>
    cardsForBoard(board).map((card) => toCopiedDeckCard(card, cardLookup))
  const commanders = copyBoard('commander')
  copy.commander = commanders[0]?.card ?? null
  copy.partnerCommander = commanders[1]?.card ?? null
  copy.cards = copyBoard('mainboard')
  copy.sideboard = copyBoard('sideboard')
  copy.maybeboard = copyBoard('maybeboard')
  copy.considering = copyBoard('considering')
  deckStore.createDeck(copy.name, 'Tournament import')
  deckStore.replaceActiveDeck(copy)
  copyMessage.value = 'Tournament Deck copied to your Decks.'
  if (deckStore.activeDeckId) {
    void router.push({
      name: 'deck-builder',
      params: { deckId: deckStore.activeDeckId },
    })
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
    .format(new Date(value))
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}
</script>

<style scoped>
.tournament-deck-view {
  max-width: 1500px;
}

.deck-hero {
  background: rgb(var(--v-theme-surface-bright));
}

.deck-hero__content {
  align-items: center;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 20px 24px;
}

.widget-header-bar {
  background: rgb(var(--v-theme-primary-darken-2));
}

.deck-overview {
  align-items: stretch;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(190px, 0.72fr) minmax(440px, 2fr) minmax(220px, 0.88fr);
}

.commander-showcase__cards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.summary-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, 1fr);
}

.mana-curve {
  align-items: end;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(7, 1fr);
  height: 150px;
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
  width: 70%;
}

.mana-curve__bar {
  background: rgb(var(--v-theme-primary));
  border-radius: 5px 5px 0 0;
  min-height: 0;
  width: 100%;
}

.card-preview {
  align-self: start;
  position: sticky;
  top: 16px;
}

.board-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.card-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.card-grid :deep(.v-card) {
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.card-grid :deep(.v-card:hover) {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 12px rgba(var(--v-theme-primary), 0.25);
}

.card-list {
  background: transparent;
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card-list :deep(.v-list-item:nth-child(odd)) {
  background: rgb(var(--v-theme-surface-light));
}

@media (max-width: 1050px) {
  .deck-overview {
    grid-template-columns: minmax(180px, 0.8fr) minmax(420px, 2fr);
  }

  .card-preview {
    display: none;
  }
}

@media (max-width: 720px) {
  .deck-hero__content,
  .board-header {
    align-items: stretch;
    flex-direction: column;
  }

  .deck-overview {
    grid-template-columns: 1fr;
  }

  .summary-grid,
  .card-list {
    grid-template-columns: repeat(2, 1fr);
  }

  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
  }
}
</style>
