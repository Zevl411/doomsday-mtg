<template>
  <v-container class="pa-0" fluid>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error" variant="tonal">{{ errorMessage }}</v-alert>
    <template v-else-if="deck">
      <div class="d-flex flex-wrap justify-space-between ga-3 mb-5">
        <div>
          <h1 class="text-h4 font-weight-bold">{{ deck.commanderName }}</h1>
          <p class="text-medium-emphasis">
            {{ deck.entry.playerName || 'Unknown pilot' }} ·
            {{ deck.tournament.name }} · Place {{ deck.entry.standing ?? '—' }}
          </p>
          <p>{{ displayTournamentLocation(deck.tournament) }}</p>
        </div>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            v-if="deck.entry.decklistUrl"
            :href="deck.entry.decklistUrl"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
          >
            Original decklist
          </v-btn>
          <v-btn color="primary" @click="copyToMyDecks">Copy to My Decks</v-btn>
        </div>
      </div>

      <v-alert
        class="mb-5"
        :type="deck.parsingStatus === 'complete' ? 'success' : 'warning'"
        variant="tonal"
      >
        Parsing status: {{ deck.parsingStatus }}.
        <span v-if="deck.parsingIssues.length">
          {{ deck.parsingIssues.map((issue) => issue.message).join(' ') }}
        </span>
      </v-alert>
      <v-alert v-if="copyMessage" class="mb-5" type="success" variant="tonal">
        {{ copyMessage }}
      </v-alert>

      <v-card v-if="comparison" border class="mb-6">
        <v-card-title>Descriptive aggregate comparison</v-card-title>
        <v-card-text>
          <p>
            {{ comparison.sharedCardCount }} shared cards ·
            {{ percent(comparison.similarity) }} Jaccard set overlap
          </p>
          <p class="text-caption text-medium-emphasis">
            This comparison describes frequency, not performance advice.
          </p>
          <v-chip class="mr-2 mt-2" color="warning">
            {{ comparison.missingCoreCards.length }} missing Core
          </v-chip>
          <v-chip class="mt-2">
            {{ comparison.rareCards.length }} Rare-frequency inclusions
          </v-chip>
        </v-card-text>
      </v-card>

      <v-card v-for="board in populatedBoards" :key="board" border class="mb-4">
        <v-card-title class="text-capitalize">{{ board }}</v-card-title>
        <v-list>
          <v-list-item
            v-for="card in cardsForBoard(board)"
            :key="card.id"
            :subtitle="card.typeLine"
            :title="`${card.quantity}× ${card.cardName}`"
          />
        </v-list>
      </v-card>
      <p class="text-caption">
        Data provided by
        <a :href="sourceAttribution(deck.source).url" target="_blank" rel="noopener noreferrer">
          {{ deck.source === 'topdeck' ? 'TopDeck.gg' : 'EDHTop16' }}
        </a>.
      </p>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  CommanderCardInclusion,
  NormalizedTournamentDeck,
  TournamentDeckBoard,
} from '../models/tournament'
import { createEmptyDeck } from '../models/createDeck'
import type { DeckCard } from '../models/deck'
import { tournamentRepository } from '../repositories/tournamentRepository'
import { useDeckStore } from '../stores/deck'
import { compareDeckToAggregate } from '../utils/cardInclusion'
import {
  displayTournamentLocation,
  sourceAttribution,
} from '../utils/tournamentLocation'

const route = useRoute()
const router = useRouter()
const deckStore = useDeckStore()
const deck = ref<NormalizedTournamentDeck | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const copyMessage = ref('')
const aggregate = ref<CommanderCardInclusion[]>([])
const boardOrder: TournamentDeckBoard[] = [
  'commander', 'mainboard', 'sideboard', 'maybeboard',
  'considering', 'companion', 'unknown',
]
const populatedBoards = computed(() => boardOrder.filter((board) =>
  deck.value?.cards.some((card) => card.board === board)
))
const comparison = computed(() =>
  deck.value ? compareDeckToAggregate(deck.value.cards, aggregate.value) : null
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
    aggregate.value = await tournamentRepository.getCommanderCardInclusion(
      deck.value.commanderKey,
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load tournament Deck.'
  } finally {
    loading.value = false
  }
})

function cardsForBoard(board: TournamentDeckBoard) {
  return deck.value?.cards.filter((card) => card.board === board) ?? []
}

function copyToMyDecks() {
  if (!deck.value) return
  const copy = createEmptyDeck(
    `${deck.value.commanderName} — ${deck.value.tournament.name}`,
  )
  const commanders = cardsForBoard('commander').map(toDeckCard)
  copy.commander = commanders[0]?.card ?? null
  copy.partnerCommander = commanders[1]?.card ?? null
  copy.cards = cardsForBoard('mainboard').map(toDeckCard)
  copy.sideboard = cardsForBoard('sideboard').map(toDeckCard)
  copy.maybeboard = cardsForBoard('maybeboard').map(toDeckCard)
  copy.considering = cardsForBoard('considering').map(toDeckCard)
  // createDeck() allocates a fresh application ID; replacing its contents
  // never mutates the public tournament snapshot.
  deckStore.createDeck(copy.name)
  deckStore.replaceActiveDeck(copy)
  copyMessage.value = 'Tournament Deck copied to your Decks.'
  void router.push({ name: 'deck-builder' })
}

function toDeckCard(card: NormalizedTournamentDeck['cards'][number]): DeckCard {
  return {
    quantity: card.quantity,
    card: {
      id: card.scryfallId ?? card.oracleId ?? card.normalizedCardKey,
      oracle_id: card.oracleId,
      name: card.cardName,
      type_line: card.typeLine ?? '',
      color_identity: card.colorIdentity,
    },
  }
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}
</script>
