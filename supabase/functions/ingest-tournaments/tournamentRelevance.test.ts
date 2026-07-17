import { describe, expect, it } from 'vitest'
import { evaluateTournamentTitle } from './tournamentRelevance'

describe('tournament relevance', () => {
  it('excludes explicit casual, budget, and precon titles', () => {
    expect(evaluateTournamentTitle('Friday Casual Commander').included).toBe(false)
    expect(evaluateTournamentTitle('Budget cEDH League')).toMatchObject({
      included: false,
      matchedKeyword: 'budget',
    })
    expect(evaluateTournamentTitle('Pre-Con Learn to Play').included).toBe(false)
  })

  it('keeps neutral and explicitly competitive titles', () => {
    expect(evaluateTournamentTitle('Mox Masters January').included).toBe(true)
    expect(evaluateTournamentTitle('Competitive Commander Open').included).toBe(true)
    expect(evaluateTournamentTitle('cEDH Championship').included).toBe(true)
  })

  it('does not match part of an unrelated word', () => {
    expect(evaluateTournamentTitle('Casualty Response Invitational').included).toBe(true)
  })
})
