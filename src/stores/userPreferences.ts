import { defineStore } from 'pinia'
import {
  DEFAULT_USER_PREFERENCES,
  type AppThemePreference,
  type DeckBuilderSearchSide,
  type UserPreferences,
} from '../models/userPreferences'
import {
  loadUserPreferences,
  saveUserPreferences,
} from '../repositories/userPreferencesRepository'

export const useUserPreferencesStore = defineStore('userPreferences', {
  state: () => ({
    values: { ...DEFAULT_USER_PREFERENCES } as UserPreferences,
    userId: null as string | null,
    initialized: false,
  }),
  actions: {
    async initialize(userId: string | null) {
      this.userId = userId
      this.values = await loadUserPreferences(userId)
      this.initialized = true
    },
    async save(values: UserPreferences) {
      this.values = { ...values }
      return saveUserPreferences(this.values, this.userId)
    },
    /**
     * Search placement is a live layout preference, unlike the remaining
     * dialog draft. Persist only this field and restore the previous state if
     * remote or browser persistence fails.
     */
    async saveDeckBuilderSearchSide(side: DeckBuilderSearchSide) {
      if (side === this.values.deckBuilderSearchSide) return true

      const previousValues = { ...this.values }
      this.values = {
        ...this.values,
        deckBuilderSearchSide: side,
      }
      const saved = await saveUserPreferences(this.values, this.userId)
      if (!saved) this.values = previousValues
      return saved
    },
    /**
     * Theme choices preview across the entire application, so they persist as
     * soon as the user chooses a card or returns to the Oracle default.
     */
    async saveAppTheme(appTheme: AppThemePreference) {
      const previousValues = { ...this.values }
      this.values = {
        ...this.values,
        appTheme,
      }
      const saved = await saveUserPreferences(this.values, this.userId)
      if (!saved) this.values = previousValues
      return saved
    },
  },
})
