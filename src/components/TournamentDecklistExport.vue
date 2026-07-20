<template>
  <v-btn
    class="tournament-export-button"
    color="secondary"
    :density="compact ? 'compact' : 'default'"
    variant="outlined"
    @click="openDialog"
  >
    <svg
      aria-hidden="true"
      class="export-decklist-icon"
      viewBox="0 0 24 24"
    >
      <path d="M11 16h2V6l3.5 3.5 1.4-1.4L12 2.2 6.1 8.1l1.4 1.4L11 6v10ZM4 18h16v3H4v-3Z" />
    </svg>
    Export
  </v-btn>

  <v-dialog v-model="showDialog" max-width="760">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Export Tournament Decklist</v-card-title>
      <v-card-text class="px-5">
        <v-textarea
          :model-value="exportText"
          label="Plaintext decklist"
          readonly
          rows="14"
          variant="outlined"
        />
        <v-alert
          v-if="clipboardMessage"
          class="mt-3"
          density="comfortable"
          :type="clipboardSucceeded ? 'success' : 'error'"
          variant="tonal"
        >
          {{ clipboardMessage }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showDialog = false">Close</v-btn>
        <v-btn color="secondary" variant="flat" @click="copyExport">
          Copy to Clipboard
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  formatTournamentDecklist,
  type ExportableTournamentCard,
} from '../utils/tournamentDeckCards'

const props = defineProps<{
  commanders: ExportableTournamentCard[]
  cards: ExportableTournamentCard[]
  compact?: boolean
}>()

const showDialog = ref(false)
const clipboardMessage = ref('')
const clipboardSucceeded = ref(false)
const exportText = computed(() =>
  formatTournamentDecklist(props.commanders, props.cards),
)

function openDialog() {
  clipboardMessage.value = ''
  clipboardSucceeded.value = false
  showDialog.value = true
}

async function copyExport() {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(exportText.value)
    clipboardSucceeded.value = true
    clipboardMessage.value = 'Decklist copied to the clipboard.'
  } catch {
    clipboardSucceeded.value = false
    clipboardMessage.value =
      'Unable to copy automatically. Select and copy the decklist manually.'
  }
}
</script>

<style scoped>
.tournament-export-button {
  height: 40px;
  min-height: 40px;
}
</style>

<style scoped>
.export-decklist-icon {
  fill: currentColor;
  height: 18px;
  margin-right: 8px;
  width: 18px;
}
</style>
