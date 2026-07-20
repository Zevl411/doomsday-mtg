import { describe, expect, it } from 'vitest'
import router from './index'

describe('router', () => {
  it('resolves the home route', () => {
    expect(router.resolve('/').name).toBe('home')
  })

  it('resolves the deck-builder route', () => {
    const route = router.resolve('/decks/deck-1')
    expect(route.name).toBe('deck-builder')
    expect(route.params.deckId).toBe('deck-1')
  })

  it('resolves the deck-library route', () => {
    expect(router.resolve('/decks').name).toBe('deck-library')
    expect(router.resolve('/decks/public').name).toBe('public-decks')
    expect(router.resolve('/decks/shared/deck-1').name).toBe('shared-deck')
    expect(router.resolve('/decks/deck-1/compare').name)
      .toBe('deck-comparison')
  })

  it('resolves Supabase auth and callback routes under hash history', () => {
    expect(router.resolve('/auth').name).toBe('auth')
    expect(router.resolve('/auth/callback').name).toBe('auth-callback')
  })

  it('resolves unknown paths to the not-found route', () => {
    expect(router.resolve('/missing-page').name).toBe('not-found')
  })

  it('resolves tournament explorer and hidden ingestion routes', () => {
    const metagame = router.resolve('/metagame')
    expect(metagame.name).toBe('metagame')
    expect(metagame.href).toContain('#/metagame')
    expect(router.resolve('/commanders/kinnan').name).toBe('commander-metagame')
    expect(router.resolve('/commanders/kinnan/cards').name).toBe('not-found')
    expect(router.resolve('/associations').name).toBe('card-associations')
    expect(router.resolve('/tournaments').name).toBe('tournaments')
    expect(router.resolve('/tournaments/event-id').name).toBe('tournament-detail')
    expect(router.resolve('/tournament-decks/deck-id').name)
      .toBe('tournament-deck-detail')
    expect(router.resolve('/regions').name).toBe('regions')
    expect(router.resolve('/admin/ingestion').name).toBe('admin-ingestion')
    const dataHealth = router.resolve('/admin/data-health')
    expect(dataHealth.name).toBe('admin-data-health')
    expect(dataHealth.meta.requiresAdmin).toBe(true)
  })
})
