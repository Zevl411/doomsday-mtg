import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CardAssociationsView from './CardAssociationsView.vue'

const mocks = vi.hoisted(() => ({
  getAssociations: vi.fn(),
  getCommanderMetagame: vi.fn(),
  getLocationOptions: vi.fn(),
}))

vi.mock('../repositories/cardAssociationRepository', () => ({
  cardAssociationRepository: {
    getAssociations: mocks.getAssociations,
  },
}))
vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCommanderMetagame: mocks.getCommanderMetagame,
    getLocationOptions: mocks.getLocationOptions,
  },
}))

const oracleA = '00000000-0000-4000-8000-000000000001'
const oracleB = '00000000-0000-4000-8000-000000000002'

beforeEach(() => {
  mocks.getAssociations.mockReset().mockResolvedValue([])
  mocks.getCommanderMetagame.mockReset().mockResolvedValue([{
    commanderKey: 'kinnan',
    commanderName: 'Kinnan, Bonder Prodigy',
  }])
  mocks.getLocationOptions.mockReset().mockResolvedValue({
    countries: [],
    states: [],
    regions: ['country:US'],
    hasOnline: false,
  })
})

function mountView() {
  return mount(CardAssociationsView, {
    global: {
      stubs: {
        CardSearch: {
          template: '<button class="choose-card" @click="$emit(\'card-selected\', card)">Choose card</button>',
          data: () => ({
            card: {
              id: 'printing-a',
              oracle_id: oracleA,
              name: 'Card A',
              type_line: 'Artifact',
              color_identity: [],
            },
          }),
        },
        VContainer: { template: '<div><slot /></div>' },
        VCard: { template: '<section><slot /></section>' },
        VCardTitle: { template: '<h2><slot /></h2>' },
        VRow: { template: '<div><slot /></div>' },
        VCol: { template: '<div><slot /></div>' },
        VAlert: { template: '<div><slot /></div>' },
        VProgressLinear: true,
        VTable: { template: '<table><slot /></table>' },
        VAutocomplete: {
          template: '<button class="choose-commander" @click="$emit(\'update:modelValue\', \'kinnan\')">Choose Commander</button>',
        },
        VSelect: true,
        VTextField: true,
        VBtn: {
          props: ['disabled'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })
}

describe('CardAssociationsView', () => {
  it('explains that observed associations are not causal', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('not causal')
    expect(wrapper.text()).toContain('Correlation does not establish causation')
  })

  it('loads filtered associations after selecting a Commander and card', async () => {
    mocks.getAssociations.mockResolvedValue([{
      commanderKey: 'kinnan',
      sourceOracleId: oracleA,
      sourceCardName: 'Card A',
      associatedOracleId: oracleB,
      associatedCardName: 'Card B',
      support: 0.25,
      confidence: 0.5,
      lift: 1.4,
      occurrenceCount: 10,
      deckCount: 10,
      firstSeenAt: null,
      lastSeenAt: null,
      sampleSize: 40,
    }])
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('.choose-commander').trigger('click')
    await wrapper.get('.choose-card').trigger('click')
    const buttons = wrapper.findAll('button')
    const loadButton = buttons.find(
      (button) => button.text().includes('View associations'),
    )
    await loadButton?.trigger('click')
    await flushPromises()

    expect(mocks.getAssociations).toHaveBeenCalledWith(
      'kinnan',
      oracleA,
      expect.objectContaining({
        minimumSampleSize: 20,
        minimumOccurrenceCount: 3,
      }),
    )
    expect(wrapper.text()).toContain('Card B')
    expect(wrapper.text()).toContain('50.0%')
    expect(wrapper.text()).toContain('1.40×')
    expect(wrapper.text()).toContain('Support')
    expect(wrapper.text()).toContain('Confidence')
    expect(wrapper.text()).toContain('Lift')
  })
})
