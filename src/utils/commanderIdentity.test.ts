import { describe, expect, it } from 'vitest'
import { normalizeCommanderIdentity } from './commanderIdentity'

describe('normalizeCommanderIdentity', () => {
  it('normalizes casing and whitespace for a single Commander', () => {
    expect(normalizeCommanderIdentity('  Kinnan,   Bonder Prodigy ').key).toBe(
      'kinnan, bonder prodigy',
    )
  })

  it.each([
    'Tymna the Weaver / Kraum, Ludevic’s Opus',
    'kraum, ludevic’s opus//tymna the weaver',
    'Tymna the Weaver & Kraum, Ludevic’s Opus',
    'Kraum, Ludevic’s Opus with Tymna the Weaver',
  ])('groups partner separator variation: %s', (name) => {
    expect(normalizeCommanderIdentity(name).key).toBe(
      'kraum, ludevic’s opus // tymna the weaver',
    )
  })

  it('retains punctuation in stable identities', () => {
    expect(normalizeCommanderIdentity("Kenrith, the Returned King").key).toBe(
      'kenrith, the returned king',
    )
  })
})
