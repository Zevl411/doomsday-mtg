import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppLoadingSkeleton from './AppLoadingSkeleton.vue'

describe('AppLoadingSkeleton', () => {
  it('matches card-grid loading states and exposes an accessible label', () => {
    const wrapper = mount(AppLoadingSkeleton, {
      props: {
        count: 4,
        label: 'Loading public Decks',
        variant: 'cards',
      },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-label')).toBe('Loading public Decks')
    expect(wrapper.findAll('.app-skeleton__card')).toHaveLength(4)
  })

  it('renders list rows with image placeholders', () => {
    const wrapper = mount(AppLoadingSkeleton, {
      props: {
        count: 3,
        variant: 'list',
      },
    })

    expect(wrapper.findAll('.app-skeleton__row')).toHaveLength(3)
    expect(wrapper.findAll('.app-skeleton__thumb')).toHaveLength(3)
  })

  it('renders a chart-shaped placeholder for analytics loads', () => {
    const wrapper = mount(AppLoadingSkeleton, {
      props: {
        variant: 'chart',
      },
    })

    expect(wrapper.find('.app-skeleton__chart').exists()).toBe(true)
  })
})
