import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'

const {
  getSession,
  onAuthStateChange,
  signInWithOtp,
  signInWithPassword,
  signUp,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession,
      onAuthStateChange,
      signInWithOtp,
      signInWithPassword,
      signUp,
    },
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  getSession.mockReset().mockResolvedValue({
    data: { session: null },
    error: null,
  })
  onAuthStateChange.mockReset()
  signInWithOtp.mockReset().mockResolvedValue({ error: null })
  signInWithPassword.mockReset().mockResolvedValue({ error: null })
  signUp.mockReset().mockResolvedValue({
    data: { session: null, user: { id: 'new-user' } },
    error: null,
  })
})

describe('authentication store', () => {
  it('shares initialization, registers one listener, and supports email links', async () => {
    const auth = useAuthStore()

    await Promise.all([auth.initialize(), auth.initialize()])
    await auth.initialize()

    expect(getSession).toHaveBeenCalledOnce()
    expect(onAuthStateChange).toHaveBeenCalledOnce()
    await expect(auth.sendMagicLink('player@example.com')).resolves.toBe(true)
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'player@example.com',
        options: {
          emailRedirectTo: expect.stringMatching(/\/#\/auth\/callback$/),
        },
      }),
    )
  })

  it('waits for email confirmation instead of signing in new registrations', async () => {
    const auth = useAuthStore()

    await expect(
      auth.register('new-player@example.com', 'password'),
    ).resolves.toBe(true)

    expect(auth.isSignedIn).toBe(false)
    expect(auth.registrationConfirmationRequired).toBe(true)
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new-player@example.com',
        options: {
          emailRedirectTo: expect.stringMatching(/\/#\/auth\/callback$/),
        },
      }),
    )
  })

  it('recognizes registration sessions when email confirmation is disabled', async () => {
    const user = { id: 'new-user', user_metadata: {} }
    signUp.mockResolvedValueOnce({
      data: { session: { user }, user },
      error: null,
    })
    const auth = useAuthStore()

    await auth.register('new-player@example.com', 'password')

    expect(auth.isSignedIn).toBe(true)
    expect(auth.registrationConfirmationRequired).toBe(false)
  })
})
