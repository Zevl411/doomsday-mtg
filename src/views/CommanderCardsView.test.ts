import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../plugins/vuetify'
import CommanderCardsView from './CommanderCardsView.vue'

const { getCommanderCardInclusion, getCommanderIdentity, getLocationOptions } = vi.hoisted(() => ({
  getCommanderCardInclusion: vi.fn(),
  getCommanderIdentity: vi.fn(),
  getLocationOptions: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { commanderKey: 'kinnan' } }),
}))
vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCommanderCardInclusion,
    getCommanderIdentity,
    getLocationOptions,
  },
}))

beforeEach(() => {
  getCommanderCardInclusion.mockReset()
  getCommanderIdentity.mockReset()
  getCommanderIdentity.mockResolvedValue({
    name: 'Kinnan, Bonder Prodigy',
    colorIdentity: ['G', 'U'],
    imageUrls: ['https://cards.example/kinnan.jpg'],
  })
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
      imageUrl: 'https://cards.example/sol-ring.jpg',
    }])
    const wrapper = mount(CommanderCardsView, {
      global: {
        plugins: [vuetify],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('10 Decks')
    expect(wrapper.text()).toContain('Kinnan, Bonder Prodigy')
    expect(wrapper.find('img[alt*="Commander 1"]').attributes('src'))
      .toContain('kinnan.jpg')
    expect(wrapper.text()).toContain('Sol Ring')
    expect(wrapper.text()).toContain('Core')
    expect(wrapper.text()).toContain('80.0% inclusion')
    const inclusionChip = wrapper.findAll('.v-chip')
      .find((chip) => chip.text().includes('80.0% inclusion'))
    expect(inclusionChip?.attributes('style')).toContain('color:')
    expect(inclusionChip?.classes()).toContain('v-chip--variant-outlined')
    expect(wrapper.text()).toContain('Top 16: 50.0%')
    expect(wrapper.text()).not.toContain('Average quantity')
    expect(wrapper.find('img[alt="Sol Ring card image"]').attributes('src'))
      .toContain('sol-ring.jpg')
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
