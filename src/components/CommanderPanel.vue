<template>
  <v-card
    :border="!searchOnly"
    class="commander-panel h-100 w-100"
    :class="{
      'commander-panel--compact': compactDisplay,
      'commander-panel--empty': displayOnly && !displayedCommander,
    }"
    :color="searchOnly ? 'transparent' : 'surface'"
    rounded="lg"
    variant="flat"
  >
    <template v-if="!displayOnly">
      <v-card-text v-if="searchOnly" class="pa-0">
        <div
          class="compact-commander-searches"
          :class="{
            'compact-commander-searches--paired': canSearchPartner,
          }"
        >
          <div>
            <div class="compact-search-header text-subtitle-1">
              Commander
            </div>
            <div class="compact-search-field">
              <CardSearch
                clearable
                clear-on-select
                compact
                commander-only
                :selected-card="commander"
                :selected-card-ids="selectedCommanderIds"
                @card-hovered="deckStore.setPreviewCard"
                @card-selected="deckStore.setCommander"
                @cleared="deckStore.clearCommander"
              />
            </div>
          </div>
          <div v-if="canSearchPartner">
            <div class="compact-search-header text-subtitle-1">
              Partner
            </div>
            <div class="compact-search-field">
              <CardSearch
                clearable
                clear-on-select
                compact
                commander-only
                :result-filter="isCompatiblePartner"
                :search-filter="partnerSearchFilter"
                :selected-card="partnerCommander"
                :selected-card-ids="selectedCommanderIds"
                @card-hovered="deckStore.setPreviewCard"
                @card-selected="selectPartner"
                @cleared="deckStore.clearPartnerCommander"
              />
            </div>
          </div>
        </div>
        <v-alert
          v-if="partnerError"
          class="mt-3"
          density="compact"
          type="error"
          variant="tonal"
        >
          {{ partnerError }}
        </v-alert>
      </v-card-text>

      <template v-else>
        <v-card-title class="px-5 pt-5">Commander Search</v-card-title>
        <v-card-subtitle class="px-5">
          Find and manage your selected Commander
        </v-card-subtitle>
        <v-card-text class="pa-5">
          <CardSearch
            clearable
            clear-on-select
            commander-only
            :selected-card="commander"
            :selected-card-ids="selectedCommanderIds"
            @card-hovered="deckStore.setPreviewCard"
            @card-selected="deckStore.setCommander"
            @cleared="deckStore.clearCommander"
          />
          <template v-if="canSearchPartner">
            <v-divider class="my-5" />
            <p class="mb-3 text-subtitle-1 font-weight-medium">
              Partner Commander
            </p>
            <CardSearch
              clearable
              clear-on-select
              commander-only
              :result-filter="isCompatiblePartner"
              :search-filter="partnerSearchFilter"
              :selected-card="partnerCommander"
              :selected-card-ids="selectedCommanderIds"
              @card-hovered="deckStore.setPreviewCard"
              @card-selected="selectPartner"
              @cleared="deckStore.clearPartnerCommander"
            />
          </template>
        </v-card-text>
      </template>
    </template>

    <v-divider v-if="!searchOnly" />

    <template v-if="!searchOnly && displayedCommander">
      <div
        :aria-label="
          displayTarget === 'partner'
            ? 'Selected Partner Commander'
            : 'Selected Commander'
        "
        :class="[
          'commander-choice selected-commander-content text-center',
          {
            'commander-choice--selected':
              isSelectedPreview(displayedCommander),
          },
        ]"
        tabindex="0"
        @blur="deckStore.restoreSelectedPreviewCard()"
        @click="deckStore.selectPreviewCard(displayedCommander)"
        @focusin="deckStore.setPreviewCard(displayedCommander)"
        @mouseleave="deckStore.restoreSelectedPreviewCard()"
        @mouseenter="deckStore.setPreviewCard(displayedCommander)"
        @contextmenu.prevent="openCommanderMenu"
      >
        <DoubleFacedCardImage
          v-if="getCardImage(displayedCommander)"
          aspect-ratio="0.716"
          :card="displayedCommander"
          class="commander-image mx-auto mt-3 rounded-lg"
          cover
        />

        <v-card-title class="commander-name px-2 pb-1 pt-3 text-wrap">
          {{ displayedCommander.name }}
        </v-card-title>
        <v-card-subtitle
          class="commander-type px-2 pb-3 text-caption text-wrap"
        >
          {{ displayedCommander.type_line }}
        </v-card-subtitle>
      </div>
      <template v-if="partnerCommander && !displayOnly">
        <v-divider class="mx-2" />
        <div
          aria-label="Selected Partner Commander"
          :class="[
            'commander-choice text-center',
            {
              'commander-choice--selected':
                isSelectedPreview(partnerCommander),
            },
          ]"
          tabindex="0"
          @blur="deckStore.restoreSelectedPreviewCard()"
          @click="deckStore.selectPreviewCard(partnerCommander)"
          @focusin="deckStore.setPreviewCard(partnerCommander)"
          @mouseleave="deckStore.restoreSelectedPreviewCard()"
          @mouseenter="deckStore.setPreviewCard(partnerCommander)"
        >
          <DoubleFacedCardImage
            v-if="getCardImage(partnerCommander)"
            aspect-ratio="0.716"
            :card="partnerCommander"
            class="commander-image mx-auto mt-3 rounded-lg"
            cover
          />
          <v-card-title class="commander-name px-2 pb-1 pt-3 text-wrap">
            {{ partnerCommander.name }}
          </v-card-title>
          <v-card-subtitle
            class="commander-type px-2 pb-3 text-caption text-wrap"
          >
            {{ partnerCommander.type_line }}
          </v-card-subtitle>
        </div>
      </template>
    </template>

    <v-card-text
      v-else-if="!searchOnly"
      class="commander-empty-state d-flex flex-column justify-start pa-4"
    >
      <div class="empty-commander-search">
        <div class="mb-2 text-subtitle-2">
          {{ displayTarget === 'partner' ? 'Partner' : 'Commander' }}
        </div>
        <CardSearch
          v-if="displayTarget === 'commander'"
          clear-on-select
          commander-only
          elevated-results
          :selected-card="commander"
          :selected-card-ids="selectedCommanderIds"
          @card-hovered="deckStore.setPreviewCard"
          @card-selected="deckStore.setCommander"
          @cleared="deckStore.clearCommander"
        />
        <CardSearch
          v-else
          clear-on-select
          commander-only
          elevated-results
          :result-filter="isCompatiblePartner"
          :search-filter="partnerSearchFilter"
          :selected-card="partnerCommander"
          :selected-card-ids="selectedCommanderIds"
          @card-hovered="deckStore.setPreviewCard"
          @card-selected="selectPartner"
          @cleared="deckStore.clearPartnerCommander"
        />
      </div>

      <div class="mt-5 text-center">
        <v-icon
          aria-hidden="true"
          class="mb-2"
          color="primary"
          icon="mdi-account-star-outline"
          size="36"
        />
        <h2 class="text-h6">
          Choose your
          {{ displayTarget === 'partner' ? 'Partner' : 'Commander' }}
        </h2>
        <p class="mt-1 text-body-2 text-medium-emphasis">
          {{
            displayTarget === 'partner'
              ? 'Search for a compatible partner for your Commander.'
              : 'Search for a legendary card to establish this deck’s color identity.'
          }}
        </p>
      </div>

      <v-alert
        v-if="partnerError"
        class="mt-3"
        density="compact"
        type="error"
        variant="tonal"
      >
        {{ partnerError }}
      </v-alert>
    </v-card-text>

    <v-menu
      v-model="commanderMenuOpen"
      :target="[commanderMenuX, commanderMenuY]"
    >
      <v-list density="compact">
        <v-list-item
          base-color="error"
          :title="
            displayTarget === 'partner'
              ? 'Remove Partner'
              : 'Remove Commander'
          "
          @click="removeDisplayedCommander"
        >
          <template #prepend>
            <DeckActionIcon name="delete" />
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CardSearch from './CardSearch.vue'
import DeckActionIcon from './DeckActionIcon.vue'
import DoubleFacedCardImage from './DoubleFacedCardImage.vue'
import { useDeckStore } from '../stores/deck'
import { getCardImage } from '../utils/cardDisplay'
import { getCardIdentity } from '../utils/cardIdentity'
import type { ScryfallCard } from '../types/card'
import {
  canHavePartner,
  getPartnerSearchFilter,
  validateCommanderPairing,
} from '../utils/commanderPairing'

const deckStore = useDeckStore()
const props = withDefaults(defineProps<{
  searchOnly?: boolean
  displayOnly?: boolean
  displayTarget?: 'commander' | 'partner'
  compactDisplay?: boolean
}>(), {
  searchOnly: false,
  displayOnly: false,
  displayTarget: 'commander',
  compactDisplay: false,
})
const searchOnly = computed(() => props.searchOnly)
const displayOnly = computed(() => props.displayOnly)
const displayTarget = computed(() => props.displayTarget)
const compactDisplay = computed(() => props.compactDisplay)
const commander = computed(() => deckStore.deck.commander)
const partnerCommander = computed(() => deckStore.deck.partnerCommander ?? null)
const displayedCommander = computed(() =>
  displayTarget.value === 'partner'
    ? partnerCommander.value
    : commander.value,
)
const partnerError = ref('')
const commanderMenuOpen = ref(false)
const commanderMenuX = ref(0)
const commanderMenuY = ref(0)
const selectedCommanderIds = computed(() =>
  [commander.value?.id, partnerCommander.value?.id].filter(
    (id): id is string => Boolean(id),
  ),
)
const partnerSearchFilter = computed(() =>
  commander.value ? getPartnerSearchFilter(commander.value) : '',
)
const canSearchPartner = computed(() =>
  Boolean(commander.value && canHavePartner(commander.value)),
)

function selectPartner(card: ScryfallCard) {
  const result = deckStore.setPartnerCommander(card)
  partnerError.value = result.allowed
    ? ''
    : result.reason ?? 'Those commanders cannot be paired.'
}

function isCompatiblePartner(card: ScryfallCard): boolean {
  return Boolean(
    commander.value
    && validateCommanderPairing(commander.value, card).allowed,
  )
}

function isSelectedPreview(card: ScryfallCard): boolean {
  return Boolean(
    deckStore.selectedPreviewCard
    && getCardIdentity(deckStore.selectedPreviewCard) ===
      getCardIdentity(card),
  )
}

function openCommanderMenu(event: MouseEvent) {
  commanderMenuX.value = event.clientX
  commanderMenuY.value = event.clientY
  commanderMenuOpen.value = true
}

function removeDisplayedCommander() {
  if (displayTarget.value === 'partner') {
    deckStore.clearPartnerCommander()
  } else {
    deckStore.clearCommander()
  }
  deckStore.clearPreviewCard()
  commanderMenuOpen.value = false
}
</script>

<style scoped>
.commander-panel {
  border-color: rgba(var(--v-theme-on-surface), 0.14);
  min-width: 0;
  overflow: hidden;
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
}

.commander-panel--empty {
  overflow: visible;
}

.commander-empty-state {
  min-height: 100%;
}

.empty-commander-search {
  position: relative;
  text-align: left;
  z-index: 10;
}

.commander-image {
  max-width: none;
  width: calc(100% - 24px);
}

.commander-panel--compact .commander-image {
  width: min(calc(100% - 24px), 125px);
}

.commander-panel--compact .commander-name {
  font-size: 1rem;
  padding-top: 8px !important;
}

.commander-panel--compact .commander-type {
  padding-bottom: 8px !important;
}

.commander-panel--compact .commander-empty-state {
  padding: 12px !important;
}

.commander-panel--compact .commander-empty-state > .mt-5 {
  margin-top: 12px !important;
}

.commander-choice {
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease;
}

.commander-choice:hover,
.commander-choice:focus-visible {
  outline: none;
}

.commander-panel:has(.commander-choice:hover),
.commander-panel:has(.commander-choice:focus-visible) {
  border-color: rgba(var(--v-theme-primary), 0.42);
  box-shadow: inset 0 0 12px rgba(var(--v-theme-primary), 0.08);
}

.commander-choice--selected {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.commander-panel:has(.commander-choice--selected) {
  background: rgba(var(--v-theme-primary), 0.09);
  border-color: rgba(var(--v-theme-primary), 0.72);
  box-shadow:
    inset 0 0 0 1px rgba(var(--v-theme-primary), 0.22),
    inset 0 0 12px rgba(var(--v-theme-primary), 0.1);
}

.commander-name {
  font-size: 1.125rem;
  line-height: 1.3;
}

.commander-type {
  line-height: 1.25;
  opacity: 0.72;
}

.compact-search-header {
  align-items: center;
  display: flex;
  height: 32px;
  line-height: 1.5rem;
  min-height: 32px;
}

.compact-commander-searches {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
}

.compact-commander-searches--paired {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.compact-search-field {
  padding-top: 8px;
}

@media (max-width: 700px) {
  .compact-commander-searches--paired {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
