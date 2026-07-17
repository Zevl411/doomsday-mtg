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

  it('resolves unknown paths to the not-found route', () => {
    expect(router.resolve('/missing-page').name).toBe('not-found')
  })
})
