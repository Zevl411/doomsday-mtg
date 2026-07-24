import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_USER_PREFERENCES } from '../models/userPreferences'
import { useUserPreferencesStore } from './userPreferences'

const mocks = vi.hoisted(() => ({
  saveUserPreferences: vi.fn(),
}))

vi.mock('../repositories/userPreferencesRepository', () => ({
  loadUserPreferences: vi.fn(),
  saveUserPreferences: mocks.saveUserPreferences,
}))

describe('userPreferences store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.saveUserPreferences.mockReset().mockResolvedValue(true)
  })

  it('persists search placement without changing another preference', async () => {
    const store = useUserPreferencesStore()
    store.values = {
      ...DEFAULT_USER_PREFERENCES,
      defaultDeckDisplay: 'list',
    }

    expect(await store.saveDeckBuilderSearchSide('left')).toBe(true)
    expect(store.values.deckBuilderSearchSide).toBe('left')
    expect(store.values.defaultDeckDisplay).toBe('list')
    expect(mocks.saveUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        deckBuilderSearchSide: 'left',
        defaultDeckDisplay: 'list',
      }),
      null,
    )
  })

  it('restores the previous placement when persistence fails', async () => {
    mocks.saveUserPreferences.mockResolvedValue(false)
    const store = useUserPreferencesStore()

    expect(await store.saveDeckBuilderSearchSide('left')).toBe(false)
    expect(store.values.deckBuilderSearchSide).toBe('right')
  })

  it('applies and persists a card artwork theme immediately', async () => {
    const store = useUserPreferencesStore()
    const appTheme = {
      mode: 'card' as const,
      cardId: 'card-id',
      cardName: 'Black Lotus',
      artUrl: 'art.jpg',
      palette: {
        background: '#101018',
        surface: '#181826',
        surfaceBright: '#242438',
        surfaceLight: '#30304A',
        primary: '#D08040',
        primaryDarken: '#94582D',
        primaryLighten: '#EAB989',
        secondary: '#5080C0',
        accent: '#283C62',
        outline: '#826052',
      },
    }

    expect(await store.saveAppTheme(appTheme)).toBe(true)
    expect(store.values.appTheme).toEqual(appTheme)
    expect(mocks.saveUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ appTheme }),
      null,
    )
  })

  it('restores the prior theme when persistence fails', async () => {
    mocks.saveUserPreferences.mockResolvedValue(false)
    const store = useUserPreferencesStore()

    expect(await store.saveAppTheme({
      mode: 'card',
      cardId: 'card-id',
      cardName: 'Black Lotus',
      artUrl: 'art.jpg',
      palette: {
        background: '#101018',
        surface: '#181826',
        surfaceBright: '#242438',
        surfaceLight: '#30304A',
        primary: '#D08040',
        primaryDarken: '#94582D',
        primaryLighten: '#EAB989',
        secondary: '#5080C0',
        accent: '#283C62',
        outline: '#826052',
      },
    })).toBe(false)
    expect(store.values.appTheme).toEqual({ mode: 'default' })
  })
})
