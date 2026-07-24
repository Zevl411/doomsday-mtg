import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCardPricingStore } from './cardPricing';

import type { ScryfallCard } from '../types/card';

const mocks = vi.hoisted(() => ({
  getCardsByIds: vi.fn(),
}));

vi.mock('../api/scryfall', () => ({
  getCardsByIds: mocks.getCardsByIds,
}));

const storedCard: ScryfallCard = {
  id: '00000000-0000-4000-8000-000000000003',
  name: 'Stored Card',
  type_line: 'Artifact',
  color_identity: [],
};

describe('card pricing store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getCardsByIds.mockReset();
  });

  it('refreshes and reuses one printing snapshot per session', async () => {
    const refreshed = { ...storedCard, prices: { usd: '4.25' } };
    mocks.getCardsByIds.mockResolvedValue([refreshed]);
    const store = useCardPricingStore();

    await store.refreshCards([storedCard]);
    await store.refreshCards([storedCard]);

    expect(mocks.getCardsByIds).toHaveBeenCalledOnce();
    expect(store.resolve(storedCard)).toEqual(refreshed);
  });

  it('retains stored pricing if refresh is unavailable', async () => {
    mocks.getCardsByIds.mockRejectedValue(new Error('offline'));
    const store = useCardPricingStore();
    const pricedCard = { ...storedCard, prices: { usd: '2.00' } };

    await expect(store.refreshCards([pricedCard])).resolves.toBeUndefined();
    expect(store.resolve(storedCard)).toEqual(pricedCard);
  });
});
