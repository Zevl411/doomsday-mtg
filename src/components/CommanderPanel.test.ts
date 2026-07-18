import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import CommanderPanel from './CommanderPanel.vue'
import vuetify from '../plugins/vuetify'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'

const commander: ScryfallCard = {
  id: 'commander',
  name: 'Sisay, Weatherlight Captain',
  type_line: 'Legendary Creature — Human Soldier',
  color_identity: ['W', 'U', 'B', 'R', 'G'],
}

beforeEach(() => {
  setActivePinia(createPinia())
  useDeckStore().createDeck()
})

function mountPanel() {
  return mount(CommanderPanel, {
    global: {
      plugins: [vuetify],
      stubs: {
        CardSearch: {
          template:
            '<button data-test="commander-search" @click="$emit(\'cleared\')">Card search</button>',
          emits: ['cleared'],
        },
      },
    },
  })
}

describe('CommanderPanel', () => {
  it('shows Commander search and the selected Commander together', () => {
    const store = useDeckStore()
    store.setCommander(commander)
    const wrapper = mountPanel()

    expect(wrapper.find('[data-test="commander-search"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sisay, Weatherlight Captain')
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
})
