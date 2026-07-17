import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CardPreview from './CardPreview.vue'
import vuetify from '../plugins/vuetify'
import type { ScryfallCard } from '../types/card'

function mountPreview(card: ScryfallCard | null) {
  return mount(CardPreview, {
    props: { card },
    global: {
      plugins: [vuetify],
    },
  })
}

describe('CardPreview', () => {
  it('renders the empty placeholder', () => {
    const wrapper = mountPreview(null)

    expect(wrapper.text()).toContain('Hover over a search result')
    wrapper.unmount()
  })

  it('renders a single-faced card and its preferred image', () => {
    const card: ScryfallCard = {
      id: 'card-printing',
      name: 'Test Card',
      mana_cost: '{2}',
      type_line: 'Artifact',
      oracle_text: 'Useful rules text.',
      color_identity: [],
      image_uris: {
        small: 'https://example.com/small.jpg',
        normal: 'https://example.com/normal.jpg',
        large: 'https://example.com/large.jpg',
      },
    }
    const wrapper = mountPreview(card)

    expect(wrapper.text()).toContain('Test Card')
    expect(wrapper.text()).toContain('Useful rules text.')
    expect(wrapper.html()).toContain('https://example.com/large.jpg')
    wrapper.unmount()
  })

  it('renders useful information for each card face', () => {
    const card: ScryfallCard = {
      id: 'multi-face-printing',
      name: 'Front // Back',
      type_line: 'Instant // Sorcery',
      color_identity: ['U'],
      card_faces: [
        {
          name: 'Front',
          mana_cost: '{U}',
          type_line: 'Instant',
          oracle_text: 'Front rules.',
        },
        {
          name: 'Back',
          type_line: 'Sorcery',
          oracle_text: 'Back rules.',
        },
      ],
    }
    const wrapper = mountPreview(card)

    expect(wrapper.text()).toContain('Front rules.')
    expect(wrapper.text()).toContain('Back rules.')
    wrapper.unmount()
  })

  it('does not crash when optional fields are missing', () => {
    const card: ScryfallCard = {
      id: 'minimal-printing',
      name: 'Minimal Card',
      type_line: 'Land',
      color_identity: [],
    }

    expect(() => mountPreview(card)).not.toThrow()
  })
})
