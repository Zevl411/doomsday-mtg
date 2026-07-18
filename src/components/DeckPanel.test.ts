import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DeckPanel from './DeckPanel.vue'
import vuetify from '../plugins/vuetify'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'

const artifact: ScryfallCard = {
  id: 'artifact',
  name: 'Arcane Signet',
  type_line: 'Artifact',
  color_identity: [],
  cmc: 2,
  image_uris: {
    small: 'https://example.com/small.jpg',
    normal: 'https://example.com/normal.jpg',
    large: 'https://example.com/large.jpg',
  },
}
const island: ScryfallCard = {
  id: 'island',
  name: 'Island',
  type_line: 'Basic Land — Island',
  color_identity: ['U'],
  cmc: 0,
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  useDeckStore().createDeck()
})

function mountPanel() {
  return mount(DeckPanel, { global: { plugins: [vuetify] } })
}

describe('DeckPanel', () => {
  it('renders dedicated boards and merges considering into Maybeboard', () => {
    const store = useDeckStore()
    store.deck.cards = [{ card: artifact, quantity: 1 }]
    store.deck.sideboard = [{ card: island, quantity: 2 }]
    store.deck.considering = [{ card: artifact, quantity: 3 }]
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Mainboard (1)')
    expect(wrapper.text()).toContain('Sideboard (2)')
    expect(wrapper.text()).toContain('Maybeboard (3)')
    expect(wrapper.text()).not.toContain('Considering (')
  })

  it('shows full-card images in list view', async () => {
    useDeckStore().deck.cards = [{ card: artifact, quantity: 1 }]
    const wrapper = mountPanel()
    await wrapper.find('[aria-label="List view"]').trigger('click')

    expect(wrapper.find('img[src="https://example.com/small.jpg"]').exists())
      .toBe(true)
    expect(wrapper.text()).toContain('1× Arcane Signet')
  })

  it('offers independent primary and secondary sorting for every board', () => {
    const wrapper = mountPanel()

    expect(wrapper.findAllComponents({ name: 'VSelect' })).toHaveLength(6)
  })

  it('groups multi-type cards once and keeps the requested type order', () => {
    const store = useDeckStore()
    store.deck.cards = [
      {
        card: {
          ...artifact,
          id: 'legendary-artifact',
          name: 'Legendary Relic',
          type_line: 'Legendary Artifact',
        },
        quantity: 1,
      },
      {
        card: {
          ...artifact,
          id: 'double-faced-card',
          name: 'Front Creature // Back Land',
          type_line: 'Artifact // Land',
          card_faces: [
            {
              name: 'Front Creature',
              type_line: 'Legendary Creature — Human',
            },
            {
              name: 'Back Land',
              type_line: 'Land',
            },
          ],
        },
        quantity: 1,
      },
      {
        card: {
          ...artifact,
          id: 'artifact-creature',
          name: 'Artifact Creature',
          type_line: 'Artifact Creature — Construct',
        },
        quantity: 1,
      },
      {
        card: {
          ...artifact,
          id: 'artifact-land',
          name: 'Artifact Land',
          type_line: 'Artifact Land',
        },
        quantity: 1,
      },
      {
        card: {
          ...artifact,
          id: 'planeswalker',
          name: 'Test Planeswalker',
          type_line: 'Legendary Planeswalker — Test',
        },
        quantity: 1,
      },
    ]
    const wrapper = mountPanel()
    const groupLabels = wrapper.findAll('h3').map((heading) => heading.text())

    expect(groupLabels).toEqual([
      'Planeswalker',
      'Creature',
      'Artifact',
      'Land',
    ])
    expect(groupLabels).not.toContain('Legendary Artifact')
  })

  it('defaults to grid, renders both icons, and switches to list view', async () => {
    useDeckStore().deck.cards = [{ card: artifact, quantity: 1 }]
    const wrapper = mountPanel()

    const gridButton = wrapper.find('[aria-label="Grid view"]')
    const listButton = wrapper.find('[aria-label="List view"]')
    expect(gridButton.find('svg').exists()).toBe(true)
    expect(listButton.find('svg').exists()).toBe(true)
    expect(wrapper.text()).toContain('×1')
    expect(wrapper.find('[aria-label="Actions for Arcane Signet"]').exists())
      .toBe(false)

    await listButton.trigger('click')
    expect(wrapper.find('[aria-label="Actions for Arcane Signet"]').exists())
      .toBe(true)
    expect(gridButton.element.compareDocumentPosition(listButton.element))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('persists display preferences in browser-local storage', async () => {
    const wrapper = mountPanel()
    await wrapper.find('[aria-label="List view"]').trigger('click')
    wrapper.unmount()

    const saved = JSON.parse(
      localStorage.getItem('doomsday-mtg-deck-panel-preferences') ?? '{}',
    )
    expect(saved.viewMode).toBe('list')

    const restored = mountPanel()
    expect(
      restored.find('[aria-label="List view"]').classes(),
    ).toContain('v-btn--active')
  })
})
