import { describe, expect, it } from 'vitest'
import { DEFAULT_USER_PREFERENCES } from '../models/userPreferences'
import { normalizePreferences } from './userPreferencesRepository'

describe('user preference response validation', () => {
  it('keeps the Oracle default when app theme data is absent', () => {
    const preferences = normalizePreferences({})
    expect(preferences.appTheme).toEqual({ mode: 'default' })
    expect(preferences.priceCurrency).toBe('USD')
    expect(preferences.showGridCardPrices).toBe(false)
  })

  it('preserves the Deck grid price preference only when it is boolean', () => {
    expect(normalizePreferences({
      showGridCardPrices: true,
    }).showGridCardPrices).toBe(true)
    expect(normalizePreferences({
      showGridCardPrices: 'yes' as never,
    }).showGridCardPrices).toBe(false)
  })

  it('falls back safely when a stored app theme is malformed', () => {
    expect(normalizePreferences({
      ...DEFAULT_USER_PREFERENCES,
      appTheme: {
        mode: 'card',
        cardId: '',
        cardName: '',
        artUrl: '',
        palette: {} as never,
      },
    }).appTheme).toEqual({ mode: 'default' })
  })
})
