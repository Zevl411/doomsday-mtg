import { defineStore } from 'pinia'
import {
  DEFAULT_USER_PREFERENCES,
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
  },
})
