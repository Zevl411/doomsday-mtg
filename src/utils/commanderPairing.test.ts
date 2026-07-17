import { describe, expect, it } from 'vitest'
import type { ScryfallCard } from '../types/card'
import {
  getCommanderColorIdentity,
  getPartnerSearchFilter,
  validateCommanderPairing,
} from './commanderPairing'
import { createEmptyDeck } from '../models/createDeck'

function card(
  name: string,
  oracleText: string,
  typeLine = 'Legendary Creature — Human',
  colors: string[] = [],
): ScryfallCard {
  return {
    id: name,
    name,
    oracle_text: oracleText,
    type_line: typeLine,
    color_identity: colors,
  }
}

describe('commander pairing', () => {
  it('allows two commanders with standalone Partner', () => {
    expect(
      validateCommanderPairing(
        card('Tymna', 'Partner'),
        card('Kraum', 'Partner'),
      ).allowed,
    ).toBe(true)
  })

  it('allows only the corresponding named partner', () => {
    const pir = card('Pir, Imaginative Rascal', 'Partner with Toothy, Imaginary Friend')
    const toothy = card('Toothy, Imaginary Friend', 'Partner with Pir, Imaginative Rascal')
    expect(validateCommanderPairing(pir, toothy).allowed).toBe(true)
    expect(validateCommanderPairing(pir, card('Kraum', 'Partner')).allowed).toBe(false)
  })

  it('matches modern Partner variants by their complete suffix', () => {
    const first = card('Hargilde', 'Partner—Friends forever')
    const second = card('Cecily', 'Partner—Friends forever')
    const different = card('Leonardo', 'Partner—Character select')
    expect(validateCommanderPairing(first, second).allowed).toBe(true)
    expect(validateCommanderPairing(first, different).allowed).toBe(false)
  })

  it('supports Background and Doctor pairings', () => {
    const chooser = card('Volo', 'Choose a Background')
    const background = card(
      'Noble Heritage',
      '',
      'Legendary Enchantment — Background',
    )
    const companion = card('Rose Tyler', "Doctor's companion")
    const doctor = card('The Tenth Doctor', '', 'Legendary Creature — Time Lord Doctor')
    expect(validateCommanderPairing(chooser, background).allowed).toBe(true)
    expect(validateCommanderPairing(companion, doctor).allowed).toBe(true)
  })

  it('combines color identities and creates a targeted partner search', () => {
    const deck = createEmptyDeck()
    deck.commander = card('Pir', 'Partner with Toothy', undefined, ['G'])
    deck.partnerCommander = card('Toothy', 'Partner with Pir', undefined, ['U'])
    expect(getCommanderColorIdentity(deck)).toEqual(['G', 'U'])
    expect(getPartnerSearchFilter(deck.commander)).toBe('!"Toothy"')
  })
})
