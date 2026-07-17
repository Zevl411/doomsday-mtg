import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'

const { getSession, onAuthStateChange, signInWithOtp } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession,
      onAuthStateChange,
      signInWithOtp,
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
})
