import { describe, expect, it } from 'vitest';

import {
  getCommanderColorIdentity,
  getCommanderLookupNames,
  mapColorIdentityByCardName,
} from './commanderColorIdentity';

import type { ScryfallCard } from '../types/card';

function card(name: string, colorIdentity: string[], faceNames: string[] = []): ScryfallCard {
  return {
    id: name,
    name,
    type_line: 'Legendary Creature',
    color_identity: colorIdentity,
    card_faces: faceNames.map((faceName) => ({
      name: faceName,
      type_line: 'Legendary Creature',
    })),
  };
}

describe('Commander color identity helpers', () => {
  it('combines the colors from a partner pair', () => {
    const identities = mapColorIdentityByCardName([
      card('Tymna the Weaver', ['W', 'B']),
      card('Kraum, Ludevic’s Opus', ['U', 'R']),
    ]);

    expect(
      getCommanderColorIdentity('Tymna the Weaver // Kraum, Ludevic’s Opus', identities),
    ).toEqual(['W', 'B', 'U', 'R']);
  });

  it('recognizes either face of a double-faced Commander', () => {
    const identities = mapColorIdentityByCardName([
      card(
        'Esika, God of the Tree // The Prismatic Bridge',
        ['W', 'U', 'B', 'R', 'G'],
        ['Esika, God of the Tree', 'The Prismatic Bridge'],
      ),
    ]);

    expect(getCommanderColorIdentity('Esika, God of the Tree', identities)).toEqual([
      'W',
      'U',
      'B',
      'R',
      'G',
    ]);
  });

  it('accepts provider pair names with flexible separator spacing', () => {
    expect(getCommanderLookupNames('A//B')).toEqual(['A', 'B']);
  });
});
