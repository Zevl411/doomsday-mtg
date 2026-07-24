import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../plugins/vuetify'
import { createEmptyDeck } from '../models/createDeck'
import { memoryDeckRepository } from '../repositories/localDeckRepository'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'
import DeckRecommendationsPanel from './DeckRecommendationsPanel.vue'

const {
  getCardInclusionOverTime,
  getCardsByExactNames,
  getSuggestionEvidence,
} = vi.hoisted(() => ({
  getCardInclusionOverTime: vi.fn(),
  getCardsByExactNames: vi.fn(),
  getSuggestionEvidence: vi.fn(),
}))

vi.mock('../api/scryfall', () => ({
  getCardsByExactNames,
}))

vi.mock('../repositories/associationSuggestionRepository', () => ({
  associationSuggestionRepository: {
    getSuggestionEvidence,
  },
}))

vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCardInclusionOverTime,
  },
}))

const sourceOracleId = '11111111-1111-4111-8111-111111111111'
const suggestionOracleId = '22222222-2222-4222-8222-222222222222'

function card(
  id: string,
  oracleId: string,
  name: string,
): ScryfallCard {
  return {
    id,
    oracle_id: oracleId,
    name,
    type_line: 'Artifact',
    color_identity: [],
    image_uris: {
      small: `${id}-small.jpg`,
      normal: `${id}-normal.jpg`,
      large: `${id}-large.jpg`,
    },
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  getSuggestionEvidence.mockResolvedValue([{
    commanderKey: 'test commander',
    sourceOracleId,
    sourceCardName: 'Source Card',
    suggestedOracleId: suggestionOracleId,
    suggestedCardName: 'Suggested Card',
    support: 0.4,
    confidence: 0.5,
    lift: 1.5,
    occurrenceCount: 10,
    jointDeckCount: 10,
    sourceDeckCount: 20,
    sampleSize: 25,
  }])
  getCardsByExactNames.mockResolvedValue([
    card('suggested', suggestionOracleId, 'Suggested Card'),
  ])
  getCardInclusionOverTime.mockResolvedValue([])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DeckRecommendationsPanel', () => {
  it('closes recommendation details from the header button', async () => {
    const deckStore = useDeckStore()
    deckStore.useRepository(memoryDeckRepository, 'cloud')
    deckStore.createDeck('Test Deck')
    deckStore.setCommander(card(
      'commander',
      '33333333-3333-4333-8333-333333333333',
      'Test Commander',
    ))
    deckStore.addCard(card('source', sourceOracleId, 'Source Card'))

    const wrapper = mount(DeckRecommendationsPanel, {
      attachTo: document.body,
      global: { plugins: [vuetify] },
    })
    await flushPromises()

    const controls = wrapper.get('.recommendation-card__controls')
    expect(controls.get('.recommendation-card__metrics').attributes(
      'aria-label',
    )).toBe('1 supporting card; 25 Deck sample')
    expect(controls.find(
      '[aria-label="Add Suggested Card to Mainboard"]',
    ).exists()).toBe(true)

    await wrapper.get('.recommendation-card').trigger('click')
    await flushPromises()
    const dialog = wrapper.getComponent({ name: 'VDialog' })
    expect(dialog.props('modelValue')).toBe(true)

    const closeButton = document.querySelector<HTMLElement>(
      '[aria-label="Close recommendation details"]',
    )
    expect(closeButton).not.toBeNull()
    closeButton!.click()
    await flushPromises()

    expect(dialog.props('modelValue')).toBe(false)
    wrapper.unmount()
  })

  it('loads an external Deck without exposing add actions in read-only mode', async () => {
    const externalDeck = createEmptyDeck('Public Deck')
    externalDeck.commander = card(
      'commander',
      '33333333-3333-4333-8333-333333333333',
      'Test Commander',
    )
    externalDeck.cards = [{
      card: card('source', sourceOracleId, 'Source Card'),
      quantity: 1,
    }]

    const wrapper = mount(DeckRecommendationsPanel, {
      props: {
        deck: externalDeck,
        readOnly: true,
      },
      attachTo: document.body,
      global: { plugins: [vuetify] },
    })
    await flushPromises()

    expect(wrapper.find('.recommendation-card').exists()).toBe(true)
    expect(wrapper.find(
      '[aria-label="Add Suggested Card to Mainboard"]',
    ).exists()).toBe(false)

    await wrapper.get('.recommendation-card').trigger('click')
    await flushPromises()
    expect(document.body.textContent).not.toContain('Add to board')
    wrapper.unmount()
  })
})
