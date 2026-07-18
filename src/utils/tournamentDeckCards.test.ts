import { describe, expect, it } from 'vitest'
import type { TournamentDeckCard } from '../models/tournament'
import {
  applyScryfallImages,
  groupTournamentDeckCards,
} from './tournamentDeckCards'

function tournamentCard(
  name: string,
  oracleId: string | null,
): TournamentDeckCard {
  return {
    name,
    quantity: 1,
    oracleId,
    typeLine: '',
    manaCost: '',
    imageUrl: 'provider-image',
  }
}

describe('tournament Deck card display helpers', () => {
  it('stacks repeated cards and sums their quantities', () => {
    const cards = [
      tournamentCard('Island', 'island-oracle'),
      tournamentCard('Island', 'island-oracle'),
      tournamentCard('Island', 'island-oracle'),
    ]

    expect(groupTournamentDeckCards(cards)).toEqual([
      expect.objectContaining({ name: 'Island', quantity: 3 }),
    ])
  })

  it('groups by normalized name when an Oracle ID is unavailable', () => {
    const cards = [
      tournamentCard('Mountain', null),
      tournamentCard(' mountain ', null),
    ]

    expect(groupTournamentDeckCards(cards)[0]?.quantity).toBe(2)
  })

  it('prefers the smaller Scryfall CDN image for grid performance', () => {
    const cards = [tournamentCard('Sol Ring', 'sol-ring')]
    const result = applyScryfallImages(cards, [{
      id: 'printing',
      name: 'Sol Ring',
      type_line: 'Artifact',
      color_identity: [],
      image_uris: {
        small: 'scryfall-small',
        normal: 'scryfall-normal',
        large: 'scryfall-large',
      },
    }])

    expect(result[0]?.imageUrl).toBe('scryfall-small')
  })
})
