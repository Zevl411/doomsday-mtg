import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ColorIdentitySymbols from './ColorIdentitySymbols.vue'

describe('ColorIdentitySymbols', () => {
  it('renders each color with one accessible group label', () => {
    const wrapper = mount(ColorIdentitySymbols, {
      props: { colors: ['W', 'U', 'B', 'R', 'G'] },
    })

    expect(wrapper.attributes('aria-label')).toBe(
      'Color identity: White, Blue, Black, Red, Green',
    )
    expect(wrapper.findAll('.ms')).toHaveLength(5)
  })

  it('uses the colorless mana symbol for an empty identity', () => {
    const wrapper = mount(ColorIdentitySymbols, {
      props: { colors: [] },
    })

    expect(wrapper.attributes('aria-label')).toBe(
      'Color identity: Colorless',
    )
    expect(wrapper.find('.ms-c').exists()).toBe(true)
  })
})
