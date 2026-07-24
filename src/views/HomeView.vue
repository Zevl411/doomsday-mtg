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
        <DeckLibraryCard
          :can-compare="Boolean(deck.commander)"
          :deck="deck"
          @compare="compareDeck"
          @delete="openDeleteDialog"
          @duplicate="deckStore.duplicateDeck"
          @open="openDeck"
          @rename="openRenameDialog"
        />
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
          Recent cEDH results from TopDeck and EDHTop16.
        </div>
      </v-col>
      <v-col class="d-flex ga-2 justify-end" cols="auto">
        <v-btn :to="{ name: 'metagame' }" variant="text">Metagame</v-btn>
        <v-btn :to="{ name: 'tournaments' }" variant="text">
          Tournaments
        </v-btn>
      </v-col>
    </v-row>

    <AppLoadingSkeleton
      v-if="tournamentLoading"
      class="mb-6"
      :count="5"
      label="Loading recent tournaments"
      variant="table"
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
              <v-list-item-title class="d-flex align-center ga-2">
                <span>
                  {{ getCompactCommanderDisplayName(commander.commanderName) }}
                </span>
                <ColorIdentitySymbols
                  :colors="commander.colorIdentity"
                  size="small"
                />
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

  <v-dialog v-model="showNameDialog" max-width="480">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Rename deck</v-card-title>
      <v-card-text class="px-5">
        <v-text-field
          v-model="deckName"
          autofocus
          :error-messages="nameError"
          label="Deck name"
          @keyup.enter="submitName"
        />
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showNameDialog = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submitName">
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showDeleteDialog" max-width="480">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Delete this deck?</v-card-title>
      <v-card-text class="px-5">
        This permanently removes “{{ deletingDeck?.name }}”.
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showDeleteDialog = false">Cancel</v-btn>
        <v-btn color="error" variant="flat" @click="confirmDelete">
          Delete
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AnimatedOracleLogo from '../components/AnimatedOracleLogo.vue'
import AppLoadingSkeleton from '../components/AppLoadingSkeleton.vue'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import DeckCreationDialog from '../components/DeckCreationDialog.vue'
import DeckLibraryCard from '../components/DeckLibraryCard.vue'
import type {
  CommanderMetagameStats,
  Tournament,
} from '../models/tournament'
import { tournamentRepository } from '../repositories/tournamentRepository'
import { getCompactCommanderDisplayName } from '../utils/commanderIdentity'
import { useDeckStore } from '../stores/deck'

const deckStore = useDeckStore()
const router = useRouter()
const showCreateDialog = ref(false)
const showNameDialog = ref(false)
const showDeleteDialog = ref(false)
const editingDeckId = ref<string | null>(null)
const deletingDeckId = ref<string | null>(null)
const deckName = ref('')
const nameError = ref('')
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
const deletingDeck = computed(() =>
  deckStore.decks.find((deck) => deck.id === deletingDeckId.value),
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
    void router.push({ name: 'deck-builder', params: { deckId } })
  }
}

function startNewDeck() {
  showCreateDialog.value = true
}

function openCreatedDeck(deckId: string) {
  void router.push({ name: 'deck-builder', params: { deckId } })
}

function compareDeck(deckId: string) {
  void router.push({
    name: 'deck-comparison',
    params: { deckId },
  })
}

function openRenameDialog(deckId: string) {
  const deck = deckStore.decks.find((item) => item.id === deckId)
  if (!deck) return
  editingDeckId.value = deckId
  deckName.value = deck.name
  nameError.value = ''
  showNameDialog.value = true
}

function submitName() {
  const trimmedName = deckName.value.trim()
  if (!editingDeckId.value || !trimmedName) {
    nameError.value = 'Enter a deck name.'
    return
  }
  deckStore.renameDeck(editingDeckId.value, trimmedName)
  showNameDialog.value = false
}

function openDeleteDialog(deckId: string) {
  deletingDeckId.value = deckId
  showDeleteDialog.value = true
}

function confirmDelete() {
  if (deletingDeckId.value) {
    deckStore.deleteDeck(deletingDeckId.value)
  }
  showDeleteDialog.value = false
  deletingDeckId.value = null
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Unknown date'
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}
</script>
