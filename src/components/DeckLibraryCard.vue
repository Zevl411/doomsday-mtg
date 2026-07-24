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
          position="center 40%"
          :src="commanderImage"
        />
        <v-img
          v-if="partnerImage"
          alt=""
          class="deck-summary-art-layer deck-summary-art-layer--partner"
          cover
          position="center 40%"
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

    <v-card-item class="deck-card-content-header">
      <div class="deck-card-header-controls">
        <span
          :aria-label="`${visibilityLabel} deck`"
          class="deck-visibility-icon"
          role="img"
          :title="`${visibilityLabel} deck`"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path :d="visibilityIconPath" />
          </svg>
        </span>
        <v-menu
          v-model="showMobileActions"
          location="bottom end"
          :close-on-content-click="false"
        >
          <template #activator="{ props }">
            <v-btn
              v-if="manageable && !selectable"
              v-bind="props"
              aria-label="Open deck actions"
              class="deck-card-actions-mobile d-flex d-md-none"
              icon
              size="small"
              variant="text"
              @click.stop.prevent="showMobileActions = true"
            >
              <svg
                aria-hidden="true"
                class="deck-card-menu-icon"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </v-btn>
          </template>
          <v-list density="comfortable">
            <v-list-item
              :disabled="!canCompare"
              title="View comparison"
              @click="emitMobileAction('compare', deck.id)"
            >
              <template #prepend>
                <DeckActionIcon compact name="compare" />
              </template>
            </v-list-item>
            <v-list-item
              title="Rename"
              @click="emitMobileAction('rename', deck.id)"
            >
              <template #prepend>
                <DeckActionIcon compact name="rename" />
              </template>
            </v-list-item>
            <v-list-item
              title="Duplicate"
              @click="emitMobileAction('duplicate', deck.id)"
            >
              <template #prepend>
                <DeckActionIcon compact name="duplicate" />
              </template>
            </v-list-item>
            <v-list-item
              title="Delete"
              @click="emitMobileAction('delete', deck.id)"
            >
              <template #prepend>
                <DeckActionIcon compact name="delete" />
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
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
      class="deck-card-actions pa-0 d-none d-md-flex"
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
        density="comfortable"
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
          <DeckActionIcon compact name="compare" />
        </v-btn>
        <v-btn
          aria-label="Rename deck"
          icon
          title="Rename deck"
          @click="emit('rename', deck.id)"
        >
          <DeckActionIcon compact name="rename" />
        </v-btn>
        <v-btn
          aria-label="Duplicate deck"
          icon
          title="Duplicate deck"
          @click="emit('duplicate', deck.id)"
        >
          <DeckActionIcon compact name="duplicate" />
        </v-btn>
      </v-btn-group>
    </v-card-actions>

  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Deck, DeckCard, DeckVisibility } from '../models/deck'
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

const showMobileActions = ref(false)

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
const deckVisibility = computed<DeckVisibility>(
  () => props.deck.visibility ?? 'private',
)
const visibilityLabel = computed(() => {
  const visibility = deckVisibility.value
  return visibility.charAt(0).toUpperCase() + visibility.slice(1)
})
const visibilityIconPath = computed(() => {
  if (deckVisibility.value === 'public') {
    return 'M12 5c5.5 0 9.6 4.4 10.8 6.1a1.5 1.5 0 0 1 0 1.8C21.6 14.6 17.5 19 12 19S2.4 14.6 1.2 12.9a1.5 1.5 0 0 1 0-1.8C2.4 9.4 6.5 5 12 5Zm0 2c-4.1 0-7.5 3.1-8.7 5 1.2 1.9 4.6 5 8.7 5s7.5-3.1 8.7-5C19.5 10.1 16.1 7 12 7Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z'
  }
  if (deckVisibility.value === 'unlisted') {
    return 'M12 2a7 7 0 0 1 7 7v7.5l1.6 2.4a1 1 0 0 1-1.4 1.4L16.7 19l-2.1 2.1a1 1 0 0 1-1.4 0L12 19.9l-1.2 1.2a1 1 0 0 1-1.4 0L7.3 19l-2.5 1.3a1 1 0 0 1-1.4-1.4L5 16.5V9a7 7 0 0 1 7-7Zm-2.5 7A1.5 1.5 0 1 0 9.5 12a1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z'
  }
  return 'M17 10h1a2 2 0 0 1 2 2v9H4v-9a2 2 0 0 1 2-2h1V7a5 5 0 0 1 10 0v3Zm-8 0h6V7a3 3 0 0 0-6 0v3Zm3 3a2 2 0 0 0-1 3.7V19h2v-2.3a2 2 0 0 0-1-3.7Z'
})
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

function emitMobileAction(
  action: 'compare' | 'rename' | 'duplicate' | 'delete',
  deckId: string,
) {
  showMobileActions.value = false
  if (action === 'compare') {
    emit('compare', deckId)
    return
  }
  if (action === 'rename') {
    emit('rename', deckId)
    return
  }
  if (action === 'duplicate') {
    emit('duplicate', deckId)
    return
  }
  emit('delete', deckId)
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

.deck-card-content-header {
  padding-right: 52px;
  position: relative;
}

.deck-card-header-controls {
  align-items: center;
  display: flex;
  gap: 2px;
  justify-content: center;
  position: absolute;
  right: 8px;
  top: 8px;
}

.deck-visibility-icon {
  align-items: center;
  color: rgb(var(--v-theme-primary));
  display: inline-flex;
  justify-content: center;
  padding: 8px;
}

.deck-visibility-icon svg {
  fill: currentColor;
  height: 22px;
  width: 22px;
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
  /* A slightly taller frame shows more of Scryfall's crop without letterboxing. */
  aspect-ratio: 1.55;
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

.deck-card-actions-mobile {
  color: rgb(var(--v-theme-primary));
}

.deck-card-menu-icon {
  fill: currentColor;
  height: 22px;
  width: 22px;
}

@media (max-width: 599px) {
  .deck-card-content-header,
  .deck-library-card :deep(.v-card-text) {
    padding-inline: 12px;
  }

  .deck-card-content-header {
    padding-right: 88px;
  }
}
</style>
