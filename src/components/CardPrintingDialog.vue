<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1120"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="card-printing-dialog" color="surface">
      <v-card-title class="align-center d-flex ga-3">
        <div class="min-width-0">
          <div class="text-h6">Choose a printing</div>
          <div class="text-body-2 text-medium-emphasis">
            {{ card?.name }}
          </div>
        </div>
        <v-spacer />
        <v-btn
          aria-label="Close printing picker"
          color="primary"
          icon
          variant="text"
          @click="close"
        >
          <DeckActionIcon compact name="close" />
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-card-text class="printing-dialog-content">
        <v-text-field
          v-if="!loading && printings.length"
          v-model="filter"
          class="mb-4"
          hide-details
          label="Filter by set, collector number, or artist"
        />

        <div
          v-if="loading"
          aria-label="Loading available card printings"
          aria-live="polite"
          class="printing-grid"
          role="status"
        >
          <div
            v-for="index in 8"
            :key="index"
            aria-hidden="true"
            class="printing-option printing-option--skeleton"
          >
            <div class="printing-option__image printing-skeleton-pulse" />
            <div class="printing-option__details">
              <i class="printing-skeleton-line printing-skeleton-pulse" />
              <i class="printing-skeleton-line printing-skeleton-line--short printing-skeleton-pulse" />
              <i class="printing-skeleton-line printing-skeleton-line--short printing-skeleton-pulse" />
            </div>
          </div>
          <span class="printing-sr-only">Loading available card printings</span>
        </div>

        <v-alert
          v-else-if="errorMessage"
          type="error"
          variant="tonal"
        >
          <div class="align-center d-flex flex-wrap ga-3">
            <span>{{ errorMessage }}</span>
            <v-btn color="error" variant="outlined" @click="loadPrintings">
              Retry
            </v-btn>
          </div>
        </v-alert>

        <v-sheet
          v-else-if="!filteredPrintings.length"
          class="pa-5 text-center text-medium-emphasis"
          color="surface-light"
        >
          No printings match this filter.
        </v-sheet>

        <template v-else>
          <div class="printing-grid">
            <button
              v-for="printing in visiblePrintings"
              :key="printing.id"
              :aria-label="`Select ${printingLabel(printing)}`"
              :aria-pressed="selectedPrintingId === printing.id"
              class="printing-option"
              :class="{
                'printing-option--selected':
                  selectedPrintingId === printing.id,
              }"
              type="button"
              @click="selectPrinting(printing)"
            >
              <div class="printing-option__image">
                <DoubleFacedCardImage
                  v-if="getCardImage(printing)"
                  :card="printing"
                  image-size="normal"
                />
                <v-sheet
                  v-else
                  class="align-center d-flex fill-height justify-center pa-3 text-center text-medium-emphasis"
                  color="surface-light"
                >
                  Image unavailable
                </v-sheet>
              </div>
              <div class="printing-option__details">
                <div class="align-start d-flex ga-2 justify-space-between">
                  <strong>{{ printing.set_name ?? 'Unknown set' }}</strong>
                  <v-chip
                    v-if="printing.id === card?.id"
                    color="primary"
                    size="small"
                    variant="outlined"
                  >
                    Current
                  </v-chip>
                </div>
                <span>
                  {{ printing.set?.toUpperCase() || '—' }}
                  <template v-if="printing.collector_number">
                    #{{ printing.collector_number }}
                  </template>
                </span>
                <span>{{ formatReleaseDate(printing.released_at) }}</span>
                <span>{{ finishLabel(printing) }}</span>
              </div>
            </button>
          </div>

          <div v-if="hasMore" class="d-flex justify-center mt-4">
            <v-btn variant="outlined" @click="displayLimit += PAGE_SIZE">
              Show more printings
            </v-btn>
          </div>
        </template>
      </v-card-text>

      <v-divider />

      <v-card-actions class="flex-wrap">
        <span class="text-body-2 text-medium-emphasis">
          {{ filteredPrintings.length }}
          {{ filteredPrintings.length === 1 ? 'printing' : 'printings' }}
        </span>
        <v-spacer />
        <v-switch
          v-if="allowFoil"
          v-model="selectedFoil"
          color="primary"
          density="comfortable"
          :disabled="!selectedPrinting || !selectedSupportsFoil"
          hide-details
          label="Foil"
        />
        <v-btn @click="close">Cancel</v-btn>
        <v-btn
          color="primary"
          :disabled="!selectedPrinting"
          variant="flat"
          @click="confirmSelection"
        >
          Use printing
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { getCardPrintings } from '../api/scryfall'
import type { ScryfallCard } from '../types/card'
import { getCardImage } from '../utils/cardDisplay'
import { supportsFoil } from '../utils/cardFinish'
import DeckActionIcon from './DeckActionIcon.vue'
import DoubleFacedCardImage from './DoubleFacedCardImage.vue'

const PAGE_SIZE = 48

const props = withDefaults(defineProps<{
  modelValue: boolean
  card: ScryfallCard | null
  foil?: boolean
  allowFoil?: boolean
}>(), {
  foil: false,
  allowFoil: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  selected: [selection: { printing: ScryfallCard; foil: boolean }]
}>()

const printings = ref<ScryfallCard[]>([])
const selectedPrintingId = ref('')
const selectedFoil = ref(false)
const filter = ref('')
const loading = ref(false)
const errorMessage = ref('')
const displayLimit = ref(PAGE_SIZE)
let controller: AbortController | null = null

const filteredPrintings = computed(() => {
  const query = filter.value.trim().toLowerCase()
  if (!query) return printings.value
  return printings.value.filter((printing) =>
    [
      printing.set,
      printing.set_name,
      printing.collector_number,
      printing.artist,
    ].some((value) => value?.toLowerCase().includes(query)),
  )
})
const visiblePrintings = computed(() =>
  filteredPrintings.value.slice(0, displayLimit.value),
)
const hasMore = computed(() =>
  visiblePrintings.value.length < filteredPrintings.value.length,
)
const selectedPrinting = computed(() =>
  printings.value.find((printing) => printing.id === selectedPrintingId.value),
)
const selectedSupportsFoil = computed(() =>
  selectedPrinting.value ? supportsFoil(selectedPrinting.value) : false,
)

watch(
  [() => props.modelValue, () => props.card?.id],
  ([isOpen]) => {
    if (!isOpen || !props.card) {
      controller?.abort()
      return
    }
    selectedPrintingId.value = props.card.id
    selectedFoil.value = props.foil
    filter.value = ''
    displayLimit.value = PAGE_SIZE
    void loadPrintings()
  },
)

onUnmounted(() => controller?.abort())

async function loadPrintings() {
  if (!props.card) return
  controller?.abort()
  controller = new AbortController()
  const activeController = controller
  loading.value = true
  errorMessage.value = ''

  try {
    const results = await getCardPrintings(
      props.card,
      activeController.signal,
    )
    if (activeController.signal.aborted) return

    // Keep the selected printing easy to verify without changing Scryfall's
    // newest-first order for every remaining result.
    const current = results.find((printing) => printing.id === props.card?.id)
    printings.value = current
      ? [current, ...results.filter((printing) => printing.id !== current.id)]
      : results
    if (current && !supportsFoil(current)) selectedFoil.value = false
    if (!printings.value.length) {
      errorMessage.value = 'No paper printings are available for this card.'
    }
  } catch {
    if (activeController.signal.aborted) return
    printings.value = []
    errorMessage.value = 'Printings are unavailable right now. Please try again.'
  } finally {
    if (controller === activeController) {
      loading.value = false
      controller = null
    }
  }
}

function printingLabel(printing: ScryfallCard): string {
  const set = printing.set_name ?? printing.set?.toUpperCase() ?? 'Unknown set'
  const collectorNumber = printing.collector_number
    ? `, number ${printing.collector_number}`
    : ''
  return `${printing.name} from ${set}${collectorNumber}`
}

function finishLabel(printing: ScryfallCard): string {
  if (supportsFoil(printing)) return 'Nonfoil or foil'
  return 'Nonfoil only'
}

function formatReleaseDate(value?: string): string {
  if (!value) return 'Release date unavailable'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date)
}

function close() {
  emit('update:modelValue', false)
}

function selectPrinting(printing: ScryfallCard) {
  selectedPrintingId.value = printing.id
  if (!supportsFoil(printing)) selectedFoil.value = false
}

function confirmSelection() {
  if (!selectedPrinting.value) return
  emit('selected', {
    printing: selectedPrinting.value,
    foil:
      props.allowFoil &&
      selectedFoil.value &&
      supportsFoil(selectedPrinting.value),
  })
  close()
}
</script>

<style scoped>
.printing-dialog-content {
  min-height: min(65vh, 620px);
}

.printing-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(100%, 160px), 1fr)
  );
}

.printing-option {
  background: rgb(var(--v-theme-surface-bright));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  text-align: left;
}

.printing-option:hover,
.printing-option:focus-visible,
.printing-option--selected {
  border-color: rgb(var(--v-theme-primary));
  outline: none;
}

.printing-option--selected {
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
}

.printing-option__image {
  aspect-ratio: 0.716;
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
}

.printing-option__image :deep(.v-img) {
  height: 100%;
}

.printing-option__details {
  display: grid;
  gap: 3px;
  min-height: 94px;
  padding: 9px;
}

.printing-option__details strong {
  font-size: 0.82rem;
  line-height: 1.25;
}

.printing-option__details > span {
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.72rem;
}

.printing-option--skeleton {
  cursor: default;
}

.printing-skeleton-line {
  background: rgb(var(--v-theme-surface-light));
  border-radius: 3px;
  display: block;
  height: 10px;
  width: 88%;
}

.printing-skeleton-line--short {
  width: 55%;
}

.printing-skeleton-pulse {
  animation: printing-skeleton-pulse 1.2s ease-in-out infinite alternate;
  background: rgb(var(--v-theme-surface-light));
}

.printing-sr-only {
  clip: rect(0, 0, 0, 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  position: absolute;
  width: 1px;
}

@keyframes printing-skeleton-pulse {
  from {
    opacity: 0.42;
  }

  to {
    opacity: 0.82;
  }
}

@media (max-width: 599px) {
  .printing-dialog-content {
    padding-inline: 10px;
  }

  .printing-grid {
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .printing-option__details {
    min-height: 88px;
    padding: 7px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .printing-skeleton-pulse {
    animation: none;
  }
}
</style>
