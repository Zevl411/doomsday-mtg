import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppMobileFilterPanel from './AppMobileFilterPanel.vue'

describe('AppMobileFilterPanel', () => {
  it('starts closed and labels the mobile filter disclosure', () => {
    const wrapper = mount(AppMobileFilterPanel, {
      slots: {
        default: '<label>Minimum players</label>',
      },
    })

    const disclosure = wrapper.get('details')
    expect(disclosure.attributes('open')).toBeUndefined()
    expect(disclosure.get('summary').text()).toBe('Filters')
    expect(disclosure.text()).toContain('Minimum players')
  })
})
