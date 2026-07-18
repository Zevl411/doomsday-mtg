import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

let initializationPromise: Promise<void> | null = null
let authListenerRegistered = false

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    initialized: false,
    loading: false,
    errorMessage: '',
    registrationConfirmationRequired: false,
  }),

  getters: {
    isSignedIn: (state) => state.user !== null,
    username: (state): string =>
      state.user?.user_metadata?.username ??
      state.user?.user_metadata?.user_name ??
      state.user?.user_metadata?.full_name ??
      state.user?.email?.split('@')[0] ??
      'Guest',
  },

  actions: {
    async initialize() {
      if (this.initialized) return
      if (initializationPromise) return initializationPromise
      if (!supabase) {
        this.initialized = true
        return
      }

      initializationPromise = (async () => {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.warn('Supabase session initialization failed.', error)
        }
        this.user = data.session?.user ?? null
        this.initialized = true

        if (!authListenerRegistered) {
          supabase.auth.onAuthStateChange((_event, session) => {
            this.user = session?.user ?? null
          })
          authListenerRegistered = true
        }
      })()
      try {
        await initializationPromise
      } finally {
        initializationPromise = null
      }
    },

    async signIn(email: string, password: string): Promise<boolean> {
      if (!supabase) {
        this.errorMessage = 'Cloud sign-in is not configured.'
        return false
      }
      this.loading = true
      this.errorMessage = ''
      this.registrationConfirmationRequired = false
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
      this.registrationConfirmationRequired = false
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}#/auth/callback`
      const { data, error } = await supabase.auth.signUp({
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
      this.user = data.session?.user ?? null
      this.registrationConfirmationRequired = data.session === null
      return true
    },

    async sendMagicLink(email: string): Promise<boolean> {
      if (!supabase) {
        this.errorMessage = 'Cloud sign-in is not configured.'
        return false
      }
      this.loading = true
      this.errorMessage = ''
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}#/auth/callback`
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      this.loading = false
      if (error) {
        console.warn('Supabase magic-link sign-in failed.', error)
        this.errorMessage = 'Unable to send a sign-in link. Please try again.'
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
