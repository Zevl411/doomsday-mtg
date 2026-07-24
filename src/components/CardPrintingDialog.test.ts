import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { ScryfallCard } from '../types/card'
import vuetify from '../plugins/vuetify'
import CardPrintingDialog from './CardPrintingDialog.vue'

const mocks = vi.hoisted(() => ({
  getCardPrintings: vi.fn(),
}))

vi.mock('../api/scryfall', () => ({
  getCardPrintings: mocks.getCardPrintings,
}))

const currentPrinting: ScryfallCard = {
  id: 'current-printing',
  oracle_id: 'sol-ring-oracle',
  name: 'Sol Ring',
  type_line: 'Artifact',
  color_identity: [],
  set: 'cmm',
  set_name: 'Commander Masters',
  collector_number: '396',
  released_at: '2023-08-04',
}
const alternatePrinting: ScryfallCard = {
  ...currentPrinting,
  id: 'alternate-printing',
  set: 'brc',
  set_name: 'The Brothers’ War Commander',
  collector_number: '127',
  released_at: '2022-11-18',
  finishes: ['nonfoil', 'foil'],
  foil: true,
  nonfoil: true,
}

describe('CardPrintingDialog', () => {
  beforeEach(() => {
    mocks.getCardPrintings.mockReset().mockResolvedValue([
      alternatePrinting,
      currentPrinting,
    ])
  })

  it('shows available printings and emits the selected record', async () => {
    const wrapper = mount(CardPrintingDialog, {
      props: {
        modelValue: false,
        card: currentPrinting,
      },
      global: {
        plugins: [vuetify],
        stubs: {
          VDialog: defineComponent({
            props: { modelValue: Boolean },
            template: '<div v-if="modelValue"><slot /></div>',
          }),
        },
      },
    })

    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(wrapper.text()).toContain('Commander Masters')
    expect(wrapper.text()).toContain('The Brothers’ War Commander')
    await wrapper
      .find('[aria-label*="Brothers’ War Commander"]')
      .trigger('click')
    wrapper.findComponent({ name: 'VSwitch' }).vm.$emit(
      'update:modelValue',
      true,
    )
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Use printing'))
      ?.trigger('click')

    expect(wrapper.emitted('selected')).toEqual([[
      { printing: alternatePrinting, foil: true },
    ]])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })
})
