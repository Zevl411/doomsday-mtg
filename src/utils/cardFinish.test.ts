import { describe, expect, it } from 'vitest';

import { supportsFoil } from './cardFinish';

import type { ScryfallCard } from '../types/card';

const card: ScryfallCard = {
  id: 'printing',
  name: 'Card',
  type_line: 'Artifact',
  color_identity: [],
};

describe('card finish availability', () => {
  it('uses Scryfall finish metadata when available', () => {
    expect(supportsFoil({ ...card, finishes: ['nonfoil', 'foil'] })).toBe(true);
    expect(supportsFoil({ ...card, finishes: ['nonfoil'] })).toBe(false);
  });

  it('keeps legacy saved cards permissive when finish data is absent', () => {
    expect(supportsFoil(card)).toBe(true);
  });
});
