<template>
  <v-card
    border
    :class="[
      'deck-library-card d-flex flex-column h-100',
      {
        'deck-library-card--selectable': selectable,
        'deck-library-card--selected': selected,
      },
    ]"
    color="surface"
    rounded="lg"
    variant="flat"
  >
    <button
      v-if="selectable"
      :aria-label="`${selected ? 'Deselect' : 'Select'} ${deck.name}`"
      :aria-pressed="selected"
      :class="[
        'deck-selection-control',
        { 'deck-selection-control--selected': selected },
      ]"
      type="button"
      @click.stop="toggleSelection"
    >
      <svg
        v-if="selected"
        aria-hidden="true"
        class="deck-selection-check"
        viewBox="0 0 24 24"
      >
        <path d="m5 12.5 4.2 4.2L19 7l-1.4-1.4-8.4 8.3-2.8-2.8L5 12.5Z" />
      </svg>
    </button>
    <button
      v-if="commanderImage"
      :aria-label="`Open ${deck.name}`"
      class="deck-summary-art"
      type="button"
      @click="openDeck"
    >
      <div class="deck-summary-artwork">
        <v-img
          alt=""
          class="deck-summary-art-layer deck-summary-art-layer--primary"
          cover
          :src="commanderImage"
        />
        <v-img
          v-if="partnerImage"
          alt=""
          class="deck-summary-art-layer deck-summary-art-layer--partner"
          cover
          :src="partnerImage"
        />
      </div>
    </button>
    <button
      v-else
      :aria-label="`${selectable ? 'Select' : 'Open'} ${deck.name}`"
      class="deck-summary-empty"
      type="button"
      @click="openDeck"
    >
      <v-sheet
        class="d-flex align-center justify-center text-medium-emphasis"
        color="surface-light"
        height="160"
      >
        No commander selected
      </v-sheet>
    </button>

    <v-card-item>
      <v-card-title>
        <button
          class="deck-card-title-button"
          type="button"
          @click="openDeck"
        >
          {{ deck.name }}
        </button>
      </v-card-title>
      <v-card-subtitle>
        {{ deck.commander?.name ?? 'No commander' }}
      </v-card-subtitle>
      <v-card-subtitle>
        By {{ deck.creatorUsername ?? 'Unknown' }}
      </v-card-subtitle>
    </v-card-item>

    <v-card-text class="flex-grow-1">
      <div class="d-flex flex-wrap ga-2">
        <v-chip size="x-small" variant="tonal">
          Main {{ boardCount(deck.cards) }}
        </v-chip>
        <v-chip size="x-small" variant="tonal">
          Side {{ boardCount(deck.sideboard) }}
        </v-chip>
        <v-chip size="x-small" variant="tonal">
          Maybe {{ boardCount(deck.maybeboard) + boardCount(deck.considering) }}
        </v-chip>
        <v-chip size="x-small" variant="outlined">
          {{ deck.visibility ?? 'private' }}
        </v-chip>
      </div>
      <p v-if="deck.description" class="mt-2 text-body-2">
        {{ deck.description }}
      </p>
      <div class="mt-2">{{ totalCount }} cards including commander</div>
      <div class="text-caption text-medium-emphasis">
        Updated {{ updatedLabel }}
      </div>
    </v-card-text>

    <v-card-actions
      v-if="manageable && !selectable"
      class="deck-card-actions pa-0"
    >
      <v-btn
        aria-label="Delete deck"
        class="deck-delete-action"
        color="error"
        icon
        title="Delete deck"
        variant="tonal"
        @click="emit('delete', deck.id)"
      >
        <DeckActionIcon compact name="delete" />
      </v-btn>
      <v-spacer />
      <v-btn-group
        class="deck-secondary-actions"
        density="compact"
        divided
        variant="text"
      >
        <v-btn
          aria-label="Compare deck"
          :disabled="!canCompare"
          icon
          :title="
            canCompare
              ? 'Compare with tournament data'
              : 'A Commander and mainboard card are required'
          "
          @click="emit('compare', deck.id)"
        >
          <svg
            aria-hidden="true"
            class="deck-action-icon"
            viewBox="0 0 24 24"
          >
            <path d="M4 19V9h4v10H4Zm6 0V5h4v14h-4Zm6 0v-7h4v7h-4Z" />
          </svg>
        </v-btn>
        <v-btn
          aria-label="Rename deck"
          icon
          title="Rename deck"
          @click="emit('rename', deck.id)"
        >
          <svg
            aria-hidden="true"
            class="deck-action-icon"
            viewBox="0 0 24 24"
          >
            <path
              d="m3 17.25 10.6-10.6 3.75 3.75L6.75 21H3v-3.75ZM18.7 9.05 14.95 5.3l1.85-1.85a1.5 1.5 0 0 1 2.1 0l1.65 1.65a1.5 1.5 0 0 1 0 2.1L18.7 9.05Z"
            />
          </svg>
        </v-btn>
        <v-btn
          aria-label="Duplicate deck"
          icon
          title="Duplicate deck"
          @click="emit('duplicate', deck.id)"
        >
          <svg
            aria-hidden="true"
            class="deck-action-icon"
            viewBox="0 0 24 24"
          >
            <path
              d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"
            />
          </svg>
        </v-btn>
      </v-btn-group>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Deck, DeckCard } from '../models/deck'
import { getCardArt } from '../utils/cardDisplay'
import { getTotalDeckCardCount } from '../utils/deckValidation'
import DeckActionIcon from './DeckActionIcon.vue'

const props = withDefaults(defineProps<{
  deck: Deck
  canCompare?: boolean
  manageable?: boolean
  selectable?: boolean
  selected?: boolean
}>(), {
  canCompare: false,
  manageable: true,
  selectable: false,
  selected: false,
})

// Emits describe user intentions; the library-owning store performs mutations.
const emit = defineEmits<{
  open: [deckId: string]
  compare: [deckId: string]
  rename: [deckId: string]
  duplicate: [deckId: string]
  delete: [deckId: string]
  toggleSelection: [deckId: string]
}>()

const commanderImage = computed(() =>
  props.deck.commander
    ? getCardArt(props.deck.commander)
    : undefined,
)
const partnerImage = computed(() =>
  props.deck.partnerCommander
    ? getCardArt(props.deck.partnerCommander)
    : undefined,
)
const totalCount = computed(() => getTotalDeckCardCount(props.deck))
const updatedLabel = computed(() =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(props.deck.updatedAt)),
)

function boardCount(entries: DeckCard[]): number {
  return entries.reduce((total, entry) => total + entry.quantity, 0)
}

function openDeck() {
  if (props.selectable) {
    toggleSelection()
    return
  }
  emit('open', props.deck.id)
}

function toggleSelection() {
  emit('toggleSelection', props.deck.id)
}
</script>

<style scoped>
.deck-library-card {
  position: relative;
}

.deck-library-card--selectable {
  cursor: pointer;
}

.deck-library-card--selected {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.28);
}

.deck-selection-control {
  align-items: center;
  appearance: none;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 50%;
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
  display: flex;
  height: 32px;
  justify-content: center;
  padding: 0;
  position: absolute;
  right: 12px;
  top: 12px;
  width: 32px;
  z-index: 3;
}

.deck-selection-control--selected {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}

.deck-selection-control:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.deck-selection-check {
  fill: currentColor;
  height: 22px;
  width: 22px;
}

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

.deck-summary-empty {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: inherit;
  width: 100%;
}

.deck-summary-empty:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.deck-summary-artwork {
  aspect-ratio: 1.7;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.deck-summary-art-layer {
  inset: 0;
  position: absolute;
}

.deck-summary-art-layer--primary:has(+ .deck-summary-art-layer--partner) {
  right: auto;
  width: 58%;
  mask-image: linear-gradient(
    90deg,
    black 0%,
    black 72%,
    transparent 100%
  );
}

.deck-summary-art-layer--partner {
  left: auto;
  width: 58%;
  mask-image: linear-gradient(
    90deg,
    transparent 0%,
    black 28%,
    black 100%
  );
}

.deck-card-actions {
  align-items: stretch;
  background: rgb(var(--v-theme-surface-light));
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  min-height: 52px;
}

.deck-delete-action,
.deck-secondary-actions {
  border-radius: 0;
  min-height: 52px;
}

.deck-delete-action {
  border-right: 1px solid
    rgba(var(--v-border-color), var(--v-border-opacity));
  min-width: 64px;
}

.deck-secondary-actions {
  align-self: stretch;
  border-left: 1px solid
    rgba(var(--v-border-color), var(--v-border-opacity));
  height: auto;
}

.deck-secondary-actions :deep(.v-btn) {
  border-radius: 0;
  height: 100%;
  min-height: 52px;
  min-width: 64px;
}

.deck-action-icon {
  fill: currentColor;
  height: 20px;
  width: 20px;
}

.deck-card-title-button {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-align: left;
}

.deck-card-title-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.deck-summary-art:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
</style>
