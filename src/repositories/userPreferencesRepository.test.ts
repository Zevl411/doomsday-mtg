import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_USER_PREFERENCES } from '../models/userPreferences'
import {
  normalizePreferences,
  saveUserPreferences,
} from './userPreferencesRepository'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}))

beforeEach(() => {
  mocks.upsert.mockReset()
  mocks.from.mockReset().mockReturnValue({
    upsert: mocks.upsert,
  })
})

describe('user preference response validation', () => {
  it('keeps the Oracle default when app theme data is absent', () => {
    const preferences = normalizePreferences({})
    expect(preferences.appTheme).toEqual({ mode: 'default' })
    expect(preferences.priceCurrency).toBe('USD')
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

  it('retries without price currency during a rolling schema deployment', async () => {
    mocks.upsert
      .mockResolvedValueOnce({
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'price_currency' column of 'user_preferences' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null })

    await expect(saveUserPreferences(
      DEFAULT_USER_PREFERENCES,
      'user-one',
    )).resolves.toBe(true)

    expect(mocks.upsert).toHaveBeenCalledTimes(2)
    expect(mocks.upsert.mock.calls[0]?.[0]).toHaveProperty(
      'price_currency',
      'USD',
    )
    expect(mocks.upsert.mock.calls[1]?.[0]).not.toHaveProperty(
      'price_currency',
    )
  })
})
