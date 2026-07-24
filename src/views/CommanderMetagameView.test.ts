import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import vuetify from '../plugins/vuetify';

import CommanderMetagameView from './CommanderMetagameView.vue';

const { getCommanderDetails, getCommanderCardInclusion, getByCards, routeQuery } = vi.hoisted(
  () => ({
    getCommanderDetails: vi.fn(),
    getCommanderCardInclusion: vi.fn(),
    getByCards: vi.fn(),
    routeQuery: {} as Record<string, string>,
  }),
);

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { commanderKey: 'kinnan' },
    query: routeQuery,
  }),
}));

vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCommanderDetails,
    getCommanderCardInclusion,
  },
}));

vi.mock('../repositories/commanderDeckEventRepository', () => ({
  commanderDeckEventRepository: { getByCards },
}));

vi.mock('../api/scryfall', () => ({
  getCardsByExactNames: vi.fn().mockResolvedValue([]),
}));

function tournamentEntry(index: number) {
  return {
    id: `entry-${index}`,
    tournamentId: `tournament-${index}`,
    commanderName: 'Kinnan, Bonder Prodigy',
    commanderKey: 'kinnan',
    colorIdentity: ['G', 'U'],
    playerName: `Pilot ${index}`,
    standing: index,
    wins: 2,
    losses: 1,
    draws: 0,
    winRate: 2 / 3,
    tournamentName: `Tournament ${index}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    tournamentDeckId: `deck-${index}`,
  };
}

beforeEach(() => {
  for (const key of Object.keys(routeQuery)) delete routeQuery[key];
  getCommanderDetails.mockReset();
  getCommanderCardInclusion.mockReset();
  getByCards.mockReset();
  getCommanderDetails.mockResolvedValue({
    stats: {
      commanderKey: 'kinnan',
      commanderName: 'Kinnan, Bonder Prodigy',
      colorIdentity: ['G', 'U'],
      entries: 45,
      tournaments: 45,
      wins: 90,
      losses: 45,
      draws: 0,
      matchWinRate: 2 / 3,
      top16Finishes: 20,
      topCutRate: 20 / 45,
      firstPlaceFinishes: 2,
      metaShare: 0.1,
    },
    entries: Array.from({ length: 45 }, (_, index) => tournamentEntry(index + 1)),
  });
  getCommanderCardInclusion.mockResolvedValue([
    {
      normalizedCardKey: 'sol-ring',
      oracleId: 'oracle-sol-ring',
      cardName: 'Sol Ring',
      colorIdentity: [],
      deckCount: 40,
      totalEligibleDecks: 45,
      inclusionRate: 40 / 45,
      averageQuantity: 1,
      top16DeckCount: 18,
      top16InclusionRate: 0.9,
      firstPlaceDeckCount: 2,
      firstPlaceInclusionRate: 1,
      imageUrl: 'https://cards.example/sol-ring.jpg',
    },
  ]);
  getByCards.mockResolvedValue([]);
});

function mountView() {
  return mount(CommanderMetagameView, {
    attachTo: document.body,
    global: {
      plugins: [vuetify],
      stubs: {
        CardSearch: true,
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

describe('CommanderMetagameView', () => {
  it('paginates tournament Decks at forty rows', async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Tournament 1');
    expect(wrapper.text()).toContain('Tournament 40');
    expect(wrapper.text()).not.toContain('Tournament 41');

    await wrapper.findComponent({ name: 'VPagination' }).setValue(2);
    await flushPromises();

    expect(wrapper.text()).toContain('Tournament 41');
    wrapper.unmount();
  });

  it('opens all inclusions in a dialog and applies timeframe filters', async () => {
    routeQuery.inclusions = 'all';
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.findComponent({ name: 'VDialog' }).props('modelValue')).toBe(true);

    const timeframe = wrapper.findAllComponents({ name: 'VSelect' })[0];
    await timeframe?.setValue('week');
    await flushPromises();

    expect(getCommanderCardInclusion).toHaveBeenLastCalledWith(
      'kinnan',
      expect.objectContaining({
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    wrapper.unmount();
  });

  it('opens Commander-scoped card associations in a dialog', async () => {
    const wrapper = mountView();
    await flushPromises();

    const button = wrapper
      .findAllComponents({ name: 'VBtn' })
      .find((item) => item.text().includes('Card associations'));
    await button?.trigger('click');
    await flushPromises();

    const associationView = wrapper.findComponent({
      name: 'CardAssociationsView',
    });
    expect(associationView.exists()).toBe(true);
    expect(associationView.props('embedded')).toBe(true);
    expect(associationView.props('initialCommanderKey')).toBe('kinnan');
    expect(associationView.props('allowedColorIdentity')).toEqual(['G', 'U']);
    wrapper.unmount();
  });
});
