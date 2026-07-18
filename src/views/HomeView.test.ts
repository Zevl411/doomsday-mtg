import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDeck } from '../models/createDeck'
import vuetify from '../plugins/vuetify'
import { memoryDeckRepository } from '../repositories/localDeckRepository'
import { useDeckStore } from '../stores/deck'
import HomeView from './HomeView.vue'

const {
  getCommanderMetagame,
  getRecentTournaments,
  routerPush,
} = vi.hoisted(() => ({
  getCommanderMetagame: vi.fn(),
  getRecentTournaments: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCommanderMetagame,
    getRecentTournaments,
  },
}))

vi.mock('vue-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('vue-router')>()
  return {
    ...original,
    useRouter: () => ({ push: routerPush }),
  }
})

beforeEach(() => {
  setActivePinia(createPinia())
  routerPush.mockReset()
  getCommanderMetagame.mockReset().mockResolvedValue([])
  getRecentTournaments.mockReset().mockResolvedValue([])
})

describe('HomeView', () => {
  it('creates a new Deck when the hero action is clicked', async () => {
    const store = useDeckStore()
    store.useRepository(memoryDeckRepository, 'cloud')
    const existingDeck = store.createDeck('Existing Deck')

    const wrapper = mount(HomeView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()

    const startButton = wrapper.findAll('.v-btn')
      .find((button) => button.text().includes('Start building'))
    await startButton?.trigger('click')

    expect(store.activeDeckId).not.toBe(existingDeck.id)
    expect(store.activeDeck?.name).toBe('Untitled Deck')
    expect(store.activeDeck?.cards).toEqual([])
    expect(routerPush).toHaveBeenCalledWith({ name: 'deck-builder' })
  })

  it('shows only the four most recently edited decks in newest-first order', async () => {
    const store = useDeckStore()
    store.useRepository(memoryDeckRepository, 'cloud')
    const decks = Array.from({ length: 5 }, (_, index) => {
      const deck = createEmptyDeck(`Deck ${index + 1}`)
      deck.updatedAt = `2026-07-0${index + 1}T00:00:00.000Z`
      return deck
    })
    store.library = {
      version: 1,
      activeDeckId: decks[0]!.id,
      decks,
    }

    const wrapper = mount(HomeView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()

    const text = wrapper.text()
    expect(text).not.toContain('Deck 1')
    expect(text.indexOf('Deck 5')).toBeLessThan(text.indexOf('Deck 4'))
    expect(text).toContain('Deck 2')
  })

  it('renders Commander and recent tournament snapshots', async () => {
    getCommanderMetagame.mockResolvedValue([{
      commanderKey: 'kinnan',
      commanderName: 'Kinnan',
      colorIdentity: ['G', 'U'],
      entries: 10,
      tournaments: 2,
      wins: 20,
      losses: 10,
      draws: 0,
      matchWinRate: 2 / 3,
      top16Finishes: 4,
      topCutRate: 0.4,
      firstPlaceFinishes: 1,
      metaShare: 0.25,
    }])
    getRecentTournaments.mockResolvedValue([{
      id: 'event',
      source: 'edhtop16',
      sourceTournamentId: 'source-event',
      name: 'Championship',
      date: '2026-07-01T00:00:00.000Z',
      playerCount: 64,
      importedAt: '2026-07-02T00:00:00.000Z',
    }])

    const wrapper = mount(HomeView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Kinnan')
    expect(wrapper.text()).toContain('25.0% of the field')
    expect(wrapper.text()).toContain('Championship')
    expect(wrapper.text()).toContain('64 players')
  })
})
