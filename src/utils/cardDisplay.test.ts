import { describe, expect, it } from 'vitest';

import { getCardArt, getCardImage } from './cardDisplay';

import type { ScryfallCard } from '../types/card';

describe('card display helpers', () => {
  it('uses face images for double-faced cards', () => {
    const card: ScryfallCard = {
      id: 'double-faced',
      name: 'Front // Back',
      type_line: 'Creature',
      color_identity: ['U'],
      card_faces: [
        {
          name: 'Front',
          type_line: 'Creature',
          image_uris: {
            small: 'small.jpg',
            normal: 'normal.jpg',
            large: 'large.jpg',
          },
        },
      ],
    };

    expect(getCardImage(card, 'large')).toBe('large.jpg');
  });

  it('uses the exact art crop supplied by Scryfall', () => {
    const card: ScryfallCard = {
      id: 'art-card',
      name: 'Art Card',
      type_line: 'Creature',
      color_identity: ['G'],
      image_uris: {
        small: 'small.jpg',
        normal: 'normal.jpg',
        large: 'large.jpg',
        art_crop: 'art-crop.jpg',
      },
    };

    expect(getCardArt(card)).toBe('art-crop.jpg');
  });

  it('derives the same printing art crop for an older saved card', () => {
    const card: ScryfallCard = {
      id: 'older-card',
      name: 'Older Card',
      type_line: 'Artifact',
      color_identity: [],
      image_uris: {
        small: 'https://cards.scryfall.io/small/front/a/b/card-id.jpg',
        normal: 'https://cards.scryfall.io/normal/front/a/b/card-id.jpg',
        large: 'https://cards.scryfall.io/large/front/a/b/card-id.jpg',
      },
    };

    expect(getCardArt(card)).toBe('https://cards.scryfall.io/art_crop/front/a/b/card-id.jpg');
  });
});
