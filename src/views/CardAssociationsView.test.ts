import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CardAssociationsView from './CardAssociationsView.vue'

const mocks = vi.hoisted(() => ({
  getAssociations: vi.fn(),
  getCommanderMetagame: vi.fn(),
  getCardsByOracleIds: vi.fn(),
}))

vi.mock('../api/scryfall', () => ({
  getCardsByOracleIds: mocks.getCardsByOracleIds,
}))
vi.mock('../repositories/cardAssociationRepository', () => ({
  cardAssociationRepository: {
    getAssociations: mocks.getAssociations,
  },
}))
vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCommanderMetagame: mocks.getCommanderMetagame,
  },
}))

const oracleA = '00000000-0000-4000-8000-000000000001'
const oracleB = '00000000-0000-4000-8000-000000000002'

beforeEach(() => {
  mocks.getAssociations.mockReset().mockResolvedValue([])
  mocks.getCardsByOracleIds.mockReset().mockResolvedValue([])
  mocks.getCommanderMetagame.mockReset().mockResolvedValue([{
    commanderKey: 'kinnan',
    commanderName: 'Kinnan, Bonder Prodigy',
  }])
})

function mountView(props: Record<string, unknown> = {}) {
  return mount(CardAssociationsView, {
    props,
    global: {
      stubs: {
        CardSearch: {
          name: 'CardSearch',
          props: ['modelValue', 'searchFilter', 'selectedCard'],
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
        VCardText: { template: '<div><slot /></div>' },
        VRow: { template: '<div><slot /></div>' },
        VCol: { template: '<div><slot /></div>' },
        VAlert: { template: '<div><slot /></div>' },
        VProgressLinear: true,
        VTable: { template: '<table><slot /></table>' },
        VImg: {
          props: ['src', 'alt'],
          template: '<img :src="src" :alt="alt" />',
        },
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
  it('explains each association metric without the warning alert', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('not causal')
    expect(wrapper.text()).not.toContain(
      'Results describe observed tournament associations',
    )
    expect(wrapper.text()).toContain('Percent of all sampled Decks')
    expect(wrapper.text()).toContain('1× means no observed increase')
    expect(wrapper.text()).toContain('Complete tournament Decks included')
  })

  it('restricts embedded card searches to the Commander color identity', () => {
    const wrapper = mountView({
      embedded: true,
      initialCommanderKey: 'kinnan',
      allowedColorIdentity: ['G', 'U'],
    })

    expect(wrapper.findComponent({ name: 'CardSearch' }).props('searchFilter'))
      .toBe('id<=gu')
  })

  it('loads filtered associations after selecting a Commander and card', async () => {
    mocks.getCardsByOracleIds.mockResolvedValue([{
      id: 'printing-b',
      oracle_id: oracleB,
      name: 'Card B',
      type_line: 'Artifact',
      color_identity: [],
      image_uris: {
        normal: 'https://cards.example/card-b.jpg',
      },
    }])
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
        minimumConfidence: 0.05,
        minimumLift: 1,
      }),
    )
    expect(wrapper.text()).toContain('Card B')
    expect(wrapper.text()).toContain('50.0%')
    expect(wrapper.text()).toContain('1.40×')
    expect(wrapper.text()).toContain('Support')
    expect(wrapper.text()).toContain('Confidence')
    expect(wrapper.text()).toContain('Lift')
    expect(wrapper.findAll('.association-card')).toHaveLength(1)
    expect(wrapper.get('.association-card img').attributes('src')).toContain(
      'https://cards.example/card-b.jpg',
    )

    const resetButton = wrapper.findAll('button').find(
      (button) => button.text().includes('Reset'),
    )
    await resetButton?.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.association-card')).toHaveLength(0)
    expect(wrapper.findComponent({ name: 'CardSearch' }).props('selectedCard'))
      .toBeNull()
    expect(wrapper.findComponent({ name: 'CardSearch' }).props('modelValue'))
      .toBe('')
  })
})
