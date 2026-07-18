import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DeckBuilderHeader from './DeckBuilderHeader.vue'
import vuetify from '../plugins/vuetify'
import { useDeckStore } from '../stores/deck'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  useDeckStore().createDeck('Invalid Deck')
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
})
