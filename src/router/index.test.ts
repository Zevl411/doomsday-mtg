import { describe, expect, it } from 'vitest'
import router from './index'

describe('router', () => {
  it('resolves the home route', () => {
    expect(router.resolve('/').name).toBe('home')
  })

  it('resolves the deck-builder route', () => {
    expect(router.resolve('/deck-builder').name).toBe('deck-builder')
  })

  it('resolves the deck-library route', () => {
    expect(router.resolve('/decks').name).toBe('deck-library')
  })

  it('resolves Supabase auth and callback routes under hash history', () => {
    expect(router.resolve('/auth').name).toBe('auth')
    expect(router.resolve('/auth/callback').name).toBe('auth-callback')
  })

  it('resolves unknown paths to the not-found route', () => {
    expect(router.resolve('/missing-page').name).toBe('not-found')
  })

  it('resolves tournament explorer and hidden ingestion routes', () => {
    expect(router.resolve('/metagame').name).toBe('metagame')
    expect(router.resolve('/commanders/kinnan').name).toBe('commander-metagame')
    expect(router.resolve('/tournaments').name).toBe('tournaments')
    expect(router.resolve('/tournaments/event-id').name).toBe('tournament-detail')
    expect(router.resolve('/admin/ingestion').name).toBe('admin-ingestion')
  })
})
