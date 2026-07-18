import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ManaCost from './ManaCost.vue'

describe('ManaCost', () => {
  it('renders hybrid and Phyrexian casting costs as mana symbols', () => {
    const wrapper = mount(ManaCost, {
      props: { cost: '{2}{G/P}{R/G}' },
    })

    expect(wrapper.find('.ms-gp').exists()).toBe(true)
    expect(wrapper.find('.ms-rg').exists()).toBe(true)
    expect(wrapper.find('.mana-cost__generic').text()).toBe('2')
    expect(wrapper.attributes('aria-label')).toBe('Mana cost {2}{G/P}{R/G}')
  })
})
