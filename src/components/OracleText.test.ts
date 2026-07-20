import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OracleText from './OracleText.vue'

describe('OracleText', () => {
  it('renders known inline tokens as symbols and preserves lines', () => {
    const wrapper = mount(OracleText, {
      props: {
        text: '{T}: Add {G}{G}.\n{Q}: Untap this permanent.',
      },
    })

    expect(wrapper.find('.ms-tap').exists()).toBe(true)
    expect(wrapper.find('.ms-untap').exists()).toBe(true)
    expect(wrapper.findAll('.ms-g')).toHaveLength(2)
    expect(wrapper.findAll('.oracle-text__line')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('{T}')
    expect(wrapper.text()).not.toContain('{G}')
  })

  it('leaves unknown brace tokens as authoritative source text', () => {
    const wrapper = mount(OracleText, {
      props: {
        text: 'Use {UNKNOWN} exactly as supplied.',
      },
    })

    expect(wrapper.text()).toContain('{UNKNOWN}')
  })
})
