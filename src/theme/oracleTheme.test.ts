import { describe, expect, it } from 'vitest'
import { oracleDarkTheme } from './oracleTheme'

describe('Oracle theme', () => {
  it('keeps the approved subdued chrome palette', () => {
    expect(oracleDarkTheme.dark).toBe(true)
    expect(oracleDarkTheme.colors?.background).toBe('#0F0D18')
    expect(oracleDarkTheme.colors?.surface).toBe('#171321')
    expect(oracleDarkTheme.colors?.primary).toBe('#D7A24A')
    expect(oracleDarkTheme.colors?.secondary).toBe('#9462A0')
    expect(oracleDarkTheme.colors?.accent).toBe('#3A183D')
    expect(oracleDarkTheme.colors?.['placement-gold']).toBe('#D4AF37')
    expect(oracleDarkTheme.colors?.['placement-top-cut']).toBe('#587A9B')
  })

  it('uses readable approved colors for code and keyboard hints', () => {
    expect(oracleDarkTheme.variables?.['theme-kbd']).toBe('#21182B')
    expect(oracleDarkTheme.variables?.['theme-on-kbd']).toBe('#F4E6C5')
    expect(oracleDarkTheme.variables?.['theme-code']).toBe('#21182B')
    expect(oracleDarkTheme.variables?.['theme-on-code']).toBe('#F1D39A')
  })
})
