import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../types/card'
import {
  formatColorIdentity,
  getCardImage,
  getColorIdentityLabels,
} from './cardDisplay'

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
    }

    expect(getCardImage(card, 'large')).toBe('large.jpg')
  })

  it('formats colored and colorless identities consistently', () => {
    const card: ScryfallCard = {
      id: 'card',
      name: 'Card',
      type_line: 'Artifact',
      color_identity: [],
    }

    expect(formatColorIdentity(card)).toBe('Colorless')
    expect(getColorIdentityLabels(card)).toEqual(['Colorless'])

    card.color_identity = ['W', 'U']
    expect(formatColorIdentity(card)).toBe('W, U')
    expect(getColorIdentityLabels(card)).toEqual(['W', 'U'])
  })
})
