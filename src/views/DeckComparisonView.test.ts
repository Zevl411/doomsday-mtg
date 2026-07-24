import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDeck } from '../models/createDeck'
import vuetify from '../plugins/vuetify'
import DeckComparisonView from './DeckComparisonView.vue'

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  openDeck: vi.fn(),
  decks: [] as ReturnType<typeof createEmptyDeck>[],
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { deckId: 'deck-1' } }),
}))
vi.mock('../stores/deck', () => ({
  useDeckStore: () => ({
    library: { decks: mocks.decks },
    openDeck: mocks.openDeck,
  }),
}))
vi.mock('../repositories/deckComparisonRepository', () => ({
  deckComparisonRepository: { compare: mocks.compare },
}))
beforeEach(() => {
  mocks.compare.mockReset()
  mocks.openDeck.mockReset()
  mocks.decks.splice(0)
})

function personalDeck() {
  const deck = createEmptyDeck('Personal Deck')
  deck.id = 'deck-1'
  deck.commander = {
    id: 'commander',
    name: 'Kinnan, Bonder Prodigy',
    type_line: 'Legendary Creature',
    color_identity: ['G', 'U'],
  }
  deck.cards = [{
    card: {
      id: 'sol-ring-printing',
      oracle_id: 'sol-ring',
      name: 'Sol Ring',
      type_line: 'Artifact',
      color_identity: [],
    },
    quantity: 1,
  }]
  return deck
}

describe('DeckComparisonView', () => {
  it('shows a missing Deck state', async () => {
    const wrapper = mount(DeckComparisonView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Deck not found')
    expect(mocks.compare).not.toHaveBeenCalled()
  })

  it('requires a Commander', async () => {
    const deck = createEmptyDeck('Empty')
    deck.id = 'deck-1'
    mocks.decks.push(deck)
    const wrapper = mount(DeckComparisonView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Select a Commander')
  })

  it('compares a Commander deck with an empty mainboard', async () => {
    const deck = personalDeck()
    deck.cards = []
    mocks.decks.push(deck)
    mocks.compare.mockResolvedValue({ inclusion: [], similarities: [] })

    const wrapper = mount(DeckComparisonView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()

    expect(mocks.compare).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.any(Object),
    )
    expect(wrapper.text()).not.toContain(
      'Add at least one mainboard card',
    )
  })

  it('renders summary categories, sample status, and similar Deck links', async () => {
    mocks.decks.push(personalDeck())
    mocks.compare.mockResolvedValue({
      inclusion: [{
        normalizedCardKey: 'sol-ring',
        oracleId: 'sol-ring',
        cardName: 'Sol Ring',
        typeLine: 'Artifact',
        colorIdentity: [],
        deckCount: 16,
        totalEligibleDecks: 20,
        inclusionRate: 0.8,
        averageQuantity: 1,
        top16DeckCount: 8,
        top16InclusionRate: 0.8,
        firstPlaceDeckCount: 2,
        firstPlaceInclusionRate: 1,
      }, {
        normalizedCardKey: 'rhystic-study',
        oracleId: 'rhystic-study',
        cardName: 'Rhystic Study',
        typeLine: 'Enchantment',
        colorIdentity: ['U'],
        deckCount: 14,
        totalEligibleDecks: 20,
        inclusionRate: 0.7,
        averageQuantity: 1,
        top16DeckCount: 7,
        top16InclusionRate: 0.7,
        firstPlaceDeckCount: 1,
        firstPlaceInclusionRate: 0.5,
      }],
      similarities: [{
        tournamentDeckId: 'tournament-deck',
        tournamentName: 'Championship',
        sharedCardCount: 1,
        unionCardCount: 99,
        similarityRate: 1 / 99,
        source: 'topdeck',
      }],
    })
    const wrapper = mount(DeckComparisonView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('20 eligible Decks')
    expect(wrapper.text()).toContain('Aggregate overlap')
    expect(wrapper.text()).toContain('Shared Core')
    expect(wrapper.text()).toContain('Championship')
    expect(wrapper.text()).toContain('View Deck')
    const cardImage = wrapper.findComponent({ name: 'VImg' })
    expect(cardImage.props('src')).toContain(
      '/cards/named?exact=Sol%20Ring&format=image&version=small',
    )
    expect(wrapper.find('img[alt="Sol Ring card"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Cards in Your Deck row 1"]').text())
      .toBe('1')
    expect(wrapper.find('tbody tr').classes()).toContain(
      'comparison-row--high',
    )
    expect(wrapper.text()).toContain('In my Deck · 75%+')
    expect(wrapper.text()).toContain('Cards in Your Deck')
    expect(wrapper.text()).toContain('Usual Inclusions Not in Your Deck')
    expect(wrapper.text()).toContain('Rhystic Study')
    expect(wrapper.text().indexOf('Cards in Your Deck')).toBeLessThan(
      wrapper.text().indexOf('Usual Inclusions Not in Your Deck'),
    )
    expect(wrapper.find('.comparison-mobile-filter-panel').exists()).toBe(true)
    const mobileStatsPanel = wrapper.get('.comparison-mobile-stats-panel')
    await mobileStatsPanel.get('button').trigger('click')
    expect(mobileStatsPanel.text()).toContain('20 eligible Decks')
    expect(mobileStatsPanel.text()).toContain(
      'Aggregate overlap is the share of cards',
    )
    const mobileCard = wrapper.get('.comparison-mobile-card')
    expect(mobileCard.text()).toContain('Inclusion')
    expect(mobileCard.text()).toContain('Average quantity')
    expect(
      mobileCard.findComponent({ name: 'VImg' }).props('cover'),
    ).toBe(false)
  })

  it('shows limited sample and repository failure states', async () => {
    const deck = personalDeck()
    mocks.decks.push(deck)
    mocks.compare.mockResolvedValueOnce({
      inclusion: [{
        normalizedCardKey: 'sol-ring',
        oracleId: 'sol-ring',
        cardName: 'Sol Ring',
        colorIdentity: [],
        deckCount: 4,
        totalEligibleDecks: 5,
        inclusionRate: 0.8,
        averageQuantity: 1,
        top16DeckCount: 4,
        top16InclusionRate: 0.8,
        firstPlaceDeckCount: 1,
        firstPlaceInclusionRate: 1,
      }],
      similarities: [],
    })
    const wrapper = mount(DeckComparisonView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('limited sample may be volatile')

    mocks.compare.mockRejectedValueOnce(new Error('Comparison failed.'))
    const applyButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Apply filters')
    expect(applyButton).toBeDefined()
    await applyButton!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Comparison failed.')
  })

  it('does not present missing normalized data as a zero-percent result', async () => {
    mocks.decks.push(personalDeck())
    mocks.compare.mockResolvedValue({
      inclusion: [],
      similarities: [],
    })
    const wrapper = mount(DeckComparisonView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('No comparison data')
    expect(wrapper.text()).toContain(
      'No complete tournament card data',
    )
    expect(wrapper.text()).not.toContain('Aggregate overlap')
    expect(wrapper.text()).not.toContain('0.0%')
  })
})
