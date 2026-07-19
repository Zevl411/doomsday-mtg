import type { Deck } from '../models/deck'
import { getDeckCommanders } from './commanderPairing'
import { getColorIdentityViolations, isBasicLand } from './deckLegality'
import { getTotalDeckCardCount } from './deckValidation'

export type DeckValiditySeverity = 'warning' | 'error'

export interface DeckValidityIssue {
  rule: string
  severity: DeckValiditySeverity
  message: string
}

interface DeckValidityRule {
  id: string
  severity: DeckValiditySeverity
  evaluate: (deck: Deck) => string[]
}

// Rule severity is configuration, not component logic. Future rules can be
// added, removed, or moved between warning and error without changing callers.
const deckValidityRules: DeckValidityRule[] = [
  {
    id: 'deck-size',
    severity: 'warning',
    evaluate: (deck) => {
      const count = getTotalDeckCardCount(deck)
      return count === 100
        ? []
        : [`Commander decks must contain 100 cards; this deck contains ${count}.`]
    },
  },
  {
    id: 'singleton',
    severity: 'warning',
    evaluate: (deck) =>
      deck.cards
        .filter((entry) => entry.quantity > 1 && !isBasicLand(entry.card))
        .map((entry) => `${entry.card.name} exceeds the singleton limit.`),
  },
  {
    id: 'color-identity',
    severity: 'warning',
    evaluate: (deck) =>
      getColorIdentityViolations(deck).length
        ? [
            "This deck contains cards outside the Commander's color identity.",
          ]
        : [],
  },
  {
    id: 'banned-card',
    severity: 'error',
    evaluate: (deck) =>
      [...getDeckCommanders(deck), ...deck.cards.map((entry) => entry.card)]
        .filter((card) => card.legalities?.commander === 'banned')
        .map((card) => `${card.name} is banned in Commander.`),
  },
]

export function getDeckValidityIssues(deck: Deck): DeckValidityIssue[] {
  const issues = deckValidityRules.flatMap((rule) =>
    rule.evaluate(deck).map((message) => ({
      rule: rule.id,
      severity: rule.severity,
      message,
    })),
  )
  return [
    ...new Map(issues.map((issue) => [issue.message, issue])).values(),
  ]
}

export function getDeckValiditySeverity(
  issues: DeckValidityIssue[],
): DeckValiditySeverity | null {
  if (issues.some((issue) => issue.severity === 'error')) return 'error'
  return issues.length ? 'warning' : null
}
