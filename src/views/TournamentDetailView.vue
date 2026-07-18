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
              <section v-if="decklists[entry.id]?.commanders.length">
                <h2 class="mb-3 text-h6">Commander</h2>
                <div class="card-grid mb-6">
                  <TournamentCardImage
                    v-for="card in decklists[entry.id]?.commanders"
                    :key="card.oracleId ?? card.name"
                    :card="card"
                  />
                </div>
              </section>

              <section>
                <div class="d-flex flex-wrap align-center ga-3 mb-3">
                  <h2 class="text-h6">Main deck</h2>
                  <v-chip size="small" variant="tonal">
                    {{ getDeckCardCount(entry.id) }} cards
                  </v-chip>
                </div>
                <div class="card-grid">
                  <TournamentCardImage
                    v-for="(card, index) in decklists[entry.id]?.cards"
                    :key="`${card.oracleId ?? card.name}-${index}`"
                    :card="card"
                  />
                </div>
              </section>
            </template>

            <v-alert v-else type="info" variant="tonal">
              No submitted decklist is available for this placing.
            </v-alert>

            <v-btn
              v-if="entry.tournamentDeckId"
              class="mt-4"
              :to="{
                name: 'tournament-deck-detail',
                params: { deckId: entry.tournamentDeckId },
              }"
              variant="outlined"
            >
              View normalized Deck
            </v-btn>

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
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import TournamentCardImage from '../components/TournamentCardImage.vue'
import {
  tournamentRepository,
  type TournamentDetail,
} from '../repositories/tournamentRepository'
import type {
  TournamentEntry,
  TournamentEntryDecklist,
} from '../models/tournament'
import {
  displayTournamentLocation,
  sourceAttribution,
} from '../utils/tournamentLocation'

const route = useRoute()
const detail = ref<TournamentDetail | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const expandedEntryIds = ref<string[]>([])
const decklists = ref<Record<string, TournamentEntryDecklist>>({})
const decklistLoading = ref<Record<string, boolean>>({})
const decklistErrors = ref<Record<string, string>>({})

function getDeckCardCount(entryId: string): number {
  return decklists.value[entryId]?.cards.reduce(
    (total, card) => total + card.quantity,
    0,
  ) ?? 0
}

onMounted(async () => {
  try {
    detail.value = await tournamentRepository.getTournament(
      String(route.params.tournamentId),
    )
    if (!detail.value) errorMessage.value = 'Tournament not found.'
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load tournament.'
  } finally {
    loading.value = false
  }
})

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
    decklists.value[entry.id] =
      await tournamentRepository.getEntryDecklist(entry)
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
}

.placement-panel--gold {
  border-color: #d4af37;
}

.placement-panel--silver {
  border-color: #aeb4bd;
}

.placement-panel--bronze {
  border-color: #b87333;
}

.placement-panel--top-cut {
  border-color: #587a9b;
}

.card-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}
</style>
