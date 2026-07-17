<template>
  <v-container class="pa-0" fluid>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error">{{ errorMessage }}</v-alert>
    <template v-else-if="detail">
      <h1 class="text-h4 font-weight-bold">{{ detail.tournament.name }}</h1>
      <p class="mb-5 text-medium-emphasis">
        {{ detail.tournament.playerCount ?? 'Unknown' }} players ·
        Source: {{ detail.tournament.source }}
        <a v-if="detail.tournament.url" :href="detail.tournament.url" target="_blank">
          View original
        </a>
      </p>
      <v-card border>
        <v-table>
          <thead><tr><th>Place</th><th>Pilot</th><th>Commander</th><th>Record</th><th>Decklist</th></tr></thead>
          <tbody>
            <tr v-for="entry in detail.entries" :key="entry.id">
              <td>{{ entry.standing ?? '—' }}</td>
              <td>{{ entry.playerName || 'Unknown pilot' }}</td>
              <td>{{ entry.commanderName }}</td>
              <td>{{ entry.wins }}-{{ entry.losses }}-{{ entry.draws }}</td>
              <td>
                <v-btn
                  v-if="entry.decklistUrl"
                  color="primary"
                  size="small"
                  variant="text"
                  @click="openDecklist(entry)"
                >
                  View decklist
                </v-btn>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </template>
  </v-container>

  <v-dialog v-model="decklistDialogOpen" fullscreen>
    <v-card color="surface">
      <v-toolbar color="surface">
        <v-toolbar-title>
          {{ selectedEntry?.playerName || 'Tournament' }} decklist
          <span v-if="selectedEntry">— {{ selectedEntry.commanderName }}</span>
        </v-toolbar-title>
        <v-btn
          v-if="selectedEntry?.decklistUrl"
          :href="selectedEntry.decklistUrl"
          rel="noopener noreferrer"
          target="_blank"
          variant="text"
        >
          Open original
        </v-btn>
        <v-btn
          aria-label="Close tournament decklist"
          icon="mdi-close"
          @click="closeDecklist"
        />
      </v-toolbar>
      <iframe
        v-if="safeDecklistUrl"
        class="decklist-frame"
        :src="safeDecklistUrl"
        :title="`${selectedEntry?.commanderName ?? 'Tournament'} decklist`"
      />
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  tournamentRepository,
  type TournamentDetail,
} from '../repositories/tournamentRepository'
import type { TournamentEntry } from '../models/tournament'

const route = useRoute()
const detail = ref<TournamentDetail | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const selectedEntry = ref<TournamentEntry | null>(null)
const decklistDialogOpen = ref(false)
const safeDecklistUrl = computed(() => {
  const value = selectedEntry.value?.decklistUrl
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
})

function openDecklist(entry: TournamentEntry) {
  selectedEntry.value = entry
  decklistDialogOpen.value = true
}

function closeDecklist() {
  decklistDialogOpen.value = false
  selectedEntry.value = null
}

onMounted(async () => {
  try {
    detail.value = await tournamentRepository.getTournament(String(route.params.tournamentId))
    if (!detail.value) errorMessage.value = 'Tournament not found.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load tournament.'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.decklist-frame {
  border: 0;
  height: calc(100vh - 64px);
  width: 100%;
}
</style>
