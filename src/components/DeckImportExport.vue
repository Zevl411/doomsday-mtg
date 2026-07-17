<template>
  <v-card border color="surface" rounded="lg" variant="flat">
    <v-card-text class="d-flex flex-wrap align-center ga-3 pa-4">
      <span class="text-subtitle-1 font-weight-bold">Decklist</span>
      <v-spacer />
      <v-btn color="primary" variant="outlined" @click="openImportDialog">
        Import Decklist
      </v-btn>
      <v-btn color="secondary" variant="outlined" @click="openExportDialog">
        Export Decklist
      </v-btn>
    </v-card-text>
  </v-card>

  <v-dialog
    :model-value="showImportDialog"
    max-width="760"
    @update:model-value="handleImportDialogVisibility"
  >
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Import Decklist</v-card-title>
      <v-card-text class="px-5">
        <v-alert density="compact" type="warning" variant="tonal">
          Import replaces every tracked board and replaces the Commander when
          the decklist contains a Commander section. Clean imports complete
          immediately; imports with errors ask before proceeding.
        </v-alert>

        <v-textarea
          v-model="importText"
          class="mt-4"
          :disabled="isImporting"
          label="Plaintext decklist"
          rows="12"
          variant="outlined"
        />

        <v-select
          v-model="selectedFormat"
          class="mt-3"
          :disabled="isImporting"
          :items="formatOptions"
          label="Import format"
          variant="outlined"
        />

        <div v-if="isImporting" class="d-flex align-center ga-3">
          <v-progress-circular color="primary" indeterminate size="24" />
          <span>Resolving cards through Scryfall…</span>
        </div>

        <v-alert
          v-if="importError"
          class="mt-4"
          density="compact"
          type="error"
          variant="tonal"
        >
          {{ importError }}
        </v-alert>

        <!-- A prepared import remains visible only when user review is needed. -->
        <template v-if="preparedImport">
          <v-alert
            class="mt-4"
            density="compact"
            type="info"
            variant="tonal"
          >
            <div>
              Detected format:
              {{ getDecklistFormatLabel(preparedImport.result.format) }}
            </div>
            <div>
              {{ commanderSummary }} Mainboard: {{ preparedMainDeckCount }}
              cards ready.
            </div>
            <div>
              Sideboard: {{ preparedBoardCount('sideboard') }};
              Maybeboard: {{ preparedBoardCount('maybeboard') }};
              Considering: {{ preparedBoardCount('considering') }}.
            </div>
            <div>
              Imported total: {{ preparedImport.result.importedCards }} cards.
            </div>
            <div v-if="preparedImport.result.skippedCards">
              {{ preparedImport.result.skippedCards }} cards skipped because
              of import issues.
            </div>
          </v-alert>

          <v-alert
            v-if="preparedImport.result.ignoredSections.length"
            class="mt-3"
            density="compact"
            type="warning"
            variant="tonal"
          >
            Ignored:
            {{
              preparedImport.result.ignoredSections
                .map(
                  (item) =>
                    `${getSectionLabel(item.section)} (${item.cardCount})`,
                )
                .join(', ')
            }}.
          </v-alert>

          <v-alert
            v-if="preparedImport.result.commanderSource === 'required'"
            class="mt-3"
            density="compact"
            type="warning"
            variant="tonal"
          >
            Choose a Commander with Commander Search, then process this import
            again. The importer will not guess when confidence is low.
          </v-alert>

          <v-list
            v-if="preparedImport.result.issues.length"
            class="mt-3"
            bg-color="transparent"
            density="compact"
          >
            <v-list-item
              v-for="(issue, index) in preparedImport.result.issues"
              :key="`${issue.lineNumber ?? 'general'}-${index}`"
              :subtitle="issue.message"
              :title="
                issue.lineNumber
                  ? `Line ${issue.lineNumber}: ${issue.input ?? ''}`
                  : 'Import issue'
              "
            />
          </v-list>

          <v-alert
            v-if="preparedImport.result.informationalIssues.length"
            class="mt-3"
            density="compact"
            type="info"
            variant="tonal"
          >
            <div class="font-weight-medium">Skipped organizational labels:</div>
            <div
              v-for="item in preparedImport.result.informationalIssues"
              :key="`${item.lineNumber}-${item.input}`"
            >
              Line {{ item.lineNumber }}: {{ item.input }}
            </div>
          </v-alert>
        </template>
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="closeImportDialog">
          Cancel
        </v-btn>
        <v-btn
          v-if="!preparedImport"
          color="primary"
          :disabled="isImporting || !importText.trim()"
          :loading="isImporting"
          variant="flat"
          @click="processImport"
        >
          Process Import
        </v-btn>
        <v-btn
          v-else
          color="error"
          variant="flat"
          @click="confirmImport"
        >
          Proceed Anyway
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showExportDialog" max-width="760">
    <v-card color="surface" rounded="lg">
      <v-card-title class="px-5 pt-5">Export Decklist</v-card-title>
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
          density="compact"
          :type="clipboardSucceeded ? 'success' : 'error'"
          variant="tonal"
        >
          {{ clipboardMessage }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="px-5 pb-5">
        <v-spacer />
        <v-btn variant="text" @click="showExportDialog = false">
          Close
        </v-btn>
        <v-btn color="secondary" variant="flat" @click="copyExport">
          Copy to Clipboard
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { prepareDeckImport } from '../services/deckImport'
import { useDeckStore } from '../stores/deck'
import type { PreparedDeckImport } from '../types/deckImport'
import type {
  DecklistFormat,
  DecklistSection,
} from '../types/deckImport'
import { getDecklistFormatLabel } from '../utils/decklistFormat'
import { formatDecklist } from '../utils/decklistFormatter'

const deckStore = useDeckStore()
// Import and export dialogs intentionally own only temporary workflow state.
// The confirmed Deck itself always belongs to Pinia.
const showImportDialog = ref(false)
const showExportDialog = ref(false)
const importText = ref('')
const isImporting = ref(false)
const importError = ref('')
const selectedFormat = ref<'auto' | DecklistFormat>('auto')
const preparedImport = ref<PreparedDeckImport | null>(null)
const clipboardMessage = ref('')
const clipboardSucceeded = ref(false)
let importController: AbortController | null = null

const exportText = computed(() => formatDecklist(deckStore.deck))
const formatOptions: Array<{
  title: string
  value: 'auto' | DecklistFormat
}> = [
  { title: 'Auto detect', value: 'auto' },
  { title: 'Generic plaintext', value: 'generic' },
  { title: 'Moxfield', value: 'moxfield' },
  { title: 'Archidekt', value: 'archidekt' },
  { title: 'MTG Arena', value: 'arena' },
  { title: 'Magic Online', value: 'mtgo' },
]
const preparedMainDeckCount = computed(
  () =>
    preparedImport.value?.deck.cards.reduce(
      (total, entry) => total + entry.quantity,
      0,
    ) ?? 0,
)
const commanderSummary = computed(() => {
  const source = preparedImport.value?.result.commanderSource

  if (source === 'imported') {
    return 'Commander imported.'
  }

  if (source === 'retained') {
    return 'Current Commander retained.'
  }

  if (source === 'inferred') {
    return 'Commander inferred from the first card.'
  }

  if (source === 'required') {
    return 'Commander selection still required.'
  }

  return 'No Commander found.'
})

function preparedBoardCount(
  board: 'sideboard' | 'maybeboard' | 'considering',
): number {
  return (
    preparedImport.value?.deck[board].reduce(
      (total, entry) => total + entry.quantity,
      0,
    ) ?? 0
  )
}

function getSectionLabel(section: DecklistSection): string {
  const labels: Partial<Record<DecklistSection, string>> = {
    sideboard: 'sideboard',
    maybeboard: 'maybeboard',
    considering: 'considering',
    companion: 'companion',
    acquireboard: 'acquireboard',
    tokens: 'tokens',
  }

  return labels[section] ?? section
}

watch([importText, selectedFormat], () => {
  if (!isImporting.value) {
    preparedImport.value = null
    importError.value = ''
  }
})

function openImportDialog() {
  importText.value = ''
  preparedImport.value = null
  importError.value = ''
  selectedFormat.value = 'auto'
  showImportDialog.value = true
}

function closeImportDialog() {
  importController?.abort()
  importController = null
  isImporting.value = false
  showImportDialog.value = false
}

function handleImportDialogVisibility(isOpen: boolean) {
  if (isOpen) {
    showImportDialog.value = true
  } else {
    closeImportDialog()
  }
}

async function processImport() {
  importController?.abort()
  const controller = new AbortController()
  importController = controller
  isImporting.value = true
  importError.value = ''
  preparedImport.value = null

  try {
    const prepared = await prepareDeckImport(
      importText.value,
      deckStore.deck,
      controller.signal,
      selectedFormat.value === 'auto' ? undefined : selectedFormat.value,
    )

    // Clean imports need no second click. A lossy or ambiguous import remains
    // visible so the user can inspect exactly what would be replaced.
    if (hasImportErrors(prepared)) {
      preparedImport.value = prepared
    } else {
      deckStore.replaceDeck(prepared.deck)
      closeImportDialog()
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      importError.value =
        error instanceof Error ? error.message : 'Deck import failed.'
    }
  } finally {
    if (importController === controller) {
      importController = null
      isImporting.value = false
    }
  }
}

function confirmImport() {
  if (!preparedImport.value) {
    return
  }

  deckStore.replaceDeck(preparedImport.value.deck)
  closeImportDialog()
}

function hasImportErrors(prepared: PreparedDeckImport): boolean {
  return (
    prepared.result.issues.length > 0 ||
    prepared.result.skippedCards > 0 ||
    prepared.result.commanderSource === 'required'
  )
}

function openExportDialog() {
  clipboardMessage.value = ''
  clipboardSucceeded.value = false
  showExportDialog.value = true
}

async function copyExport() {
  try {
    if (!navigator.clipboard) {
      throw new Error('Clipboard unavailable')
    }

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
