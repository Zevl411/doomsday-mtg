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
})
