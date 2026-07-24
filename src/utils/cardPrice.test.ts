import { describe, expect, it } from 'vitest';

import {
  formatCardPrice,
  getDeckEntryPrice,
  getCardMarketPrices,
  getTcgplayerPurchaseUrl,
  sumKnownDeckEntryPrices,
} from './cardPrice';

import type { ScryfallCard } from '../types/card';

const card: ScryfallCard = {
  id: 'printing',
  name: 'Test Card',
  type_line: 'Artifact',
  color_identity: [],
};

describe('card pricing', () => {
  it('returns only valid finish-specific prices', () => {
    expect(
      getCardMarketPrices({
        ...card,
        prices: {
          usd: '1.25',
          usd_foil: 'invalid',
          usd_etched: '3.50',
        },
      }),
    ).toEqual([
      { finish: 'Regular', amount: 1.25 },
      { finish: 'Etched', amount: 3.5 },
    ]);
  });

  it('formats TCGplayer prices in the configured USD currency', () => {
    expect(formatCardPrice(12.5, 'USD')).toBe('$12.50');
  });

  it('uses selected finishes and quantities in aggregate totals', () => {
    const regular = {
      ...card,
      prices: { usd: '2.00', usd_foil: '7.50' },
    };
    const entries = [
      { card: regular, quantity: 2 },
      { card: regular, quantity: 1, foil: true },
      { card, quantity: 1 },
    ];

    expect(getDeckEntryPrice(entries[0]!)).toBe(4);
    expect(getDeckEntryPrice(entries[1]!)).toBe(7.5);
    expect(sumKnownDeckEntryPrices(entries)).toBe(11.5);
  });

  it('accepts only secure TCGplayer purchase links', () => {
    expect(
      getTcgplayerPurchaseUrl({
        ...card,
        purchase_uris: {
          tcgplayer: 'https://www.tcgplayer.com/product/123',
        },
      }),
    ).toBe('https://www.tcgplayer.com/product/123');
    expect(
      getTcgplayerPurchaseUrl({
        ...card,
        purchase_uris: {
          tcgplayer: 'https://example.com/product/123',
        },
      }),
    ).toBeNull();
  });
});
