import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import vuetify from '../plugins/vuetify';

import MetagameView from './MetagameView.vue';

const { getCommanderMetagame } = vi.hoisted(() => ({
  getCommanderMetagame: vi.fn(),
}));

vi.mock('../repositories/tournamentRepository', () => ({
  tournamentRepository: {
    getCommanderMetagame,
    clearCache: vi.fn(),
  },
}));

beforeEach(() => getCommanderMetagame.mockReset());
afterEach(() => vi.useRealTimers());

describe('MetagameView', () => {
  it('renders normalized metrics, sample size, and attribution', async () => {
    getCommanderMetagame.mockResolvedValue([
      {
        commanderKey: 'kinnan',
        commanderName: 'Kinnan',
        colorIdentity: ['G', 'U'],
        imageUrls: ['https://cards.example/kinnan-art.jpg'],
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
      },
    ]);
    const wrapper = mount(MetagameView, {
      global: {
        plugins: [vuetify],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('EDHTop16');
    expect(wrapper.text()).toContain('Kinnan');
    expect(wrapper.text()).toContain('10');
    expect(wrapper.text()).toContain('25.0%');
    expect(wrapper.text()).toContain('66.7%');
    expect(wrapper.findAll('.commander-card')).toHaveLength(1);
    expect(wrapper.findAll('.commander-card__image')).toHaveLength(1);
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('layers partner Commander art in the same wide card', async () => {
    getCommanderMetagame.mockResolvedValue([
      {
        commanderKey: 'tymna-kraum',
        commanderName: "Tymna the Weaver // Kraum, Ludevic's Opus",
        colorIdentity: ['W', 'U', 'B', 'R'],
        imageUrls: ['https://cards.example/tymna.jpg', 'https://cards.example/kraum.jpg'],
        entries: 4,
        tournaments: 2,
        wins: 2,
        losses: 2,
        draws: 0,
        matchWinRate: 0.5,
        top16Finishes: 1,
        topCutRate: 0.25,
        firstPlaceFinishes: 0,
        metaShare: 0.1,
      },
    ]);

    const wrapper = mount(MetagameView, {
      global: { plugins: [vuetify] },
    });
    await flushPromises();

    expect(wrapper.findAll('.commander-card__image')).toHaveLength(2);
    expect(wrapper.find('.commander-card__image--partner').exists()).toBe(true);
  });

  it('applies a preset timeframe to the metagame query', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
    getCommanderMetagame.mockResolvedValue([]);
    const wrapper = mount(MetagameView, {
      global: { plugins: [vuetify] },
    });
    await flushPromises();

    await wrapper.findComponent({ name: 'VSelect' }).setValue('week');
    await flushPromises();

    expect(getCommanderMetagame).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startDate: '2026-07-12',
        endDate: undefined,
      }),
    );
  });

  it('shows a friendly empty state', async () => {
    getCommanderMetagame.mockResolvedValue([]);
    const wrapper = mount(MetagameView, {
      global: { plugins: [vuetify] },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('No tournament results match');
  });
});
