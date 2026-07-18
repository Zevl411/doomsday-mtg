import { describe, expect, it } from 'vitest'
import { createEmptyDeck } from '../models/createDeck'
import type { ScryfallCard } from '../types/card'
import {
  getDeckValidityIssues,
  getDeckValiditySeverity,
} from './deckValidity'

const commander: ScryfallCard = {
  id: 'commander',
  name: 'Test Commander',
  type_line: 'Legendary Creature',
  color_identity: [],
}
const card: ScryfallCard = {
  id: 'card',
  name: 'Test Card',
  type_line: 'Artifact',
  color_identity: [],
}

describe('deck validity', () => {
  it('classifies size and singleton rules as warnings', () => {
    const deck = createEmptyDeck()
    deck.commander = commander
    deck.cards = [{ card, quantity: 2 }]
    const issues = getDeckValidityIssues(deck)

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'deck-size', severity: 'warning' }),
      expect.objectContaining({ rule: 'singleton', severity: 'warning' }),
    ]))
    expect(getDeckValiditySeverity(issues)).toBe('warning')
  })

  it('promotes banned Commander cards to error severity', () => {
    const deck = createEmptyDeck()
    deck.commander = commander
    deck.cards = [{
      card: {
        ...card,
        legalities: { commander: 'banned' },
      },
      quantity: 1,
    }]
    const issues = getDeckValidityIssues(deck)

    expect(issues).toContainEqual(expect.objectContaining({
      rule: 'banned-card',
      severity: 'error',
    }))
    expect(getDeckValiditySeverity(issues)).toBe('error')
  })
})
