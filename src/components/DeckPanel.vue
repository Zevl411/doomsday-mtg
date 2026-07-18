<template>
  <v-card border color="surface" rounded="lg" variant="flat">
    <v-card-item>
      <v-card-title>Decklist</v-card-title>
      <v-card-subtitle>
        {{ deckSize.total }} / {{ deckSize.target }} cards
      </v-card-subtitle>
      <template #append>
        <v-btn-toggle v-model="viewMode" mandatory variant="outlined">
          <v-btn aria-label="Grid view" value="grid">
            <svg
              aria-hidden="true"
              class="view-toggle-icon"
              viewBox="0 0 24 24"
            >
              <path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />
            </svg>
          </v-btn>
          <v-btn aria-label="List view" value="list">
            <svg
              aria-hidden="true"
              class="view-toggle-icon"
              viewBox="0 0 24 24"
            >
              <path d="M4 5h3v3H4V5Zm5 0h11v3H9V5ZM4 10.5h3v3H4v-3Zm5 0h11v3H9v-3ZM4 16h3v3H4v-3Zm5 0h11v3H9v-3Z" />
            </svg>
          </v-btn>
        </v-btn-toggle>
      </template>
    </v-card-item>

    <v-card-text>
      <v-progress-linear
        :color="deckSize.overLimit ? 'error' : 'primary'"
        height="8"
        :model-value="Math.min(100, deckSize.total / deckSize.target * 100)"
        rounded
      />
      <v-alert
        v-if="violations.length"
        class="mt-3"
        density="compact"
        type="error"
        variant="tonal"
      >
        {{ violations.length }} mainboard card(s) are outside the Commander color
        identity.
        <v-btn size="small" variant="text" @click="deckStore.removeIllegalCards">
          Remove illegal cards
        </v-btn>
      </v-alert>

      <section
        v-for="board in boards"
        :key="board.value"
        class="board-section mt-6"
      >
        <div class="d-flex flex-wrap align-center ga-3 mb-3">
          <h2 class="text-h6">{{ board.title }} ({{ boardCount(board.value) }})</h2>
          <v-spacer />
          <v-select
            v-model="sortSettings[board.value].primary"
            density="compact"
            hide-details
            :items="sortOptions"
            label="Group by"
            style="max-width: 180px"
            variant="outlined"
          />
          <v-select
            v-model="sortSettings[board.value].secondary"
            density="compact"
            hide-details
            :items="sortOptions"
            label="Then by"
            style="max-width: 180px"
            variant="outlined"
          />
        </div>

        <template v-if="groupedCards(board.value).length">
          <div
            v-for="group in groupedCards(board.value)"
            :key="group.label"
            class="mb-5"
          >
            <h3 class="text-subtitle-2 text-medium-emphasis mb-2">
              {{ group.label }}
            </h3>
            <v-list
              v-if="viewMode === 'list'"
              bg-color="transparent"
              class="pa-0"
            >
              <v-list-item
                v-for="entry in group.cards"
                :key="`${entry.sourceBoard}-${identity(entry.card.card)}`"
                border
                class="mb-2"
                rounded="lg"
                :subtitle="entry.card.card.type_line"
                :title="`${entry.card.quantity}× ${entry.card.card.name}`"
                @contextmenu.prevent="openMenu($event, entry)"
                @mouseenter="deckStore.setPreviewCard(entry.card.card)"
              >
                <template #prepend>
                  <v-img
                    v-if="getCardImage(entry.card.card, 'small')"
                    :alt="entry.card.card.name"
                    class="mr-4 rounded"
                    cover
                    height="96"
                    :src="getCardImage(entry.card.card, 'small')"
                    width="69"
                  />
                </template>
                <template #append>
                  <v-btn
                    :aria-label="`Actions for ${entry.card.card.name}`"
                    icon="mdi-dots-vertical"
                    size="small"
                    variant="text"
                    @click="openMenu($event, entry)"
                  />
                </template>
              </v-list-item>
            </v-list>

            <v-row v-else dense>
              <v-col
                v-for="entry in group.cards"
                :key="`${entry.sourceBoard}-${identity(entry.card.card)}`"
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <v-card
                  border
                  class="overflow-hidden"
                  rounded="lg"
                  @contextmenu.prevent="openMenu($event, entry)"
                  @mouseenter="deckStore.setPreviewCard(entry.card.card)"
                >
                  <v-img
                    :alt="entry.card.card.name"
                    aspect-ratio="0.716"
                    cover
                    :src="getCardImage(entry.card.card)"
                  />
                  <v-chip
                    class="position-absolute ma-2"
                    style="top: 0; right: 0"
                    size="small"
                  >×{{ entry.card.quantity }}</v-chip>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </template>
        <v-sheet v-else class="pa-4 text-center text-medium-emphasis">
          This board is empty.
        </v-sheet>
      </section>
    </v-card-text>
  </v-card>

  <v-menu
    v-model="menuOpen"
    :target="[menuX, menuY]"
  >
    <v-list v-if="menuEntry" density="compact">
      <v-list-item prepend-icon="mdi-minus" title="Remove 1" @click="decrease" />
      <v-list-item prepend-icon="mdi-plus" title="Add 1" @click="increase" />
      <v-menu location="end">
        <template #activator="{ props }">
          <v-list-item prepend-icon="mdi-swap-horizontal" title="Move to" v-bind="props" />
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
        prepend-icon="mdi-delete"
        title="Remove"
        @click="remove"
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { DeckCard, TrackedDeckBoard } from '../models/deck'
import { useDeckStore } from '../stores/deck'
import { getCardIdentity } from '../utils/cardIdentity'
import { getCardImage } from '../utils/cardDisplay'
import { getColorIdentityViolations } from '../utils/deckLegality'
import { getDeckSizeStatus } from '../utils/deckValidation'

type VisibleBoard = 'mainboard' | 'sideboard' | 'maybeboard'
type SortKey = 'name' | 'mana' | 'type' | 'color'
interface BoardEntry { card: DeckCard; sourceBoard: TrackedDeckBoard }
interface DeckPanelPreferences {
  viewMode: 'list' | 'grid'
  sortSettings: Record<VisibleBoard, { primary: SortKey; secondary: SortKey }>
}

const deckStore = useDeckStore()
const preferencesStorageKey = 'doomsday-mtg-deck-panel-preferences'
const savedPreferences = loadPreferences()
const viewMode = ref<'list' | 'grid'>(savedPreferences.viewMode)
const menuOpen = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuEntry = ref<BoardEntry | null>(null)
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
const deckSize = computed(() => getDeckSizeStatus(deckStore.deck))
const violations = computed(() => getColorIdentityViolations(deckStore.deck))
const moveBoards = computed(() =>
  boards.filter((board) => board.value !== visibleBoard(menuEntry.value?.sourceBoard)),
)

watch(
  [viewMode, sortSettings],
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
      cards: cards.sort((a, b) =>
        sortValue(a.card, settings.secondary).localeCompare(
          sortValue(b.card, settings.secondary),
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
    viewMode: 'grid',
    sortSettings: {
      mainboard: { primary: 'type', secondary: 'name' },
      sideboard: { primary: 'type', secondary: 'name' },
      maybeboard: { primary: 'type', secondary: 'name' },
    },
  }
}
function loadPreferences(): DeckPanelPreferences {
  const defaults = defaultPreferences()
  try {
    const saved = JSON.parse(
      localStorage.getItem(preferencesStorageKey) ?? 'null',
    ) as Partial<DeckPanelPreferences> | null
    if (!saved) return defaults

    return {
      viewMode: saved.viewMode === 'list' ? 'list' : 'grid',
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
function validBoardSort(
  value: { primary: SortKey; secondary: SortKey } | undefined,
  fallback: { primary: SortKey; secondary: SortKey },
) {
  return {
    primary: isSortKey(value?.primary) ? value.primary : fallback.primary,
    secondary: isSortKey(value?.secondary) ? value.secondary : fallback.secondary,
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
        viewMode: viewMode.value,
        sortSettings,
      }),
    )
  } catch {
    // Browser privacy settings may disable storage. The in-memory choices
    // still work for the current page.
  }
}
function boardCount(board: VisibleBoard) {
  return entries(board).reduce((total, entry) => total + entry.card.quantity, 0)
}
function identity(card: DeckCard['card']) { return getCardIdentity(card) }
function visibleBoard(board?: TrackedDeckBoard): VisibleBoard {
  return board === 'considering' ? 'maybeboard' : board ?? 'mainboard'
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
</style>
