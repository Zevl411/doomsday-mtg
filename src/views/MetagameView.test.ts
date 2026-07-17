import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import vuetify from '../plugins/vuetify'
import MetagameView from './MetagameView.vue'

const { getCommanderMetagame } = vi.hoisted(() => ({
  getCommanderMetagame: vi.fn(),
}))

vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCommanderMetagame,
    clearCache: vi.fn(),
  },
}))

beforeEach(() => getCommanderMetagame.mockReset())

describe('MetagameView', () => {
  it('renders normalized metrics, sample size, and attribution', async () => {
    getCommanderMetagame.mockResolvedValue([{
      commanderKey: 'kinnan',
      commanderName: 'Kinnan',
      colorIdentity: ['G', 'U'],
      entries: 10,
      tournaments: 3,
      wins: 20,
      losses: 10,
      draws: 0,
      matchWinRate: 2 / 3,
      top16Finishes: 4,
      topCutRate: 0.4,
      firstPlaceFinishes: 1,
      metaShare: 0.25,
    }])
    const wrapper = mount(MetagameView, {
      global: {
        plugins: [vuetify],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('EDHTop16')
    expect(wrapper.text()).toContain('Kinnan')
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('25.0%')
    expect(wrapper.text()).toContain('66.7%')
  })

  it('shows a friendly empty state', async () => {
    getCommanderMetagame.mockResolvedValue([])
    const wrapper = mount(MetagameView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('No tournament results match')
  })
})
