import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../plugins/vuetify'
import CommanderCardsView from './CommanderCardsView.vue'

const {
  getCommanderCardInclusion,
  getCommanderIdentity,
  getLocationOptions,
  getCardInclusionOverTime,
} = vi.hoisted(() => ({
  getCommanderCardInclusion: vi.fn(),
  getCommanderIdentity: vi.fn(),
  getLocationOptions: vi.fn(),
  getCardInclusionOverTime: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { commanderKey: 'kinnan' } }),
}))
vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCommanderCardInclusion,
    getCommanderIdentity,
    getLocationOptions,
    getCardInclusionOverTime,
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
  getCardInclusionOverTime.mockReset()
  getCardInclusionOverTime.mockResolvedValue([])
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

  it('opens selectable inclusion history when a card is clicked', async () => {
    getCommanderCardInclusion.mockResolvedValue([{
      normalizedCardKey: 'sol-ring',
      oracleId: 'oracle-id',
      cardName: 'Sol Ring',
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
    getCardInclusionOverTime.mockResolvedValue([{
      periodStart: '2026-07-06',
      deckCount: 3,
      totalEligibleDecks: 4,
      eventCount: 2,
      inclusionRate: 0.75,
    }])
    const wrapper = mount(CommanderCardsView, {
      attachTo: document.body,
      global: {
        plugins: [vuetify],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    await wrapper
      .find('[aria-label="View Sol Ring inclusion history"]')
      .trigger('click')
    await flushPromises()

    expect(getCardInclusionOverTime).toHaveBeenCalledWith(
      'kinnan',
      expect.objectContaining({ normalizedCardKey: 'sol-ring' }),
      'week',
      expect.objectContaining({ minimumPlayers: 0 }),
    )
    expect(document.body.textContent).toContain('Inclusion over time')
    expect(document.body.textContent).toContain('Group data by')
    expect(document.body.textContent).toContain('75.0%')
    expect(document.body.textContent).toContain('fewer than five')
    expect(document.body.textContent).toContain('Inclusion (%)')
    expect(document.body.textContent).toContain('Week')
    expect(document.body.textContent).toContain('Jul 6')
    expect(document.body.textContent).not.toContain('Week starting')
    expect(document.body.querySelector('svg[tabindex="0"]')).not.toBeNull()
    wrapper.unmount()
  })
})
