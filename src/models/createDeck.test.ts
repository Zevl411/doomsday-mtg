import { describe, expect, it, vi } from 'vitest'
import { cloneDeck, createEmptyDeck } from './createDeck'
import type { ScryfallCard } from '../types/card'

const card: ScryfallCard = {
  id: 'card',
  name: 'Card',
  type_line: 'Artifact',
  color_identity: [],
}

describe('deck factory', () => {
  it('creates uniquely identified empty decks with defaults', () => {
    const first = createEmptyDeck()
    const second = createEmptyDeck('  Named Deck  ')

    expect(first.id).not.toBe(second.id)
    expect(first.name).toBe('Untitled Deck')
    expect(first.visibility).toBe('public')
    expect(second.name).toBe('Named Deck')
    expect(first.createdAt).toBeTruthy()
    expect(first.updatedAt).toBeTruthy()
    expect(first).toMatchObject({
      commander: null,
      cards: [],
      sideboard: [],
      maybeboard: [],
      considering: [],
    })
  })

  it('clones all content under a new identity without shared arrays', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const source = createEmptyDeck('Original')
    source.commander = card
    source.cards.push({ card, quantity: 1 })
    source.sideboard.push({ card, quantity: 2 })

    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'))
    const clone = cloneDeck(source)

    expect(clone.id).not.toBe(source.id)
    expect(clone.name).toBe('Original Copy')
    expect(clone.createdAt).not.toBe(source.createdAt)
    expect(clone.cards).not.toBe(source.cards)
    expect(clone.cards[0]).not.toBe(source.cards[0])
    expect(clone.sideboard).not.toBe(source.sideboard)

    clone.cards[0]!.quantity = 8
    expect(source.cards[0]?.quantity).toBe(1)
    vi.useRealTimers()
  })
})
