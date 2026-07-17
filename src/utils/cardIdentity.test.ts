import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../types/card'
import { getCardIdentity } from './cardIdentity'

function createCard(id: string, name: string, oracleId?: string): ScryfallCard {
  return {
    id,
    oracle_id: oracleId,
    name,
    type_line: 'Artifact',
    color_identity: [],
  }
}

describe('getCardIdentity', () => {
  it('matches different printings with the same Oracle ID', () => {
    const firstPrinting = createCard('printing-1', 'Sol Ring', 'oracle-sol-ring')
    const secondPrinting = createCard('printing-2', 'Sol Ring', 'oracle-sol-ring')

    expect(getCardIdentity(firstPrinting)).toBe(
      getCardIdentity(secondPrinting),
    )
  })

  it('uses a normalized name when Oracle ID is unavailable', () => {
    const firstCard = createCard('printing-1', '  Sol Ring  ')
    const secondCard = createCard('printing-2', 'sol ring')

    expect(getCardIdentity(firstCard)).toBe('sol ring')
    expect(getCardIdentity(firstCard)).toBe(getCardIdentity(secondCard))
  })
})
