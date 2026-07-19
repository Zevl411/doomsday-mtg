import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createEmptyDeck } from '../models/createDeck'
import { guestDraftRepository } from '../repositories/localDeckRepository'
import { createSupabaseDeckRepository } from '../repositories/supabaseDeckRepository'
import {
  DECK_LIBRARY_STORAGE_KEY,
  GUEST_DRAFT_STORAGE_KEY,
  saveDeckLibrary,
} from '../utils/deckStorage'
import { useDeckStore } from './deck'
import { isMeaningfulGuestDraft, useDeckSyncStore } from './deckSync'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../repositories/supabaseDeckRepository', () => ({
  createSupabaseDeckRepository: vi.fn(),
}))

const loadDecks = vi.fn()
const loadDeck = vi.fn()
const saveDeck = vi.fn()
const deleteDeck = vi.fn()

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  loadDecks.mockReset().mockResolvedValue([])
  loadDeck.mockReset().mockResolvedValue(null)
  saveDeck.mockReset().mockResolvedValue(undefined)
  deleteDeck.mockReset().mockResolvedValue(undefined)
  vi.mocked(createSupabaseDeckRepository).mockReturnValue({
    loadDecks,
    loadDeck,
    saveDeck,
    deleteDeck,
  })
})

describe('deck synchronization store', () => {
  it('keeps guests in one browser draft', async () => {
    const deckStore = useDeckStore()
    const sync = useDeckSyncStore()

    await sync.handleUser(null)
    deckStore.createDeck('Guest Deck')

    expect(sync.syncStatus).toBe('local-only')
    expect(guestDraftRepository.loadLibrary().decks).toHaveLength(1)
    expect(saveDeck).not.toHaveBeenCalled()
  })

  it('loads Supabase as the authenticated source of truth', async () => {
    const cloudDeck = createEmptyDeck('Cloud Deck')
    loadDecks.mockResolvedValue([cloudDeck])

    await useDeckSyncStore().handleUser('user-a')

    expect(useDeckStore().decks).toEqual([cloudDeck])
    expect(useDeckStore().storageMode).toBe('cloud')
    expect(localStorage.length).toBe(0)
  })

  it('automatically transfers one meaningful guest draft and then clears it', async () => {
    const guest = createEmptyDeck('Guest Migration')
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: guest.id,
      decks: [guest],
    })
    loadDecks
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([guest])

    await useDeckSyncStore().handleUser('user-a')

    expect(saveDeck).toHaveBeenCalledOnce()
    expect(saveDeck).toHaveBeenCalledWith(guest)
    expect(useDeckStore().deck.id).toBe(guest.id)
    expect(localStorage.getItem(GUEST_DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('transfers every local Deck and removes them from browser storage', async () => {
    const first = createEmptyDeck('First Local Deck')
    const active = createEmptyDeck('Active Local Deck')
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: active.id,
      decks: [active],
    })
    saveDeckLibrary({
      version: 1,
      activeDeckId: active.id,
      decks: [first, active],
    })
    loadDecks
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([first, active])

    const sync = useDeckSyncStore()
    await sync.handleUser('user-a')

    expect(saveDeck).toHaveBeenCalledTimes(2)
    expect(saveDeck.mock.calls.map(([deck]) => deck.id)).toEqual([
      first.id,
      active.id,
    ])
    expect(useDeckStore().decks).toEqual([first, active])
    expect(useDeckStore().deck.id).toBe(active.id)
    expect(localStorage.getItem(GUEST_DRAFT_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(DECK_LIBRARY_STORAGE_KEY)).toBeNull()

    await sync.handleUser(null)

    expect(useDeckStore().decks).toHaveLength(0)
    expect(useDeckStore().hasActiveDeck).toBe(false)
    expect(useDeckStore().decks.some((deck) => deck.id === first.id)).toBe(false)
    expect(useDeckStore().decks.some((deck) => deck.id === active.id)).toBe(false)
  })

  it('does not overwrite a cloud Deck already transferred with the same ID', async () => {
    const cloudDeck = createEmptyDeck('Cloud Version')
    const staleLocalDeck = { ...cloudDeck, name: 'Stale Local Version' }
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: staleLocalDeck.id,
      decks: [staleLocalDeck],
    })
    loadDecks
      .mockResolvedValueOnce([cloudDeck])
      .mockResolvedValueOnce([cloudDeck])

    await useDeckSyncStore().handleUser('user-a')

    expect(saveDeck).not.toHaveBeenCalled()
    expect(useDeckStore().decks).toEqual([cloudDeck])
    expect(localStorage.getItem(GUEST_DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('increments duplicate local titles while preserving every Deck', async () => {
    const cloudDeck = createEmptyDeck('Primer')
    const firstLocal = createEmptyDeck('Primer')
    const secondLocal = createEmptyDeck('Primer')
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: secondLocal.id,
      decks: [secondLocal],
    })
    saveDeckLibrary({
      version: 1,
      activeDeckId: secondLocal.id,
      decks: [firstLocal, secondLocal],
    })
    const firstCopy = { ...firstLocal, name: 'Primer 2' }
    const secondCopy = { ...secondLocal, name: 'Primer 3' }
    loadDecks
      .mockResolvedValueOnce([cloudDeck])
      .mockResolvedValueOnce([cloudDeck, firstCopy, secondCopy])

    await useDeckSyncStore().handleUser('user-a')

    expect(saveDeck.mock.calls.map(([deck]) => deck.name)).toEqual([
      'Primer 2',
      'Primer 3',
    ])
    expect(useDeckStore().decks.map((deck) => deck.name)).toEqual([
      'Primer',
      'Primer 2',
      'Primer 3',
    ])
  })

  it('deduplicates concurrent and repeated sign-in initialization', async () => {
    const guest = createEmptyDeck('One Transfer')
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: guest.id,
      decks: [guest],
    })
    loadDecks
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([guest])
    const sync = useDeckSyncStore()

    await Promise.all([
      sync.handleUser('user-a'),
      sync.handleUser('user-a'),
    ])
    await sync.handleUser('user-a')

    expect(saveDeck).toHaveBeenCalledOnce()
    expect(loadDecks).toHaveBeenCalledTimes(2)
  })

  it('does not upload an empty default draft', async () => {
    const empty = createEmptyDeck()
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: empty.id,
      decks: [empty],
    })

    await useDeckSyncStore().handleUser('user-a')

    expect(saveDeck).not.toHaveBeenCalled()
  })

  it('preserves the guest draft when transfer confirmation fails', async () => {
    const guest = createEmptyDeck('Safe Guest')
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: guest.id,
      decks: [guest],
    })
    loadDecks.mockResolvedValue([])

    await useDeckSyncStore().handleUser('user-a')

    expect(useDeckSyncStore().syncStatus).toBe('error')
    expect(localStorage.getItem(GUEST_DRAFT_STORAGE_KEY)).not.toBeNull()
  })

  it('keeps loaded cloud decks visible when guest transfer saving fails', async () => {
    const cloudDeck = createEmptyDeck('Existing Cloud Deck')
    const guest = createEmptyDeck('Guest Transfer')
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: guest.id,
      decks: [guest],
    })
    loadDecks.mockResolvedValueOnce([cloudDeck])
    saveDeck.mockRejectedValueOnce(new Error('schema cache mismatch'))

    await useDeckSyncStore().handleUser('user-a')

    expect(useDeckStore().decks).toEqual([cloudDeck])
    expect(useDeckSyncStore().syncStatus).toBe('error')
    expect(localStorage.getItem(GUEST_DRAFT_STORAGE_KEY)).not.toBeNull()
  })

  it('retries a failed guest transfer with the same stable ID', async () => {
    const guest = createEmptyDeck('Retry Guest')
    guestDraftRepository.saveLibrary({
      version: 1,
      activeDeckId: guest.id,
      decks: [guest],
    })
    loadDecks
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([guest])
    const sync = useDeckSyncStore()

    await sync.handleUser('user-a')
    await sync.retry()

    expect(saveDeck).toHaveBeenCalledTimes(2)
    expect(saveDeck.mock.calls.every(([deck]) => deck.id === guest.id)).toBe(true)
    expect(sync.syncStatus).toBe('synced')
    expect(useDeckStore().deck.id).toBe(guest.id)
  })

  it('preserves optimistic cloud edits when saving fails', async () => {
    const sync = useDeckSyncStore()
    await sync.handleUser('user-a')
    const deck = useDeckStore().createDeck('Offline Deck')
    saveDeck.mockRejectedValue(new Error('offline'))

    await sync.syncNow()

    expect(useDeckStore().deck.id).toBe(deck.id)
    expect(sync.syncStatus).toBe('error')
    expect(sync.hasUnsyncedChanges).toBe(true)
    expect(localStorage.length).toBe(0)
  })

  it('removes cloud decks from memory on logout without deleting or copying them', async () => {
    const cloudDeck = createEmptyDeck('Private Cloud Deck')
    loadDecks.mockResolvedValue([cloudDeck])
    const sync = useDeckSyncStore()
    await sync.handleUser('user-a')

    await sync.handleUser(null)

    expect(useDeckStore().decks).toHaveLength(0)
    expect(useDeckStore().hasActiveDeck).toBe(false)
    expect(useDeckStore().storageMode).toBe('guest')
    expect(deleteDeck).not.toHaveBeenCalled()
    expect(localStorage.getItem(GUEST_DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('does not let a stale cloud load overwrite guest state after logout', async () => {
    let finishLoad: ((decks: ReturnType<typeof createEmptyDeck>[]) => void) | undefined
    loadDecks.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoad = resolve
      }),
    )
    const sync = useDeckSyncStore()
    const signIn = sync.handleUser('user-a')

    await sync.handleUser(null)
    finishLoad?.([createEmptyDeck('Stale Private Deck')])
    await signIn

    expect(useDeckStore().storageMode).toBe('guest')
    expect(useDeckStore().decks).toHaveLength(0)
    expect(useDeckStore().hasActiveDeck).toBe(false)
  })
})

describe('meaningful guest draft detection', () => {
  it('ignores a new empty draft', () => {
    expect(isMeaningfulGuestDraft(createEmptyDeck())).toBe(false)
  })

  it('accepts a Commander, renamed deck, or card on every tracked board', () => {
    const commanderDeck = createEmptyDeck()
    commanderDeck.commander = {
      id: 'commander',
      name: 'Commander',
      type_line: 'Legendary Creature',
      color_identity: [],
    }
    expect(isMeaningfulGuestDraft(commanderDeck)).toBe(true)
    expect(isMeaningfulGuestDraft(createEmptyDeck('Named Deck'))).toBe(true)

    for (const board of ['cards', 'sideboard', 'maybeboard', 'considering'] as const) {
      const deck = createEmptyDeck()
      deck[board] = [{
        card: {
          id: `${board}-card`,
          name: 'Card',
          type_line: 'Artifact',
          color_identity: [],
        },
        quantity: 1,
      }]
      expect(isMeaningfulGuestDraft(deck)).toBe(true)
    }
  })
})
