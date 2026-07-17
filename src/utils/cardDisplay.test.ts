import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../types/card'
import {
  getCardImage,
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

})
