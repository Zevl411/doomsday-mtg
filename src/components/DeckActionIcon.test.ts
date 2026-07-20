import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DeckActionIcon from './DeckActionIcon.vue'

const iconNames = [
  'settings',
  'compare',
  'copy',
  'duplicate',
  'rename',
  'import',
  'export',
  'decrease',
  'increase',
  'move',
  'delete',
] as const

describe('DeckActionIcon', () => {
  it.each(iconNames)('renders the shared %s action icon', (name) => {
    const wrapper = mount(DeckActionIcon, {
      props: { compact: true, name },
    })

    expect(wrapper.get('path').attributes('d')).toBeTruthy()
    expect(wrapper.get('svg').classes()).toContain(
      'deck-action-icon--compact',
    )
  })
})
