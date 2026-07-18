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
  useDeckStore().createDeck()
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
      .find('[aria-label="Remove Island from mainboard"]')
      .trigger('click')
    expect(store.deck.cards).toHaveLength(0)
    wrapper.unmount()
  })

  it('warns before increasing a non-basic card and allows an override', async () => {
    const store = useDeckStore()
    store.deck.commander = commander
    store.deck.cards = [{ card: artifact, quantity: 1 }]
    const wrapper = mountPanel()

    await wrapper
      .find('[aria-label="Increase quantity of Artifact"]')
      .trigger('click')

    expect(wrapper.text()).toContain('Increase quantity anyway?')
    expect(store.deck.cards[0]?.quantity).toBe(1)

    const proceedButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Proceed anyway')
    await proceedButton?.trigger('click')

    expect(store.deck.cards[0]?.quantity).toBe(2)
    wrapper.unmount()
  })

  it('displays accurate local save status', async () => {
    const store = useDeckStore()
    const wrapper = mountPanel()

    store.saveSucceeded = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Saved as temporary draft')

    store.saveSucceeded = false
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Unable to save temporary draft')
    wrapper.unmount()
  })

  it('renders board tabs with quantity-based counts', () => {
    const store = useDeckStore()
    store.deck.sideboard = [{ card: artifact, quantity: 3 }]
    store.deck.maybeboard = [{ card: island, quantity: 2 }]
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Mainboard (0)')
    expect(wrapper.text()).toContain('Sideboard (3)')
    expect(wrapper.text()).toContain('Maybeboard (2)')
    expect(wrapper.text()).toContain('Considering (0)')
    wrapper.unmount()
  })

  it('sorts displayed cards by canonical name without mutating the store', () => {
    const store = useDeckStore()
    const cyclonicRift = {
      ...artifact,
      id: 'cyclonic-rift',
      oracle_id: 'cyclonic-rift-oracle',
      name: 'Cyclonic Rift',
      flavor_name: "Hope's Aero Magic",
    }
    const arcaneSignet = {
      ...artifact,
      id: 'arcane-signet',
      oracle_id: 'arcane-signet-oracle',
      name: 'Arcane Signet',
    }
    store.deck.cards = [
      { card: cyclonicRift, quantity: 1 },
      { card: arcaneSignet, quantity: 1 },
    ]
    const wrapper = mountPanel()
    const text = wrapper.text()

    expect(text.indexOf('Arcane Signet')).toBeLessThan(
      text.indexOf('Cyclonic Rift'),
    )
    expect(store.deck.cards.map((entry) => entry.card.name)).toEqual([
      'Cyclonic Rift',
      'Arcane Signet',
    ])
    wrapper.unmount()
  })

  it('defaults the search destination to the mainboard', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Add search results to')
    expect(wrapper.text()).toContain('Mainboard')
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
