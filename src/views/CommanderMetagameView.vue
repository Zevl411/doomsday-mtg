<template>
  <v-container class="pa-0" fluid>
    <v-progress-linear v-if="loading" indeterminate />
    <v-alert v-else-if="errorMessage" type="error">{{ errorMessage }}</v-alert>
    <template v-else-if="detail?.stats">
      <h1 class="text-h4 font-weight-bold">{{ detail.stats.commanderName }}</h1>
      <ColorIdentitySymbols :colors="detail.stats.colorIdentity" />
      <div class="d-flex flex-wrap ga-2 my-5">
        <v-chip>{{ detail.stats.entries }} entries</v-chip>
        <v-chip>{{ percent(detail.stats.metaShare) }} meta share</v-chip>
        <v-chip>{{ percent(detail.stats.matchWinRate) }} match win rate</v-chip>
        <v-chip>{{ percent(detail.stats.topCutRate) }} top-16 rate</v-chip>
      </div>
      <v-list border>
        <v-list-item
          v-for="entry in detail.entries"
          :key="entry.id"
          :subtitle="`${entry.playerName || 'Unknown pilot'} · Place ${entry.standing ?? '—'} · ${entry.wins}-${entry.losses}-${entry.draws}`"
          :title="entry.tournamentName || 'Unknown tournament'"
          :to="{ name: 'tournament-detail', params: { tournamentId: entry.tournamentId } }"
        >
          <template #append>
            <v-btn v-if="entry.decklistUrl" :href="entry.decklistUrl" target="_blank" variant="text">Decklist</v-btn>
          </template>
        </v-list-item>
      </v-list>
      <p class="mt-4 text-caption text-medium-emphasis">
        Data provided by
        <a href="https://topdeck.gg" target="_blank" rel="noopener noreferrer">TopDeck.gg</a>
        and
        <a href="https://edhtop16.com" target="_blank" rel="noopener noreferrer">EDHTop16</a>.
      </p>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ColorIdentitySymbols from '../components/ColorIdentitySymbols.vue'
import {
  tournamentRepository,
  type CommanderDetail,
} from '../repositories/tournamentRepository'

const route = useRoute()
const detail = ref<CommanderDetail | null>(null)
const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    detail.value = await tournamentRepository.getCommanderDetails(
      String(route.params.commanderKey),
    )
    if (!detail.value.stats) errorMessage.value = 'Commander data not found.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load Commander data.'
  } finally {
    loading.value = false
  }
})

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}
</script>
