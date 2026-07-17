import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../plugins/vuetify'
import CommanderCardsView from './CommanderCardsView.vue'

const { getCommanderCardInclusion, getLocationOptions } = vi.hoisted(() => ({
  getCommanderCardInclusion: vi.fn(),
  getLocationOptions: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { commanderKey: 'kinnan' } }),
}))
vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: { getCommanderCardInclusion, getLocationOptions },
}))

beforeEach(() => {
  getCommanderCardInclusion.mockReset()
  getLocationOptions.mockReset()
  getLocationOptions.mockResolvedValue({
    countries: ['US'],
    states: ['FL'],
    regions: ['country:US/state:FL'],
    hasOnline: true,
  })
})

describe('CommanderCardsView', () => {
  it('shows sample size, descriptive tier, and inclusion counts', async () => {
    getCommanderCardInclusion.mockResolvedValue([{
      normalizedCardKey: 'sol-ring',
      cardName: 'Sol Ring',
      typeLine: 'Artifact',
      colorIdentity: [],
      deckCount: 8,
      totalEligibleDecks: 10,
      inclusionRate: 0.8,
      averageQuantity: 1,
      top16DeckCount: 4,
      top16InclusionRate: 0.8,
      firstPlaceDeckCount: 1,
      firstPlaceInclusionRate: 1,
    }])
    const wrapper = mount(CommanderCardsView, {
      global: {
        plugins: [vuetify],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('10 complete Decks')
    expect(wrapper.text()).toContain('Sol Ring')
    expect(wrapper.text()).toContain('Core')
    expect(wrapper.text()).toContain('8 / 10')
  })

  it('shows the insufficient-sample empty state', async () => {
    getCommanderCardInclusion.mockResolvedValue([])
    const wrapper = mount(CommanderCardsView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('No complete normalized Decks')
  })
})
