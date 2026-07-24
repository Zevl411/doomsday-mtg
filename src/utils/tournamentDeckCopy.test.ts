import { describe, expect, it } from 'vitest';

import { createTournamentCardLookup, toCopiedDeckCard } from './tournamentDeckCopy';

import type { NormalizedTournamentDeckCard } from '../models/tournament';
import type { ScryfallCard } from '../types/card';

const normalizedCard: NormalizedTournamentDeckCard = {
  id: 'row',
  board: 'mainboard',
  oracleId: 'oracle',
  scryfallId: 'printing',
  normalizedCardKey: 'sol-ring',
  cardName: 'Sol Ring',
  quantity: 1,
  typeLine: 'Artifact',
  colorIdentity: [],
  colors: [],
  manaValue: 1,
  isBasicLand: false,
};

describe('tournament deck copies', () => {
  it('copies full Scryfall image data into editable decks', () => {
    const resolved: ScryfallCard = {
      id: 'printing',
      oracle_id: 'oracle',
      name: 'Sol Ring',
      type_line: 'Artifact',
      color_identity: [],
      image_uris: {
        small: 'small.jpg',
        normal: 'normal.jpg',
        large: 'large.jpg',
      },
    };

    const copied = toCopiedDeckCard(normalizedCard, createTournamentCardLookup([resolved]));

    expect(copied.card.image_uris?.normal).toBe('normal.jpg');
    expect(copied.card).not.toBe(resolved);
  });

  it('uses a Scryfall ID image URL when hydration is unavailable', () => {
    const copied = toCopiedDeckCard(normalizedCard, new Map());

    expect(copied.card.image_uris?.normal).toContain('/cards/printing?');
    expect(copied.card.cmc).toBe(1);
  });
});
