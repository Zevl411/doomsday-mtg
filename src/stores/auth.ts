import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    initialized: false,
    loading: false,
    errorMessage: '',
  }),

  getters: {
    isSignedIn: (state) => state.user !== null,
  },

  actions: {
    async initialize() {
      if (!supabase || this.initialized) {
        this.initialized = true
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.warn('Supabase session initialization failed.', error)
      }
      this.user = data.session?.user ?? null
      this.initialized = true

      supabase.auth.onAuthStateChange((_event, session) => {
        this.user = session?.user ?? null
      })
    },

    async signIn(email: string, password: string): Promise<boolean> {
      if (!supabase) {
        this.errorMessage = 'Cloud sign-in is not configured.'
        return false
      }
      this.loading = true
      this.errorMessage = ''
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      this.loading = false
      if (error) {
        console.warn('Supabase sign-in failed.', error)
        this.errorMessage = 'Unable to sign in. Check your details and try again.'
        return false
      }
      return true
    },

    async register(email: string, password: string): Promise<boolean> {
      if (!supabase) {
        this.errorMessage = 'Cloud registration is not configured.'
        return false
      }
      this.loading = true
      this.errorMessage = ''
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}#/auth/callback`
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      })
      this.loading = false
      if (error) {
        console.warn('Supabase registration failed.', error)
        this.errorMessage = 'Unable to create the account. Please try again.'
        return false
      }
      return true
    },

    async signOut() {
      if (supabase) {
        const { error } = await supabase.auth.signOut()
        if (error) console.warn('Supabase sign-out failed.', error)
      }
      this.user = null
    },
  },
})
