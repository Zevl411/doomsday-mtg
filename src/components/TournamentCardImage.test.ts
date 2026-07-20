import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import vuetify from '../plugins/vuetify'
import TournamentCardImage from './TournamentCardImage.vue'

describe('TournamentCardImage', () => {
  it('shows the back of a double-faced card while hovered or focused', async () => {
    const wrapper = mount(TournamentCardImage, {
      props: {
        card: {
          name: 'Front // Back',
          quantity: 1,
          oracleId: 'oracle-id',
          typeLine: 'Creature',
          manaCost: '{1}{G}',
          manaValue: 2,
          imageUrl: 'front.jpg',
          backImageUrl: 'back.jpg',
        },
      },
      global: { plugins: [vuetify] },
    })

    expect(wrapper.get('.v-img').classes()).toContain('full-card-image')
    expect(wrapper.get('img').attributes('src')).toBe('front.jpg')
    await wrapper.get('.v-card').trigger('mouseenter')
    expect(wrapper.get('img').attributes('src')).toBe('back.jpg')
    await wrapper.get('.v-card').trigger('mouseleave')
    expect(wrapper.get('img').attributes('src')).toBe('front.jpg')
  })
})
