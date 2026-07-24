import { describe, expect, it } from 'vitest'
import { DEFAULT_USER_PREFERENCES } from '../models/userPreferences'
import { normalizePreferences } from './userPreferencesRepository'

describe('user preference response validation', () => {
  it('keeps the Oracle default when app theme data is absent', () => {
    expect(normalizePreferences({}).appTheme).toEqual({ mode: 'default' })
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
