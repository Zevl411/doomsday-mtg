import { describe, expect, it } from 'vitest'
import { getCompactCardName } from './cardName'

describe('compact card names', () => {
  it('stops at the first comma or space', () => {
    expect(getCompactCardName('Sisay, Weatherlight Captain')).toBe('Sisay')
    expect(getCompactCardName('Tymna the Weaver')).toBe('Tymna')
  })

  it('preserves single-word names and ignores outer whitespace', () => {
    expect(getCompactCardName('  Rograkh  ')).toBe('Rograkh')
  })
})
