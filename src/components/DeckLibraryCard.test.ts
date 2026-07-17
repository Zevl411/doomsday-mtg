import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyDeck } from '../models/createDeck'
import type { ScryfallCard } from '../types/card'
import vuetify from '../plugins/vuetify'
import DeckLibraryCard from './DeckLibraryCard.vue'

const commander: ScryfallCard = {
  id: 'commander',
  name: 'The Commander',
  type_line: 'Legendary Creature',
  color_identity: ['U'],
}

describe('DeckLibraryCard', () => {
  it('shows active status, commander, and quantity-based board counts', () => {
    const deck = createEmptyDeck('Library Deck')
    deck.commander = commander
    deck.cards = [{ card: commander, quantity: 3 }]
    deck.sideboard = [{ card: commander, quantity: 2 }]

    const wrapper = mount(DeckLibraryCard, {
      props: { deck, active: true },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Library Deck')
    expect(wrapper.text()).toContain('The Commander')
    expect(wrapper.text()).toContain('Main 3')
    expect(wrapper.text()).toContain('Side 2')
    expect(wrapper.text()).toContain('4 cards including commander')
  })

  it('emits management intentions without mutating the deck', async () => {
    const deck = createEmptyDeck('Actions')
    const wrapper = mount(DeckLibraryCard, {
      props: { deck, active: false },
      global: { plugins: [vuetify] },
    })

    const buttons = wrapper.findAll('button')
    await buttons.find((button) => button.text() === 'Open')?.trigger('click')
    await buttons
      .find((button) => button.text() === 'Duplicate')
      ?.trigger('click')

    expect(wrapper.emitted('open')?.[0]).toEqual([deck.id])
    expect(wrapper.emitted('duplicate')?.[0]).toEqual([deck.id])
    expect(deck.name).toBe('Actions')
  })
})
