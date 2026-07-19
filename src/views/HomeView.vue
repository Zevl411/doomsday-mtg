<template>
  <v-container class="pa-0" fluid>
    <div class="home-hero mb-10">
      <div
        class="home-hero-brand d-flex align-center justify-center pa-4 pa-md-8"
      >
        <AnimatedOracleLogo
          aria-label="DoomsdayMTG Oracle fortune wheel logo"
          class="home-hero-logo"
          :interval-seconds="30"
          size="min(100%, 520px)"
        />
      </div>

      <div class="home-hero-content">
        <v-card
          border
          class="d-flex flex-column justify-center h-100 pa-6 pa-md-8"
          color="surface"
          rounded="xl"
        >
          <div class="text-overline text-primary">Consult the Oracle</div>
          <h1 class="text-h3 font-weight-bold mb-3">
            Build with better information
          </h1>
          <p class="text-body-1 text-medium-emphasis mb-6">
            Turn competitive Commander data into practical deck-building
            decisions.
          </p>

          <v-list bg-color="transparent" class="pa-0">
            <v-list-item
              v-for="feature in heroFeatures"
              :key="feature.title"
              class="px-0 mb-2"
              :subtitle="feature.description"
              :title="feature.title"
            >
              <template #prepend>
                <v-avatar color="primary" size="8" />
              </template>
            </v-list-item>
          </v-list>

          <v-btn
            class="mt-4 align-self-start"
            color="primary"
            @click="startNewDeck"
          >
            Start building
          </v-btn>
        </v-card>
      </div>
    </div>

    <v-row class="mb-2" align="center">
      <v-col>
        <div class="text-h4 font-weight-bold">Recently edited decks</div>
        <div class="text-body-2 text-medium-emphasis">
          Continue with your latest Commander builds.
        </div>
      </v-col>
      <v-col class="text-right" cols="auto">
        <v-btn :to="{ name: 'deck-library' }" variant="text">
          View all decks
        </v-btn>
      </v-col>
    </v-row>

    <v-row v-if="recentDecks.length" class="mb-8">
      <v-col
        v-for="deck in recentDecks"
        :key="deck.id"
        cols="12"
        sm="6"
        lg="3"
      >
        <v-card border class="d-flex flex-column h-100" color="surface">
          <button
            v-if="commanderImage(deck)"
            :aria-label="`Continue editing ${deck.name}`"
            class="deck-summary-art"
            type="button"
            @click="openDeck(deck.id)"
          >
            <v-img
              :alt="`${deck.commander?.name} card art`"
              aspect-ratio="1.7"
              cover
              :src="commanderImage(deck)"
            />
          </button>
          <v-sheet
            v-else
            class="d-flex align-center justify-center text-medium-emphasis"
            color="surface-light"
            height="140"
          >
            No Commander selected
          </v-sheet>
          <v-card-item>
            <v-card-title>{{ deck.name }}</v-card-title>
            <v-card-subtitle>
              {{ deck.commander?.name ?? 'No Commander' }}
            </v-card-subtitle>
          </v-card-item>
          <v-card-text class="flex-grow-1">
            <v-chip size="small" variant="tonal">
              {{ totalCards(deck) }} cards
            </v-chip>
            <div class="mt-2 text-caption text-medium-emphasis">
              Edited {{ formatDateTime(deck.updatedAt) }}
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn color="primary" variant="flat" @click="openDeck(deck.id)">
              Continue editing
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-card
      v-else
      border
      class="mb-8 pa-8 text-center"
      color="surface"
      rounded="lg"
    >
      <v-card-title>No decks yet</v-card-title>
      <v-card-text>Create a deck to begin building.</v-card-text>
      <v-card-actions class="justify-center">
        <v-btn color="primary" @click="startNewDeck">
          Create a deck
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-divider class="mb-8" />

    <v-row class="mb-2" align="center">
      <v-col>
        <div class="text-h4 font-weight-bold">Tournament snapshot</div>
        <div class="text-body-2 text-medium-emphasis">
          Recent normalized cEDH results from TopDeck and EDHTop16.
        </div>
      </v-col>
      <v-col class="d-flex ga-2 justify-end" cols="auto">
        <v-btn :to="{ name: 'metagame' }" variant="text">Metagame</v-btn>
        <v-btn :to="{ name: 'tournaments' }" variant="text">
          Tournaments
        </v-btn>
      </v-col>
    </v-row>

    <v-progress-linear
      v-if="tournamentLoading"
      class="mb-6"
      color="primary"
      indeterminate
    />
    <v-alert
      v-else-if="tournamentError"
      class="mb-6"
      type="info"
      variant="tonal"
    >
      {{ tournamentError }}
    </v-alert>
    <v-row v-else>
      <v-col cols="12" lg="7">
        <v-card border color="surface" rounded="lg">
          <v-card-title>Popular Commanders</v-card-title>
          <v-list v-if="commanderStats.length">
            <v-list-item
              v-for="commander in commanderStats"
              :key="commander.commanderKey"
              :to="{
                name: 'commander-metagame',
                params: { commanderKey: commander.commanderKey },
              }"
            >
              <template #prepend>
                <ColorIdentitySymbols
                  :colors="commander.colorIdentity"
                  size="small"
                />
              </template>
              <v-list-item-title>
                {{ commander.commanderName }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ commander.entries }} entries ·
                {{ percent(commander.metaShare) }} of the field
              </v-list-item-subtitle>
              <template #append>
                <v-chip size="small" variant="tonal">
                  {{ percent(commander.matchWinRate) }} win rate
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
          <v-card-text v-else class="text-medium-emphasis">
            No Commander statistics have been imported yet.
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <v-card border color="surface" rounded="lg">
          <v-card-title>Recent Tournaments</v-card-title>
          <v-list v-if="recentTournaments.length">
            <v-list-item
              v-for="tournament in recentTournaments"
              :key="tournament.id"
              :subtitle="`${formatDate(tournament.date)} · ${tournament.playerCount ?? 'Unknown'} players`"
              :title="tournament.name"
              :to="{
                name: 'tournament-detail',
                params: { tournamentId: tournament.id },
              }"
            >
              <template #append>
                <v-chip size="x-small" variant="tonal">
                  {{ tournament.source }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
          <v-card-text v-else class="text-medium-emphasis">
            No tournament results have been imported yet.
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <p class="mt-3 text-caption text-medium-emphasis">
      Data provided by
      <a href="https://topdeck.gg" target="_blank" rel="noopener noreferrer">TopDeck.gg</a>
      and
      <a href="https://edhtop16.com" target="_blank" rel="noopener noreferrer">EDHTop16</a>.
    </p>
  </v-container>
  <DeckCreationDialog
    v-model="showCreateDialog"
    @created="openCreatedDeck"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AnimatedOracleLogo from '../components/AnimatedOracleLogo.vue'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import DeckCreationDialog from '../components/DeckCreationDialog.vue'
import type { Deck } from '../models/deck'
import type {
  CommanderMetagameStats,
  Tournament,
} from '../models/tournament'
import { tournamentRepository } from '../repositories/tournamentRepository'
import { useDeckStore } from '../stores/deck'
import { getCardArt } from '../utils/cardDisplay'
import { getTotalDeckCardCount } from '../utils/deckValidation'

const deckStore = useDeckStore()
const router = useRouter()
const showCreateDialog = ref(false)
const commanderStats = ref<CommanderMetagameStats[]>([])
const recentTournaments = ref<Tournament[]>([])
const tournamentLoading = ref(true)
const tournamentError = ref('')
const heroFeatures = [
  {
    title: 'Build and validate decks',
    description: 'Track Commander legality, color identity, and deck size.',
  },
  {
    title: 'Explore tournament results',
    description: 'Review competitive events, placements, and decklists.',
  },
  {
    title: 'Understand the metagame',
    description: 'Compare Commanders, card inclusion, and performance trends.',
  },
]

// Sorting a copy keeps Pinia's authoritative library order untouched.
const recentDecks = computed(() =>
  [...deckStore.decks]
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    )
    .slice(0, 4),
)

onMounted(async () => {
  try {
    const [stats, tournaments] = await Promise.all([
      tournamentRepository.getCommanderMetagame({ minimumEntries: 1 }),
      tournamentRepository.getRecentTournaments(),
    ])
    commanderStats.value = stats.slice(0, 4)
    recentTournaments.value = tournaments.slice(0, 4)
  } catch {
    // Tournament data is supplemental; deck access remains useful without it.
    tournamentError.value =
      'Tournament data is not available yet. Your decks are still ready.'
  } finally {
    tournamentLoading.value = false
  }
})

function openDeck(deckId: string) {
  if (deckStore.openDeck(deckId)) {
    void router.push({ name: 'deck-builder' })
  }
}

function startNewDeck() {
  showCreateDialog.value = true
}

function openCreatedDeck() {
  void router.push({ name: 'deck-builder' })
}

function commanderImage(deck: Deck) {
  return deck.commander ? getCardArt(deck.commander) : undefined
}

function totalCards(deck: Deck) {
  return getTotalDeckCardCount(deck)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Unknown date'
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}
</script>

<style scoped>
.deck-summary-art {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: inherit;
  width: 100%;
}

.deck-summary-art:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
</style>
