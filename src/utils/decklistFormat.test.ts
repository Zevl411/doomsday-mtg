import { describe, expect, it } from 'vitest'
import { detectDecklistFormat } from './decklistFormat'

describe('detectDecklistFormat', () => {
  it('detects Archidekt before the broader Arena metadata pattern', () => {
    expect(
      detectDecklistFormat(
        '**Mainboard**\n**Ramp**\n1 Sol Ring (CMM) 396',
      ),
    ).toBe('archidekt')
  })

  it('still detects an Arena export with printing metadata', () => {
    expect(
      detectDecklistFormat(
        'Deck\n1 Sol Ring (CMM) 396\nSideboard\n1 Negate (MOM) 68',
      ),
    ).toBe('arena')
  })

  it('honors the characteristic tracked-board formats', () => {
    expect(detectDecklistFormat('MAINBOARD\n1 Sol Ring')).toBe('moxfield')
    expect(detectDecklistFormat('4 Counterspell\nSideboard\n2 Negate')).toBe(
      'mtgo',
    )
  })
})
