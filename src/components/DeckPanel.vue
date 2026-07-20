<template>
  <v-card
    border
    class="deck-panel"
    color="surface-bright"
    rounded="lg"
    variant="flat"
  >
    <v-card-text class="pa-0">
      <section
        v-for="board in boards"
        :key="board.value"
        class="board-section"
      >
        <div
          class="board-header widget-header-bar"
          :class="{ 'board-header--accordion': board.value !== 'mainboard' }"
          :aria-expanded="
            board.value === 'mainboard'
              ? undefined
              : expandedBoards[board.value]
          "
          :aria-label="
            board.value === 'mainboard'
              ? undefined
              : `${expandedBoards[board.value] ? 'Collapse' : 'Expand'} ${board.title}`
          "
          :role="board.value !== 'mainboard' ? 'button' : undefined"
          :tabindex="board.value !== 'mainboard' ? 0 : undefined"
          @click="toggleBoard(board.value)"
          @keydown.enter.prevent="toggleBoard(board.value)"
          @keydown.space.prevent="toggleBoard(board.value)"
        >
          <div class="board-title d-flex align-center ga-3">
            <h2 class="text-h6">
              {{ board.title }} ({{ boardCount(board.value) }})
            </h2>
            <v-icon
              v-if="board.value !== 'mainboard'"
              :icon="
                expandedBoards[board.value]
                  ? 'mdi-chevron-up'
                  : 'mdi-chevron-down'
              "
            />
          </div>

          <div
            v-if="isBoardExpanded(board.value)"
            class="board-controls d-flex flex-wrap justify-end ga-3"
            @click.stop
            @keydown.stop
          >
            <div
              v-if="viewModes[board.value] === 'grid'"
              class="card-size-control"
            >
              <v-icon
                aria-hidden="true"
                color="primary"
                icon="mdi-image-size-select-large"
                size="small"
              />
              <v-slider
                v-model="gridSizes[board.value]"
                :aria-label="`Card size for ${board.title}`"
                color="primary"
                density="comfortable"
                hide-details
                :max="4"
                :min="1"
                :step="1"
                show-ticks="always"
                thumb-label
              />
            </div>
            <v-select
              v-model="sortSettings[board.value].primary"
              density="comfortable"
              hide-details
              :items="sortOptions"
              label="Group by"
              style="max-width: 180px"
              variant="outlined"
            />
            <v-select
              v-model="sortSettings[board.value].secondary"
              density="comfortable"
              hide-details
              :items="secondarySortOptions"
              label="Order by"
              style="max-width: 180px"
              variant="outlined"
            />
            <v-btn-toggle
              v-model="viewModes[board.value]"
              density="comfortable"
              mandatory
              variant="outlined"
            >
              <v-btn
                :aria-label="`Grid view for ${board.title}`"
                density="comfortable"
                value="grid"
              >
                <svg aria-hidden="true" class="view-toggle-icon" viewBox="0 0 24 24">
                  <path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />
                </svg>
              </v-btn>
              <v-btn
                :aria-label="`List view for ${board.title}`"
                density="comfortable"
                value="list"
              >
                <svg aria-hidden="true" class="view-toggle-icon" viewBox="0 0 24 24">
                  <path d="M4 5h3v3H4V5Zm5 0h11v3H9V5ZM4 10.5h3v3H4v-3Zm5 0h11v3H9v-3ZM4 16h3v3H4v-3Zm5 0h11v3H9v-3Z" />
                </svg>
              </v-btn>
            </v-btn-toggle>
          </div>
        </div>

        <v-expand-transition>
        <div
          v-show="isBoardExpanded(board.value)"
          class="board-content pa-4"
        >
        <template v-if="groupedCards(board.value).length">
          <div
            v-for="group in groupedCards(board.value)"
            :key="group.label"
            class="mb-5"
          >
            <h3 class="text-subtitle-2 text-medium-emphasis mb-2">
              {{ group.label }} ({{ group.count }})
            </h3>
            <v-list
              v-if="viewModes[board.value] === 'list'"
              bg-color="transparent"
              class="pa-0"
            >
              <v-list-item
                v-for="entry in group.cards"
                :key="`${entry.sourceBoard}-${identity(entry.card.card)}`"
                border
                :class="[
                  'deck-list-item mb-2',
                  {
                    'deck-item--selected':
                      isSelectedPreview(entry.card.card),
                  },
                ]"
                rounded="lg"
                tabindex="0"
                @blur="deckStore.restoreSelectedPreviewCard()"
                @click="deckStore.selectPreviewCard(entry.card.card)"
                @contextmenu.prevent="openMenu($event, entry)"
                @focus="deckStore.setPreviewCard(entry.card.card)"
                @mouseleave="deckStore.restoreSelectedPreviewCard()"
                @mouseenter="deckStore.setPreviewCard(entry.card.card)"
              >
                <v-list-item-title class="deck-list-row">
                  <span>
                    {{ entry.card.quantity }}× {{ entry.card.card.name }}
                  </span>
                  <ManaCost
                    v-if="getCastingCost(entry.card.card)"
                    :cost="getCastingCost(entry.card.card)"
                  />
                  <span class="text-body-2 text-medium-emphasis">
                    {{ entry.card.card.type_line }}
                  </span>
                </v-list-item-title>
                <template #append>
                  <v-btn
                    :aria-label="`Remove one ${entry.card.card.name}`"
                    icon
                    size="small"
                    variant="text"
                    @click.stop="decreaseEntry(entry)"
                  >
                    <DeckActionIcon compact name="decrease" />
                  </v-btn>
                  <v-btn
                    :aria-label="`Add one ${entry.card.card.name}`"
                    icon
                    size="small"
                    variant="text"
                    @click.stop="increaseEntry(entry)"
                  >
                    <DeckActionIcon compact name="increase" />
                  </v-btn>
                  <v-menu location="bottom end" open-on-hover>
                    <template #activator="{ props }">
                      <v-btn
                        :aria-label="`Move ${entry.card.card.name}`"
                        icon
                        size="small"
                        variant="text"
                        v-bind="props"
                        @click.stop
                      >
                        <DeckActionIcon compact name="move" />
                      </v-btn>
                    </template>
                    <v-list density="comfortable">
                      <v-list-item
                        v-for="target in availableMoveBoards(entry.sourceBoard)"
                        :key="target.value"
                        :title="target.title"
                        @click="moveEntry(entry, target.value)"
                      />
                    </v-list>
                  </v-menu>
                  <v-btn
                    :aria-label="`Remove ${entry.card.card.name}`"
                    color="error"
                    icon
                    size="small"
                    variant="text"
                    @click.stop="removeEntry(entry)"
                  >
                    <DeckActionIcon compact name="delete" />
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>

            <div
              v-else
              class="deck-card-grid"
              :style="{ '--deck-card-min-width': `${gridCardWidth(board.value)}px` }"
            >
              <div
                v-for="entry in group.cards"
                :key="`${entry.sourceBoard}-${identity(entry.card.card)}`"
              >
                <v-card
                  border
                  :class="[
                    'deck-grid-card overflow-hidden',
                    {
                      'deck-item--selected':
                        isSelectedPreview(entry.card.card),
                    },
                  ]"
                  rounded="lg"
                  tabindex="0"
                  @blur="deckStore.restoreSelectedPreviewCard()"
                  @click="deckStore.selectPreviewCard(entry.card.card)"
                  @contextmenu.prevent="openMenu($event, entry)"
                  @focus="deckStore.setPreviewCard(entry.card.card)"
                  @mouseleave="deckStore.restoreSelectedPreviewCard()"
                  @mouseenter="deckStore.setPreviewCard(entry.card.card)"
                >
                  <v-img
                    :alt="entry.card.card.name"
                    aspect-ratio="0.716"
                    class="full-card-image"
                    cover
                    :src="getCardImage(entry.card.card)"
                  />
                  <v-avatar
                    v-if="entry.card.quantity > 1"
                    class="position-absolute ma-2"
                    color="black"
                    style="top: 0; right: 0"
                    size="32"
                  >×{{ entry.card.quantity }}</v-avatar>
                </v-card>
              </div>
            </div>
          </div>
        </template>
        <v-sheet v-else class="pa-4 text-center text-medium-emphasis">
          This board is empty.
        </v-sheet>
        </div>
        </v-expand-transition>
      </section>
    </v-card-text>
  </v-card>

  <v-menu
    v-model="menuOpen"
    :target="[menuX, menuY]"
  >
    <v-list v-if="menuEntry" density="comfortable">
      <v-list-item title="Remove 1" @click="decrease">
        <template #prepend><DeckActionIcon name="decrease" /></template>
      </v-list-item>
      <v-list-item title="Add 1" @click="increase">
        <template #prepend><DeckActionIcon name="increase" /></template>
      </v-list-item>
      <v-menu location="end" open-on-hover>
        <template #activator="{ props }">
          <v-list-item title="Move to" v-bind="props">
            <template #prepend><DeckActionIcon name="move" /></template>
          </v-list-item>
        </template>
        <v-list>
          <v-list-item
            v-for="board in moveBoards"
            :key="board.value"
            :title="board.title"
            @click="move(board.value)"
          />
        </v-list>
      </v-menu>
      <v-list-item
        base-color="error"
        title="Remove"
        @click="remove"
      >
        <template #prepend><DeckActionIcon name="delete" /></template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { DeckCard, TrackedDeckBoard } from '../models/deck'
import { useDeckStore } from '../stores/deck'
import { getCardIdentity } from '../utils/cardIdentity'
import { getCardImage } from '../utils/cardDisplay'
import DeckActionIcon from './DeckActionIcon.vue'
import { useUserPreferencesStore } from '../stores/userPreferences'
import ManaCost from './ManaCost.vue'

type VisibleBoard = 'mainboard' | 'sideboard' | 'maybeboard'
type SortKey = 'name' | 'mana' | 'type' | 'color'
type SecondarySortKey = SortKey | 'none'
interface BoardEntry { card: DeckCard; sourceBoard: TrackedDeckBoard }
interface DeckPanelPreferences {
  viewModes: Record<VisibleBoard, 'list' | 'grid'>
  gridSizes: Record<VisibleBoard, number>
  sortSettings: Record<VisibleBoard, {
    primary: SortKey
    secondary: SecondarySortKey
  }>
}

const deckStore = useDeckStore()
const userPreferences = useUserPreferencesStore()
const preferencesStorageKey = 'doomsday-mtg-deck-panel-preferences'
const savedPreferences = loadPreferences()
const viewModes = reactive(savedPreferences.viewModes)
const gridSizes = reactive(savedPreferences.gridSizes)
const menuOpen = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuEntry = ref<BoardEntry | null>(null)
const expandedBoards = reactive<Record<Exclude<VisibleBoard, 'mainboard'>, boolean>>({
  sideboard: false,
  maybeboard: false,
})
const boards = [
  { title: 'Mainboard', value: 'mainboard' as const },
  { title: 'Sideboard', value: 'sideboard' as const },
  { title: 'Maybeboard', value: 'maybeboard' as const },
]
const sortOptions = [
  { title: 'Name', value: 'name' },
  { title: 'Mana cost', value: 'mana' },
  { title: 'Card type', value: 'type' },
  { title: 'Color', value: 'color' },
]
const secondarySortOptions = [
  { title: 'None', value: 'none' },
  ...sortOptions,
]
const typeGroupOrder = [
  'Planeswalker',
  'Creature',
  'Sorcery',
  'Instant',
  'Artifact',
  'Enchantment',
  'Land',
]
const sortSettings = reactive(savedPreferences.sortSettings)
const moveBoards = computed(() =>
  boards.filter((board) => board.value !== visibleBoard(menuEntry.value?.sourceBoard)),
)

watch(
  [viewModes, gridSizes, sortSettings],
  () => savePreferences(),
  { deep: true },
)

function entries(board: VisibleBoard): BoardEntry[] {
  if (board === 'mainboard') return deckStore.deck.cards.map(card => ({ card, sourceBoard: 'mainboard' }))
  if (board === 'sideboard') return deckStore.deck.sideboard.map(card => ({ card, sourceBoard: 'sideboard' }))
  return [
    ...deckStore.deck.maybeboard.map(card => ({ card, sourceBoard: 'maybeboard' as const })),
    ...deckStore.deck.considering.map(card => ({ card, sourceBoard: 'considering' as const })),
  ]
}
function groupedCards(board: VisibleBoard) {
  const settings = sortSettings[board]
  const groups = new Map<string, BoardEntry[]>()
  for (const entry of entries(board)) {
    const label = sortValue(entry.card, settings.primary, true)
    groups.set(label, [...(groups.get(label) ?? []), entry])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => compareGroupLabels(a, b, settings.primary))
    .map(([label, cards]) => ({
      label,
      count: cards.reduce((total, entry) => total + entry.card.quantity, 0),
      cards: settings.secondary === 'none'
        ? cards
        : cards.sort((a, b) =>
          sortValue(a.card, settings.secondary as SortKey).localeCompare(
            sortValue(b.card, settings.secondary as SortKey),
            undefined,
            { numeric: true },
          ) || a.card.card.name.localeCompare(b.card.card.name)),
    }))
}
function sortValue(entry: DeckCard, key: SortKey, group = false): string {
  const card = entry.card
  if (key === 'name') return group ? card.name.charAt(0).toUpperCase() : card.name
  if (key === 'mana') return `${card.cmc ?? 0}`.padStart(3, '0')
  if (key === 'color') return card.color_identity.slice().sort().join('') || 'Colorless'
  // Scryfall's top-level DFC type line can contain both faces. Deck grouping
  // follows the cast/front face only, matching how the card enters a decklist.
  const type = getCardTypeGroup(card.card_faces?.[0]?.type_line ?? card.type_line)
  return group ? type : `${typeOrder(type).toString().padStart(2, '0')}-${type}`
}
function getCardTypeGroup(typeLine: string): string {
  const cardTypes = typeLine.split('—')[0] ?? typeLine

  // A card belongs to only one group. Lands and creatures take precedence
  // over supplemental types, so Artifact Lands and Artifact Creatures are not
  // duplicated under Artifact.
  if (/\bLand\b/i.test(cardTypes)) return 'Land'
  if (/\bCreature\b/i.test(cardTypes)) return 'Creature'
  if (/\bPlaneswalker\b/i.test(cardTypes)) return 'Planeswalker'
  if (/\bSorcery\b/i.test(cardTypes)) return 'Sorcery'
  if (/\bInstant\b/i.test(cardTypes)) return 'Instant'
  if (/\bArtifact\b/i.test(cardTypes)) return 'Artifact'
  if (/\bEnchantment\b/i.test(cardTypes)) return 'Enchantment'
  return 'Other'
}
function typeOrder(type: string): number {
  const index = typeGroupOrder.indexOf(type)
  return index === -1 ? typeGroupOrder.length : index
}
function compareGroupLabels(left: string, right: string, key: SortKey): number {
  if (key === 'type') return typeOrder(left) - typeOrder(right)
  return left.localeCompare(right, undefined, { numeric: true })
}
function defaultPreferences(): DeckPanelPreferences {
  return {
    viewModes: {
      mainboard: userPreferences.values.defaultDeckDisplay,
      sideboard: userPreferences.values.defaultDeckDisplay,
      maybeboard: userPreferences.values.defaultDeckDisplay,
    },
    gridSizes: {
      mainboard: 2,
      sideboard: 2,
      maybeboard: 2,
    },
    sortSettings: {
      mainboard: {
        primary: userPreferences.values.defaultPrimaryGrouping,
        secondary: userPreferences.values.defaultSecondaryGrouping,
      },
      sideboard: {
        primary: userPreferences.values.defaultPrimaryGrouping,
        secondary: userPreferences.values.defaultSecondaryGrouping,
      },
      maybeboard: {
        primary: userPreferences.values.defaultPrimaryGrouping,
        secondary: userPreferences.values.defaultSecondaryGrouping,
      },
    },
  }
}
function loadPreferences(): DeckPanelPreferences {
  const defaults = defaultPreferences()
  try {
    const saved = JSON.parse(
      localStorage.getItem(preferencesStorageKey) ?? 'null',
    ) as (Partial<DeckPanelPreferences> & {
      viewMode?: 'list' | 'grid'
    }) | null
    if (!saved) return defaults

    return {
      viewModes: {
        mainboard: validViewMode(
          saved.viewModes?.mainboard ?? saved.viewMode,
          defaults.viewModes.mainboard,
        ),
        sideboard: validViewMode(
          saved.viewModes?.sideboard ?? saved.viewMode,
          defaults.viewModes.sideboard,
        ),
        maybeboard: validViewMode(
          saved.viewModes?.maybeboard ?? saved.viewMode,
          defaults.viewModes.maybeboard,
        ),
      },
      gridSizes: {
        mainboard: validGridSize(saved.gridSizes?.mainboard),
        sideboard: validGridSize(saved.gridSizes?.sideboard),
        maybeboard: validGridSize(saved.gridSizes?.maybeboard),
      },
      sortSettings: {
        mainboard: validBoardSort(saved.sortSettings?.mainboard, defaults.sortSettings.mainboard),
        sideboard: validBoardSort(saved.sortSettings?.sideboard, defaults.sortSettings.sideboard),
        maybeboard: validBoardSort(saved.sortSettings?.maybeboard, defaults.sortSettings.maybeboard),
      },
    }
  } catch {
    return defaults
  }
}
function validViewMode(
  value: unknown,
  fallback: 'list' | 'grid',
): 'list' | 'grid' {
  return value === 'list' || value === 'grid' ? value : fallback
}
function validGridSize(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(4, Math.max(1, value))
    : 2
}
function validBoardSort(
  value: {
    primary: SortKey
    secondary: SecondarySortKey
  } | undefined,
  fallback: { primary: SortKey; secondary: SecondarySortKey },
) {
  return {
    primary: isSortKey(value?.primary) ? value.primary : fallback.primary,
    secondary: value?.secondary === 'none' || isSortKey(value?.secondary)
      ? value.secondary
      : fallback.secondary,
  }
}
function isSortKey(value: unknown): value is SortKey {
  return value === 'name' || value === 'mana' || value === 'type' || value === 'color'
}
function savePreferences() {
  try {
    localStorage.setItem(
      preferencesStorageKey,
      JSON.stringify({
        viewModes,
        gridSizes,
        sortSettings,
      }),
    )
  } catch {
    // Browser privacy settings may disable storage. The in-memory choices
    // still work for the current page.
  }
}
function gridCardWidth(board: VisibleBoard): number {
  return [110, 145, 180, 220][gridSizes[board] - 1] ?? 145
}
function boardCount(board: VisibleBoard) {
  return entries(board).reduce((total, entry) => total + entry.card.quantity, 0)
}
function isBoardExpanded(board: VisibleBoard): boolean {
  return board === 'mainboard' || expandedBoards[board]
}
function toggleBoard(board: VisibleBoard) {
  if (board === 'mainboard') return
  expandedBoards[board] = !expandedBoards[board]
}
function identity(card: DeckCard['card']) { return getCardIdentity(card) }
function isSelectedPreview(card: DeckCard['card']) {
  return deckStore.selectedPreviewCard !== null
    && identity(deckStore.selectedPreviewCard) === identity(card)
}
function getCastingCost(card: DeckCard['card']): string {
  if (card.mana_cost) return card.mana_cost
  return (card.card_faces ?? [])
    .map((face) => face.mana_cost)
    .filter((cost): cost is string => Boolean(cost))
    .join(' // ')
}
function visibleBoard(board?: TrackedDeckBoard): VisibleBoard {
  return board === 'considering' ? 'maybeboard' : board ?? 'mainboard'
}
function availableMoveBoards(sourceBoard: TrackedDeckBoard) {
  return boards.filter((board) => board.value !== visibleBoard(sourceBoard))
}
function decreaseEntry(entry: BoardEntry) {
  deckStore.decreaseBoardQuantity(identity(entry.card.card), entry.sourceBoard)
}
function increaseEntry(entry: BoardEntry) {
  deckStore.increaseBoardQuantity(
    identity(entry.card.card),
    entry.sourceBoard,
    true,
  )
}
function removeEntry(entry: BoardEntry) {
  deckStore.removeCardFromBoard(identity(entry.card.card), entry.sourceBoard)
}
function moveEntry(entry: BoardEntry, board: VisibleBoard) {
  deckStore.moveCardBetweenBoards(
    identity(entry.card.card),
    entry.sourceBoard,
    board,
  )
}
function openMenu(event: MouseEvent, entry: BoardEntry) {
  menuEntry.value = entry
  menuX.value = event.clientX
  menuY.value = event.clientY
  menuOpen.value = true
}
function decrease() {
  if (menuEntry.value) deckStore.decreaseBoardQuantity(identity(menuEntry.value.card.card), menuEntry.value.sourceBoard)
  menuOpen.value = false
}
function increase() {
  if (menuEntry.value) deckStore.increaseBoardQuantity(identity(menuEntry.value.card.card), menuEntry.value.sourceBoard, true)
  menuOpen.value = false
}
function remove() {
  if (menuEntry.value) deckStore.removeCardFromBoard(identity(menuEntry.value.card.card), menuEntry.value.sourceBoard)
  menuOpen.value = false
}
function move(board: VisibleBoard) {
  if (!menuEntry.value) return
  deckStore.moveCardBetweenBoards(identity(menuEntry.value.card.card), menuEntry.value.sourceBoard, board)
  menuOpen.value = false
}
</script>

<style scoped>
.view-toggle-icon {
  fill: currentColor;
  height: 22px;
  width: 22px;
}

.deck-panel {
  overflow: visible;
  position: relative;
}

.board-header {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 620px);
}

.board-title {
  align-self: center;
  min-height: 32px;
}

.board-controls {
  align-items: center;
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  max-width: 100%;
  width: 100%;
}

.card-size-control {
  align-items: center;
  display: flex;
  flex: 0 0 126px;
  gap: 6px;
}

.card-size-control :deep(.v-slider) {
  margin: 0;
}

.deck-card-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(100%, var(--deck-card-min-width)), 1fr)
  );
}

@media (max-width: 900px) {
  .board-header {
    grid-template-columns: minmax(0, 1fr);
  }

  .board-controls {
    grid-column: 1;
    grid-row: auto;
    width: 100%;
  }
}

.board-header--accordion {
  cursor: pointer;
  min-height: 44px;
  padding: 6px 12px;
  transition: background-color 120ms ease;
}

.board-header:not(.board-header--accordion) {
  min-height: 44px;
  padding: 6px 12px;
}

.board-header--accordion:hover,
.board-header--accordion:focus-visible {
  background: rgb(var(--v-theme-accent-lighten-1));
  outline: none;
}

.board-section + .board-section {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.deck-list-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  white-space: normal;
}

.deck-list-item {
  transition:
    background-color 140ms ease,
    border-color 140ms ease;
}

.deck-list-item:hover,
.deck-list-item:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.055);
  border-color: rgba(var(--v-theme-primary), 0.45);
  outline: none;
}

.deck-grid-card {
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    transform 140ms ease;
}

.deck-grid-card:hover,
.deck-grid-card:focus-visible {
  border-color: rgba(var(--v-theme-primary), 0.58);
  box-shadow:
    0 0 0 1px rgba(var(--v-theme-primary), 0.22),
    0 0 12px rgba(var(--v-theme-primary), 0.2);
  outline: none;
  transform: translateY(-1px);
}

.deck-list-item.deck-item--selected {
  background: rgba(var(--v-theme-primary), 0.09);
  border-color: rgba(var(--v-theme-primary), 0.62);
}

.deck-grid-card.deck-item--selected {
  border-color: rgba(var(--v-theme-primary), 0.72);
  box-shadow:
    0 0 0 1px rgba(var(--v-theme-primary), 0.3),
    0 0 10px rgba(var(--v-theme-primary), 0.16);
}

</style>
