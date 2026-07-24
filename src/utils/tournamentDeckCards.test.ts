import { describe, expect, it } from 'vitest';

import {
  applyScryfallCardDetails,
  formatTournamentDecklist,
  groupTournamentDeckCards,
  hasExpectedTournamentDeckCards,
  sortTournamentDeckCards,
} from './tournamentDeckCards';

import type { TournamentDeckCard } from '../models/tournament';

function tournamentCard(name: string, oracleId: string | null): TournamentDeckCard {
  return {
    name,
    quantity: 1,
    oracleId,
    typeLine: '',
    manaCost: '',
    manaValue: null,
    imageUrl: 'provider-image',
  };
}

describe('tournament Deck card display helpers', () => {
  it('stacks repeated cards and sums their quantities', () => {
    const cards = [
      tournamentCard('Island', 'island-oracle'),
      tournamentCard('Island', 'island-oracle'),
      tournamentCard('Island', 'island-oracle'),
    ];

    expect(groupTournamentDeckCards(cards)).toEqual([
      expect.objectContaining({ name: 'Island', quantity: 3 }),
    ]);
  });

  it('groups by normalized name when an Oracle ID is unavailable', () => {
    const cards = [tournamentCard('Mountain', null), tournamentCard(' mountain ', null)];

    expect(groupTournamentDeckCards(cards)[0]?.quantity).toBe(2);
  });

  it('prefers the smaller Scryfall CDN image for grid performance', () => {
    const cards = [tournamentCard('Sol Ring', 'sol-ring')];
    const result = applyScryfallCardDetails(cards, [
      {
        id: 'printing',
        name: 'Sol Ring',
        type_line: 'Artifact',
        color_identity: [],
        cmc: 1,
        image_uris: {
          small: 'scryfall-small',
          normal: 'scryfall-normal',
          large: 'scryfall-large',
        },
      },
    ]);

    expect(result[0]?.imageUrl).toBe('scryfall-small');
    expect(result[0]?.manaValue).toBe(1);
  });

  it('preserves both images for a double-faced card', () => {
    const cards = [tournamentCard('Etali, Primal Conqueror // Etali, Primal Sickness', 'etali')];
    const result = applyScryfallCardDetails(cards, [
      {
        id: 'etali-printing',
        name: 'Etali, Primal Conqueror // Etali, Primal Sickness',
        type_line: 'Legendary Creature — Elder Dinosaur',
        color_identity: ['G', 'R'],
        cmc: 7,
        card_faces: [
          {
            name: 'Etali, Primal Conqueror',
            type_line: 'Legendary Creature — Elder Dinosaur',
            image_uris: {
              small: 'etali-front',
              normal: 'etali-front-normal',
              large: 'etali-front-large',
            },
          },
          {
            name: 'Etali, Primal Sickness',
            type_line: 'Legendary Creature — Phyrexian Elder Dinosaur',
            image_uris: {
              small: 'etali-back',
              normal: 'etali-back-normal',
              large: 'etali-back-large',
            },
          },
        ],
      },
    ]);

    expect(result[0]).toMatchObject({
      imageUrl: 'etali-front',
      backImageUrl: 'etali-back',
    });
  });

  it('sorts alphabetically by default display name', () => {
    const cards = [
      tournamentCard('Sol Ring', 'sol-ring'),
      tournamentCard('Arcane Signet', 'arcane-signet'),
    ];

    expect(sortTournamentDeckCards(cards, 'name').map((card) => card.name)).toEqual([
      'Arcane Signet',
      'Sol Ring',
    ]);
  });

  it('sorts by mana value and uses the name as a stable tiebreaker', () => {
    const expensive = tournamentCard('Wrath', 'wrath');
    expensive.manaValue = 4;
    const cheap = tournamentCard('Sol Ring', 'sol-ring');
    cheap.manaValue = 1;

    expect(
      sortTournamentDeckCards([expensive, cheap], 'mana-value').map((card) => card.name),
    ).toEqual(['Sol Ring', 'Wrath']);
  });

  it('groups card types without treating Legendary as a separate type', () => {
    const instant = tournamentCard('Counterspell', 'counterspell');
    instant.typeLine = 'Instant';
    const creature = tournamentCard('Llanowar Elves', 'llanowar-elves');
    creature.typeLine = 'Legendary Creature — Elf Druid';

    expect(
      sortTournamentDeckCards([instant, creature], 'card-type').map((card) => card.name),
    ).toEqual(['Llanowar Elves', 'Counterspell']);
  });

  it('exports Commander and mainboard cards in alphabetical plaintext sections', () => {
    expect(
      formatTournamentDecklist(
        [{ name: 'Atraxa, Praetors’ Voice', quantity: 1 }],
        [
          { name: 'Sol Ring', quantity: 1 },
          { name: 'Island', quantity: 4 },
        ],
      ),
    ).toBe('Commander\n1 Atraxa, Praetors’ Voice\n\n' + 'Mainboard\n4 Island\n1 Sol Ring');
  });

  it('detects a normalized snapshot with a missing card or Commander', () => {
    const commander = tournamentCard('Etali', 'etali');
    const cards = [tournamentCard('Sol Ring', 'sol-ring')];

    expect(hasExpectedTournamentDeckCards([commander], cards, 1)).toBe(true);
    expect(hasExpectedTournamentDeckCards([commander], cards, 2)).toBe(false);
    expect(hasExpectedTournamentDeckCards([], cards, 1)).toBe(false);
  });
});
