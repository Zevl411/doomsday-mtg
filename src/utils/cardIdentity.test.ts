import { describe, expect, it } from 'vitest';

import { getCardIdentity } from './cardIdentity';

import type { ScryfallCard } from '../types/card';

function createCard(id: string, name: string, oracleId?: string): ScryfallCard {
  return {
    id,
    oracle_id: oracleId,
    name,
    type_line: 'Artifact',
    color_identity: [],
  };
}

describe('getCardIdentity', () => {
  it('matches different printings with the same Oracle ID', () => {
    const firstPrinting = createCard('printing-1', 'Sol Ring', 'oracle-sol-ring');
    const secondPrinting = createCard('printing-2', 'Sol Ring', 'oracle-sol-ring');

    expect(getCardIdentity(firstPrinting)).toBe(getCardIdentity(secondPrinting));
  });

  it('uses a normalized name when Oracle ID is unavailable', () => {
    const firstCard = createCard('printing-1', '  Sol Ring  ');
    const secondCard = createCard('printing-2', 'sol ring');

    expect(getCardIdentity(firstCard)).toBe('sol ring');
    expect(getCardIdentity(firstCard)).toBe(getCardIdentity(secondCard));
  });

  it('normalizes whitespace and face separators when oracle_id is absent', () => {
    expect(
      getCardIdentity({
        id: 'printing-one',
        name: '  Fire / Ice ',
        type_line: 'Instant',
        color_identity: ['U', 'R'],
      }),
    ).toBe('fire // ice');

    expect(
      getCardIdentity({
        id: 'printing-two',
        name: 'Fire  //  Ice',
        type_line: 'Instant',
        color_identity: ['U', 'R'],
      }),
    ).toBe('fire // ice');
  });
});
