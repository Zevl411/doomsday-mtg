import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DeckPanel from './DeckPanel.vue'
import vuetify from '../plugins/vuetify'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'

const commander: ScryfallCard = {
  id: 'commander-printing',
  oracle_id: 'commander-oracle',
  name: 'Commander',
  type_line: 'Legendary Creature',
  color_identity: ['U'],
}
const artifact: ScryfallCard = {
  id: 'artifact-printing',
  oracle_id: 'artifact-oracle',
  name: 'Artifact',
  type_line: 'Artifact',
  color_identity: [],
}
const island: ScryfallCard = {
  id: 'island-printing',
  oracle_id: 'island-oracle',
  name: 'Island',
  type_line: 'Basic Land — Island',
  color_identity: ['U'],
}

beforeEach(() => {
  setActivePinia(createPinia())
})

function mountPanel() {
  return mount(DeckPanel, {
    global: {
      plugins: [vuetify],
      stubs: {
        CardSearch: {
          template: '<div data-test="card-search" />',
          emits: ['card-hovered', 'card-selected'],
        },
        VDialog: {
          props: ['modelValue'],
          template: '<div v-if="modelValue"><slot /></div>',
        },
      },
    },
  })
}

describe('DeckPanel', () => {
  it('renders entries, quantities, and quantity-based totals', () => {
    const store = useDeckStore()
    store.deck.commander = commander
    store.deck.cards = [
      { card: island, quantity: 3 },
      { card: artifact, quantity: 1 },
    ]
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('3× Island')
    expect(wrapper.text()).toContain('1× Artifact')
    expect(wrapper.text()).toContain('Main deck: 4')
    expect(wrapper.text()).toContain('5 / 100')
    wrapper.unmount()
  })

  it('removes cards and changes basic-land quantities', async () => {
    const store = useDeckStore()
    store.deck.commander = commander
    store.deck.cards = [{ card: island, quantity: 2 }]
    const wrapper = mountPanel()

    await wrapper
      .find('[aria-label="Increase quantity of Island"]')
      .trigger('click')
    expect(store.deck.cards[0]?.quantity).toBe(3)

    await wrapper
      .find('[aria-label="Decrease quantity of Island"]')
      .trigger('click')
    expect(store.deck.cards[0]?.quantity).toBe(2)

    await wrapper
      .find('[aria-label="Remove Island from deck"]')
      .trigger('click')
    expect(store.deck.cards).toHaveLength(0)
    wrapper.unmount()
  })

  it('prevents increasing a non-basic card', () => {
    const store = useDeckStore()
    store.deck.commander = commander
    store.deck.cards = [{ card: artifact, quantity: 1 }]
    const wrapper = mountPanel()

    expect(
      wrapper
        .find('[aria-label="Increase quantity of Artifact"]')
        .attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })

  it('displays accurate local save status', async () => {
    const store = useDeckStore()
    const wrapper = mountPanel()

    store.saveSucceeded = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Saved locally')

    store.saveSucceeded = false
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Unable to save locally')
    wrapper.unmount()
  })

  it('resets the deck only after confirmation', async () => {
    const store = useDeckStore()
    store.deck.commander = commander
    store.deck.cards = [{ card: artifact, quantity: 1 }]
    const wrapper = mountPanel()

    const openButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Clear deck')
    await openButton?.trigger('click')
    expect(store.deck.cards).toHaveLength(1)

    const confirmButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Clear Deck')
    await confirmButton?.trigger('click')

    expect(store.deck.commander).toBeNull()
    expect(store.deck.cards).toHaveLength(0)
    wrapper.unmount()
  })
})
