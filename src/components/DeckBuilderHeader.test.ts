import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DeckBuilderHeader from './DeckBuilderHeader.vue'
import vuetify from '../plugins/vuetify'
import { useDeckStore } from '../stores/deck'

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
    const wrapper = mount(DeckBuilderHeader, {
      global: {
        plugins: [vuetify],
        stubs: {
          RouterLink: true,
        },
      },
    })

    const metadata = wrapper.find('.deck-header-metadata')
    expect(metadata.text()).toContain('private')
    expect(metadata.text()).toContain('Warning (1)')
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
