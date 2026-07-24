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
  it('shows commander and quantity-based board counts', () => {
    const deck = createEmptyDeck('Library Deck')
    deck.commander = commander
    deck.cards = [{ card: commander, quantity: 3 }]
    deck.sideboard = [{ card: commander, quantity: 2 }]

    const wrapper = mount(DeckLibraryCard, {
      props: { deck, canCompare: true },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.text()).not.toContain('Active')
    expect(wrapper.find('.deck-card-actions').exists()).toBe(true)
    expect(wrapper.findAll('.deck-action-icon')).toHaveLength(4)
    expect(
      wrapper.find('button[aria-label="Open deck actions"]').exists(),
    ).toBe(true)
    expect(
      wrapper
        .get('.deck-card-content-header')
        .findAll('.deck-card-menu-icon circle'),
    ).toHaveLength(3)
    expect(wrapper.text()).toContain('Library Deck')
    expect(wrapper.text()).toContain('The Commander')
    expect(wrapper.text()).toContain('Main 3')
    expect(wrapper.text()).toContain('Side 2')
    expect(wrapper.text()).toContain('4 cards including commander')
  })

  it.each([
    ['public', 'Public deck'],
    ['unlisted', 'Unlisted deck'],
    ['private', 'Private deck'],
  ] as const)('shows the %s visibility icon', (visibility, label) => {
    const deck = createEmptyDeck(`${visibility} deck`)
    deck.visibility = visibility
    const wrapper = mount(DeckLibraryCard, {
      props: { deck },
      global: { plugins: [vuetify] },
    })

    const icon = wrapper.get('.deck-visibility-icon')
    expect(icon.attributes('aria-label')).toBe(label)
    expect(icon.get('path').attributes('d')).toBeTruthy()
  })

  it('emits management intentions without mutating the deck', async () => {
    const deck = createEmptyDeck('Actions')
    const wrapper = mount(DeckLibraryCard, {
      props: { deck, canCompare: false },
      global: { plugins: [vuetify] },
    })

    await wrapper.get('.deck-card-title-button').trigger('click')
    await wrapper.get('button[aria-label="Duplicate deck"]').trigger('click')

    expect(wrapper.emitted('open')?.[0]).toEqual([deck.id])
    expect(wrapper.emitted('duplicate')?.[0]).toEqual([deck.id])
    expect(deck.name).toBe('Actions')
  })

  it('hides owner-only actions when displaying a public deck', () => {
    const deck = createEmptyDeck('Public Deck')
    const wrapper = mount(DeckLibraryCard, {
      props: { deck, manageable: false },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.find('.deck-card-actions').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Compare deck"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('button[aria-label="Rename deck"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('button[aria-label="Duplicate deck"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('button[aria-label="Delete deck"]').exists()).toBe(
      false,
    )
  })

  it('selects the deck instead of opening it in bulk-selection mode', async () => {
    const deck = createEmptyDeck('Selected Deck')
    const wrapper = mount(DeckLibraryCard, {
      props: { deck, selectable: true, selected: true },
      global: { plugins: [vuetify] },
    })

    await wrapper.get('.deck-card-title-button').trigger('click')

    expect(wrapper.classes()).toContain('deck-library-card--selected')
    expect(wrapper.find('.deck-selection-check').exists()).toBe(true)
    expect(wrapper.find('.deck-card-actions').exists()).toBe(false)
    expect(wrapper.emitted('toggleSelection')?.[0]).toEqual([deck.id])
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('selects a deck without a Commander from its empty artwork area', async () => {
    const deck = createEmptyDeck('No Commander')
    const wrapper = mount(DeckLibraryCard, {
      props: { deck, selectable: true },
      global: { plugins: [vuetify] },
    })

    await wrapper.get('.deck-summary-empty').trigger('click')

    expect(wrapper.emitted('toggleSelection')?.[0]).toEqual([deck.id])
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('emits comparison only when the parent marks the Deck eligible', async () => {
    const deck = createEmptyDeck('Comparison')
    const wrapper = mount(DeckLibraryCard, {
      props: { deck, canCompare: true },
      global: { plugins: [vuetify] },
    })
    const compare = wrapper.get('button[aria-label="Compare deck"]')
    await compare.trigger('click')
    expect(wrapper.emitted('compare')?.[0]).toEqual([deck.id])

    await wrapper.setProps({ canCompare: false })
    expect(compare?.attributes('disabled')).toBeDefined()
  })

  it('opens the deck when its Commander artwork is selected', async () => {
    const deck = createEmptyDeck('Artwork link')
    deck.commander = {
      ...commander,
      image_uris: {
        small: 'small.jpg',
        normal: 'normal.jpg',
        large: 'large.jpg',
        art_crop: 'art.jpg',
      },
    }
    const wrapper = mount(DeckLibraryCard, {
      props: { deck, canCompare: true },
      global: { plugins: [vuetify] },
    })

    const artwork = wrapper.get(
      'button[aria-label="Open Artwork link"]',
    )
    await artwork.trigger('click')

    expect(wrapper.emitted('open')?.[0]).toEqual([deck.id])
  })

  it('blends both Commander images for a partner deck', () => {
    const deck = createEmptyDeck('Partner artwork')
    deck.commander = {
      ...commander,
      image_uris: {
        small: 'primary-small.jpg',
        normal: 'primary-normal.jpg',
        large: 'primary-large.jpg',
        art_crop: 'primary-art.jpg',
      },
    }
    deck.partnerCommander = {
      ...commander,
      id: 'partner',
      name: 'The Partner',
      image_uris: {
        small: 'partner-small.jpg',
        normal: 'partner-normal.jpg',
        large: 'partner-large.jpg',
        art_crop: 'partner-art.jpg',
      },
    }
    const wrapper = mount(DeckLibraryCard, {
      props: { deck, canCompare: true },
      global: { plugins: [vuetify] },
    })

    const artworkLayers = wrapper.findAll('.deck-summary-art-layer')
    expect(artworkLayers).toHaveLength(2)
    expect(artworkLayers[0]?.attributes('class')).toContain(
      'deck-summary-art-layer--primary',
    )
    expect(artworkLayers[1]?.attributes('class')).toContain(
      'deck-summary-art-layer--partner',
    )
  })
})
