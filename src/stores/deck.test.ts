import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ScryfallCard } from '../types/card'
import {
  guestDraftRepository,
  memoryDeckRepository,
} from '../repositories/localDeckRepository'
import { useDeckStore } from './deck'

function createCard(
  id: string,
  name: string,
  oracleId: string,
  typeLine = 'Artifact',
  colorIdentity: string[] = [],
): ScryfallCard {
  return {
    id,
    oracle_id: oracleId,
    name,
    type_line: typeLine,
    color_identity: colorIdentity,
  }
}

const commander = createCard(
  'commander-printing',
  'Commander',
  'commander-oracle',
  'Legendary Creature',
  ['U'],
)
const artifact = createCard(
  'artifact-printing',
  'Artifact',
  'artifact-oracle',
)
const island = createCard(
  'island-printing',
  'Island',
  'island-oracle',
  'Basic Land — Island',
  ['U'],
)

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  // Authenticated mode supports a multi-deck library without a local cache.
  useDeckStore().useRepository(memoryDeckRepository, 'cloud')
})

describe('deck library store', () => {
  it('creates and opens decks', () => {
    const store = useDeckStore()
    const first = store.createDeck(' First ')
    const second = store.createDeck('Second')

    expect(store.library.decks).toHaveLength(2)
    expect(store.deck.id).toBe(second.id)
    expect(store.openDeck(first.id)).toBe(true)
    expect(store.deck.name).toBe('First')
  })

  it('increments the default name for each unnamed deck', () => {
    const store = useDeckStore()

    expect(store.createDeck().name).toBe('Untitled Deck')
    expect(store.createDeck().name).toBe('Untitled Deck 2')
    expect(store.createDeck('   ').name).toBe('Untitled Deck 3')
    expect(store.createDeck('Named Deck').name).toBe('Named Deck')
    expect(store.createDeck().name).toBe('Untitled Deck 4')
  })

  it('renames a deck, trims its name, and rejects an empty name', () => {
    const store = useDeckStore()
    const deck = store.createDeck('Original')
    const oldUpdatedAt = deck.updatedAt
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'))

    expect(store.renameDeck(deck.id, '  Renamed  ')).toBe(true)
    expect(deck.name).toBe('Renamed')
    expect(deck.updatedAt).not.toBe(oldUpdatedAt)
    expect(store.renameDeck(deck.id, '   ')).toBe(false)
    expect(deck.name).toBe('Renamed')
    vi.useRealTimers()
  })

  it('duplicates without sharing mutable board data', () => {
    const store = useDeckStore()
    const source = store.createDeck('Source')
    store.addCardToBoard(artifact, 'sideboard', 2)

    const duplicate = store.duplicateDeck(source.id)

    expect(duplicate?.id).not.toBe(source.id)
    expect(duplicate?.name).toBe('Source Copy')
    expect(duplicate?.sideboard).not.toBe(source.sideboard)
    duplicate!.sideboard[0]!.quantity = 9
    expect(source.sideboard[0]?.quantity).toBe(2)
  })

  it('deletes a non-active deck without changing the active deck', () => {
    const store = useDeckStore()
    const first = store.createDeck('First')
    const second = store.createDeck('Second')

    expect(store.deleteDeck(first.id)).toBe(true)
    expect(store.deck.id).toBe(second.id)
    expect(store.library.decks).toHaveLength(1)
  })

  it('selects a fallback after deleting the active deck', () => {
    const store = useDeckStore()
    const first = store.createDeck('First')
    const second = store.createDeck('Second')

    store.deleteDeck(second.id)
    expect(store.deck.id).toBe(first.id)

    store.deleteDeck(first.id)
    expect(store.hasActiveDeck).toBe(false)
  })

  it('deletes multiple selected decks in one operation', () => {
    const store = useDeckStore()
    const first = store.createDeck('First')
    const second = store.createDeck('Second')
    const third = store.createDeck('Third')

    expect(store.deleteDecks([first.id, third.id])).toBe(2)
    expect(store.library.decks.map((deck) => deck.id)).toEqual([second.id])
    expect(store.deck.id).toBe(second.id)
  })

  it('editor actions affect only the active deck', () => {
    const store = useDeckStore()
    const first = store.createDeck('First')
    store.setCommander(commander)
    const second = store.createDeck('Second')

    store.setCommander(commander)
    store.addCard(artifact)

    expect(second.cards).toHaveLength(1)
    expect(first.cards).toHaveLength(0)
  })

  it('handles quantities, board moves, and removal on the active deck', () => {
    const store = useDeckStore()
    store.createDeck()
    store.setCommander(commander)
    store.addCard(island)
    store.addCard({ ...island, id: 'another-island' })
    expect(store.deck.cards[0]?.quantity).toBe(2)

    store.addCardToBoard(artifact, 'sideboard', 2)
    store.moveCardBetweenBoards('artifact-oracle', 'sideboard', 'maybeboard')
    expect(store.deck.sideboard).toHaveLength(0)
    expect(store.deck.maybeboard[0]?.quantity).toBe(2)

    store.removeCardFromBoard('artifact-oracle', 'maybeboard')
    expect(store.deck.maybeboard).toHaveLength(0)
  })

  it('merges matching auxiliary entries when moving without losing quantity', () => {
    const store = useDeckStore()
    store.createDeck()
    store.addCardToBoard(artifact, 'sideboard', 2)
    store.addCardToBoard(artifact, 'maybeboard', 3)

    const result = store.moveCardBetweenBoards(
      'artifact-oracle',
      'sideboard',
      'maybeboard',
    )

    expect(result.allowed).toBe(true)
    expect(store.deck.sideboard).toEqual([])
    expect(store.deck.maybeboard).toEqual([
      { card: artifact, quantity: 5 },
    ])
  })

  it('reset preserves identity and name but clears content', () => {
    const store = useDeckStore()
    const deck = store.createDeck('Keep Me')
    store.setCommander(commander)
    store.addCard(artifact)

    store.resetActiveDeck()

    expect(store.deck.id).toBe(deck.id)
    expect(store.deck.createdAt).toBe(deck.createdAt)
    expect(store.deck.name).toBe('Keep Me')
    expect(store.deck.commander).toBeNull()
    expect(store.deck.cards).toEqual([])
  })

  it('replaces only the active deck while preserving its identity', () => {
    const store = useDeckStore()
    const original = store.createDeck('Original')
    const other = store.createDeck('Other')
    store.openDeck(original.id)

    store.replaceActiveDeck({
      ...original,
      id: 'import-id',
      name: 'Imported',
      commander,
      cards: [{ card: artifact, quantity: 1 }],
    })

    expect(store.deck.id).toBe(original.id)
    expect(store.deck.createdAt).toBe(original.createdAt)
    expect(store.deck.name).toBe('Imported')
    expect(
      store.library.decks.find((deck) => deck.id === other.id),
    ).toEqual(other)
  })

  it('does not persist temporary preview state', () => {
    const store = useDeckStore()
    store.createDeck()
    store.setPreviewCard(artifact)
    store.setCommander(commander)

    expect(localStorage.length).toBe(0)
    store.clearPreviewCard()
    expect(store.previewCard).toEqual(commander)
  })

  it('restores the selected card after a temporary preview', () => {
    const store = useDeckStore()
    store.createDeck()

    store.selectPreviewCard(artifact)
    store.setPreviewCard(commander)
    expect(store.previewCard).toEqual(commander)

    store.restoreSelectedPreviewCard()
    expect(store.previewCard).toEqual(artifact)
    expect(store.selectedPreviewCard).toEqual(artifact)
  })

  it('deselects the active preview while retaining it as the fallback', () => {
    const store = useDeckStore()
    store.createDeck()

    store.selectPreviewCard(artifact)
    store.selectPreviewCard(artifact)

    expect(store.selectedPreviewCard).toBeNull()
    expect(store.previewCard).toEqual(artifact)

    store.setPreviewCard(commander)
    store.restoreSelectedPreviewCard()
    expect(store.previewCard).toEqual(commander)
  })

  it('keeps the preview empty when the deck has no commander or shown card', () => {
    const store = useDeckStore()
    const deck = store.createDeck('Commanderless')

    expect(deck.commander).toBeNull()
    store.clearPreviewCard()

    expect(store.previewCard).toBeNull()
    expect(store.lastPreviewCard).toBeNull()
  })

  it('does not update timestamps for no-op editor and selection actions', () => {
    const store = useDeckStore()
    const deck = store.createDeck('Stable')
    const updatedAt = deck.updatedAt

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2028-01-01T00:00:00.000Z'))
    store.openDeck(deck.id)
    store.renameDeck(deck.id, ' Stable ')
    store.clearCommander()
    store.removeCardFromBoard('missing-card', 'mainboard')
    store.removeIllegalCards()

    expect(deck.updatedAt).toBe(updatedAt)
    vi.useRealTimers()
  })

  it('reports persistence failures without throwing', () => {
    const store = useDeckStore()
    store.useRepository(guestDraftRepository, 'guest')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    store.createDeck()
    expect(store.saveSucceeded).toBe(false)
  })
})
