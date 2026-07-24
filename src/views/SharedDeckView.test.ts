import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDeck } from '../models/createDeck'
import type { ScryfallCard } from '../types/card'
import vuetify from '../plugins/vuetify'
import SharedDeckView from './SharedDeckView.vue'

const { getAccessible, routerPush } = vi.hoisted(() => ({
  getAccessible: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('../repositories/sharedDeckRepository', () => ({
  sharedDeckRepository: {
    getAccessible,
  },
}))

vi.mock('vue-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('vue-router')>()
  return {
    ...original,
    useRoute: () => ({ params: { deckId: 'public-deck' } }),
    useRouter: () => ({ push: routerPush }),
  }
})

const commander: ScryfallCard = {
  id: 'commander',
  name: 'Sisay, Weatherlight Captain',
  type_line: 'Legendary Creature — Human Soldier',
  color_identity: ['W', 'U', 'B', 'R', 'G'],
}

beforeEach(() => {
  setActivePinia(createPinia())
  routerPush.mockReset()
  const deck = createEmptyDeck('Shared Sisay')
  deck.id = 'public-deck'
  deck.commander = commander
  deck.creatorUsername = 'OracleUser'
  deck.description = 'A public tournament build.'
  getAccessible.mockResolvedValue(deck)
})

const readOnlyPanelStub = {
  props: {
    deck: Object,
    readOnly: Boolean,
  },
  template:
    '<div class="read-only-panel" :data-deck-id="deck?.id" :data-read-only="readOnly">{{ readOnly ? "readonly" : "editable" }}</div>',
}

describe('SharedDeckView', () => {
  it('uses the builder panel layout without editing controls', async () => {
    const wrapper = mount(SharedDeckView, {
      global: {
        plugins: [vuetify],
        stubs: {
          CardPreview: { template: '<div class="preview-stub" />' },
          CommanderPanel: {
            ...readOnlyPanelStub,
            name: 'CommanderPanel',
            props: {
              deck: Object,
              readOnly: Boolean,
              displayOnly: Boolean,
              displayTarget: String,
              compactDisplay: Boolean,
            },
          },
          DeckPanel: {
            ...readOnlyPanelStub,
            name: 'DeckPanel',
          },
          DeckRecommendationsPanel: {
            ...readOnlyPanelStub,
            name: 'DeckRecommendationsPanel',
          },
          DeckStatisticsPanel: {
            props: ['deck'],
            template: '<div class="statistics-stub" :data-deck-id="deck?.id" />',
          },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Shared Sisay')
    expect(wrapper.text()).toContain('Created by OracleUser')
    expect(wrapper.text()).toContain('Read only')
    expect(wrapper.find('.shared-deck-workspace').exists()).toBe(true)
    expect(wrapper.find('.workspace-preview').exists()).toBe(true)
    expect(wrapper.find('.workspace-deck').exists()).toBe(true)
    expect(wrapper.find('.workspace-statistics').exists()).toBe(true)
    expect(wrapper.findAll('.read-only-panel')).toHaveLength(3)
    expect(wrapper.getComponent({ name: 'CommanderPanel' }).props('readOnly'))
      .toBe(true)
    expect(wrapper.getComponent({ name: 'DeckPanel' }).props('readOnly'))
      .toBe(true)
    expect(wrapper.getComponent({
      name: 'DeckRecommendationsPanel',
    }).props('readOnly')).toBe(true)
    expect(wrapper.text()).not.toContain('Settings')
    expect(wrapper.text()).not.toContain('Import')
  })
})
