import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import CommanderPanel from './CommanderPanel.vue'
import vuetify from '../plugins/vuetify'
import type { Deck } from '../models/deck'
import { createEmptyDeck } from '../models/createDeck'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'

const commander: ScryfallCard = {
  id: 'commander',
  oracle_id: 'commander-oracle',
  name: 'Sisay, Weatherlight Captain',
  type_line: 'Legendary Creature — Human Soldier',
  color_identity: ['W', 'U', 'B', 'R', 'G'],
}

beforeEach(() => {
  setActivePinia(createPinia())
  useDeckStore().createDeck()
})

function mountPanel(
  props: {
    searchOnly?: boolean
    displayOnly?: boolean
    displayTarget?: 'commander' | 'partner'
    compactDisplay?: boolean
    deck?: Deck
    readOnly?: boolean
  } = {},
) {
  return mount(CommanderPanel, {
    props,
    global: {
      plugins: [vuetify],
      stubs: {
        CardSearch: {
          template:
            '<button data-test="commander-search" @click="$emit(\'cleared\')">Card search</button>',
          emits: ['cleared'],
        },
        VMenu: {
          name: 'VMenu',
          props: ['modelValue', 'target'],
          template:
            '<div data-test="commander-menu" :data-open="modelValue"><slot /></div>',
        },
      },
    },
  })
}

describe('CommanderPanel', () => {
  it('shows a Commander search in the empty display panel', () => {
    const wrapper = mountPanel({ displayOnly: true })

    expect(wrapper.text()).toContain('Choose your Commander')
    expect(wrapper.text()).toContain(
      'Search for a legendary card to establish this deck’s color identity.',
    )
    expect(wrapper.find('[data-test="commander-search"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows Commander search and the selected Commander together', () => {
    const store = useDeckStore()
    store.setCommander(commander)
    const wrapper = mountPanel()

    expect(wrapper.find('[data-test="commander-search"]').exists()).toBe(true)
    expect(wrapper.find('.commander-name').exists()).toBe(false)
    expect(wrapper.find('.commander-type').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Clear commander')
    wrapper.unmount()
  })

  it('clears the selected Commander without removing search', async () => {
    const store = useDeckStore()
    store.setCommander(commander)
    const wrapper = mountPanel()

    await wrapper.find('[data-test="commander-search"]').trigger('click')

    expect(store.deck.commander).toBeNull()
    expect(wrapper.find('[data-test="commander-search"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('previews the selected Commander on hover and keyboard focus', async () => {
    const store = useDeckStore()
    store.setCommander(commander)
    const wrapper = mountPanel()
    const selectedCommander = wrapper.find(
      '[aria-label="Selected Commander"]',
    )

    await selectedCommander.trigger('mouseenter')
    expect(store.previewCard).toEqual(commander)

    store.clearPreviewCard()
    await selectedCommander.trigger('focusin')
    expect(store.previewCard).toEqual(commander)
    wrapper.unmount()
  })

  it('pins and unpins the Commander preview when selected', async () => {
    const store = useDeckStore()
    store.setCommander(commander)
    const wrapper = mountPanel()
    const selectedCommander = wrapper.find(
      '[aria-label="Selected Commander"]',
    )

    await selectedCommander.trigger('click')
    expect(store.selectedPreviewCard).toEqual(commander)
    expect(selectedCommander.classes()).toContain(
      'commander-choice--selected',
    )

    await selectedCommander.trigger('click')
    expect(store.selectedPreviewCard).toBeNull()
    expect(store.previewCard).toEqual(commander)
    expect(selectedCommander.classes()).not.toContain(
      'commander-choice--selected',
    )
    wrapper.unmount()
  })

  it('opens a removal menu when right-clicking the Commander', async () => {
    const store = useDeckStore()
    store.setCommander(commander)
    const wrapper = mountPanel({ displayOnly: true })

    await wrapper
      .find('[aria-label="Selected Commander"]')
      .trigger('contextmenu', { clientX: 40, clientY: 60 })

    const menu = wrapper.findComponent({ name: 'VMenu' })
    expect(menu.props('modelValue')).toBe(true)
    expect(wrapper.text()).toContain('Change printing')
    expect(wrapper.text()).toContain('Remove Commander')
    wrapper.unmount()
  })

  it('changes the selected Commander printing from its context menu', async () => {
    const store = useDeckStore()
    store.setCommander(commander)
    const wrapper = mountPanel({ displayOnly: true })
    const alternatePrinting = {
      ...commander,
      id: 'alternate-commander-printing',
      set: 'showcase',
      finishes: ['nonfoil', 'foil'],
      foil: true,
      image_uris: {
        small: 'https://example.com/commander-small.jpg',
        normal: 'https://example.com/commander.jpg',
        large: 'https://example.com/commander-large.jpg',
      },
    }

    await wrapper
      .find('[aria-label="Selected Commander"]')
      .trigger('contextmenu', { clientX: 40, clientY: 60 })
    await wrapper
      .findAllComponents({ name: 'VListItem' })
      .find((item) => item.props('title') === 'Change printing')
      ?.trigger('click')

    const dialog = wrapper.findComponent({ name: 'CardPrintingDialog' })
    expect(dialog.props('modelValue')).toBe(true)
    expect(dialog.props('allowFoil')).toBe(true)
    dialog.vm.$emit('selected', {
      printing: alternatePrinting,
      foil: true,
    })
    await wrapper.vm.$nextTick()

    expect(store.deck.commander).toEqual(alternatePrinting)
    expect(store.deck.commanderFoil).toBe(true)
    expect(wrapper.find('.foil-card-overlay').exists()).toBe(true)
    wrapper.unmount()
  })

  it('places compatible Partner search beside Commander search', () => {
    const store = useDeckStore()
    store.setCommander({
      ...commander,
      oracle_text: 'Partner',
    })
    const wrapper = mountPanel({ searchOnly: true })

    expect(wrapper.find('.compact-commander-searches').classes()).toContain(
      'compact-commander-searches--paired',
    )
    expect(wrapper.findAll('.compact-search-header').map(
      (header) => header.text(),
    )).toEqual(['Commander', 'Partner'])
    expect(wrapper.findAll('[data-test="commander-search"]')).toHaveLength(2)
    expect(wrapper.findAll('.compact-search-field')).toHaveLength(2)
    wrapper.unmount()
  })

  it('shows a compatible Partner search in an empty Partner panel', () => {
    const store = useDeckStore()
    store.setCommander({
      ...commander,
      oracle_text: 'Partner',
    })
    const wrapper = mountPanel({
      compactDisplay: true,
      displayOnly: true,
      displayTarget: 'partner',
    })

    expect(wrapper.text()).toContain('Choose your Partner')
    expect(wrapper.text()).toContain(
      'Search for a compatible partner for your Commander.',
    )
    expect(wrapper.find('[data-test="commander-search"]').exists()).toBe(true)
    expect(wrapper.classes()).toContain('commander-panel--compact')
    wrapper.unmount()
  })

  it('shows an external Commander without removal actions in read-only mode', async () => {
    const externalDeck = createEmptyDeck('Public Deck')
    externalDeck.commander = commander
    const wrapper = mountPanel({
      deck: externalDeck,
      displayOnly: true,
      readOnly: true,
    })

    await wrapper
      .find('[aria-label="Selected Commander"]')
      .trigger('contextmenu', { clientX: 40, clientY: 60 })

    expect(wrapper.find('[data-test="commander-search"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'VMenu' }).exists()).toBe(false)
    expect(useDeckStore().deck.commander).toBeNull()
  })
})
