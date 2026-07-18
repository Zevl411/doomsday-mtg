import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DeckStatisticsPanel from './DeckStatisticsPanel.vue'
import vuetify from '../plugins/vuetify'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'

const selectedCard: ScryfallCard = {
  id: 'selected-card',
  name: 'Selected Card',
  type_line: 'Instant',
  color_identity: ['U'],
  cmc: 1,
}

const curveCard: ScryfallCard = {
  id: 'curve-card',
  name: 'Curve Card',
  type_line: 'Artifact',
  color_identity: [],
  cmc: 2,
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  const store = useDeckStore()
  store.createDeck()
  store.deck.cards = [{ card: curveCard, quantity: 1 }]
})

describe('DeckStatisticsPanel', () => {
  it('shows the mana-curve line by default', () => {
    const wrapper = mount(DeckStatisticsPanel, {
      global: { plugins: [vuetify] },
    })

    expect(wrapper.find('.mana-curve__line').exists()).toBe(true)
    wrapper.unmount()
  })

  it('temporarily previews curve-list cards without selecting them', async () => {
    const store = useDeckStore()
    store.selectPreviewCard(selectedCard)
    const wrapper = mount(DeckStatisticsPanel, {
      global: { plugins: [vuetify] },
    })
    const item = wrapper.find('.mana-curve__card-item')

    expect(wrapper.find('.widget-header-bar').text()).toBe('Deck Statistics')
    await item.trigger('mouseenter')
    expect(store.previewCard).toEqual(curveCard)
    expect(store.selectedPreviewCard).toEqual(selectedCard)

    await item.trigger('click')
    expect(store.selectedPreviewCard).toEqual(selectedCard)

    await item.trigger('mouseleave')
    expect(store.previewCard).toEqual(selectedCard)
    wrapper.unmount()
  })
})
