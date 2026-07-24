import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DeckBuilderHeader from './DeckBuilderHeader.vue'
import vuetify from '../plugins/vuetify'
import { useDeckStore } from '../stores/deck'
import { useUserPreferencesStore } from '../stores/userPreferences'

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }))

vi.mock('vue-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('vue-router')>()
  return {
    ...original,
    useRouter: () => ({ push: routerPush }),
  }
})

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  useDeckStore().createDeck('Invalid Deck')
  routerPush.mockReset()
})

describe('DeckBuilderHeader', () => {
  it('shows deck validity beside visibility', () => {
    useDeckStore().deck.cards = [{
      card: {
        id: 'priced-card',
        name: 'Priced Card',
        type_line: 'Artifact',
        color_identity: [],
        prices: { usd: '3.25' },
      },
      quantity: 2,
    }]
    const wrapper = mount(DeckBuilderHeader, {
      global: {
        plugins: [vuetify],
        stubs: {
          RouterLink: true,
        },
      },
    })

    const metadata = wrapper.find('.deck-header-metadata')
    expect(metadata.text()).toContain('public')
    expect(metadata.text()).toContain('Warning')
    expect(metadata.text()).toContain('Deck total $6.50')
    wrapper.unmount()
  })

  it('swaps the header columns when search is preferred on the left', () => {
    useUserPreferencesStore().values.deckBuilderSearchSide = 'left'
    const wrapper = mount(DeckBuilderHeader, {
      global: {
        plugins: [vuetify],
        stubs: { RouterLink: true },
      },
    })

    expect(wrapper.find('.deck-builder-header').classes()).toContain(
      'deck-builder-header--search-left',
    )
    wrapper.unmount()
  })

  it('edits and saves the deck title inline', async () => {
    const wrapper = mount(DeckBuilderHeader, {
      attachTo: document.body,
      global: {
        plugins: [vuetify],
        stubs: { RouterLink: true },
      },
    })

    await wrapper.find('[aria-label="Edit deck title"]').trigger('click')
    const input = wrapper.find('input[aria-label="Deck title"]')
    expect(input.exists()).toBe(true)
    expect(input.element).toBe(document.activeElement)
    expect(
      wrapper.find('[aria-label="Edit deck title"]').classes(),
    ).toContain('editable-deck-title--editing')

    await input.setValue('Updated Deck')
    await input.trigger('keydown', { key: 'Enter' })

    expect(useDeckStore().deck.name).toBe('Updated Deck')
    expect(wrapper.find('input[aria-label="Deck title"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Edit deck title"]').text()).toBe(
      'Updated Deck',
    )
    wrapper.unmount()
  })

  it('confirms deletion from settings and returns to the deck library', async () => {
    const wrapper = mount(DeckBuilderHeader, {
      global: {
        plugins: [vuetify],
        stubs: {
          RouterLink: true,
          VDialog: { template: '<div><slot /></div>' },
        },
      },
    })

    await wrapper.findAll('.v-btn')
      .find((button) => button.text().includes('Settings'))
      ?.trigger('click')
    await wrapper.findAll('.v-btn')
      .find((button) => button.text().includes('Delete deck'))
      ?.trigger('click')

    expect(wrapper.text()).toContain('Delete this deck?')
    expect(wrapper.text()).toContain(
      'permanently removes “Invalid Deck” from this browser',
    )

    const deleteButtons = wrapper.findAll('.v-btn')
      .filter((button) => button.text().trim() === 'Delete')
    await deleteButtons.at(-1)?.trigger('click')

    expect(useDeckStore().decks).toEqual([])
    expect(routerPush).toHaveBeenCalledWith({ name: 'deck-library' })
    wrapper.unmount()
  })
})
