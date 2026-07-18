import { describe, expect, it } from 'vitest'
import {
  buildExcludedTitleKeywords,
  evaluateTournamentTitle,
} from './tournamentRelevance.ts'

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

  it('excludes Commander Brackets 1 through 4, including compact provider tags', () => {
    expect(evaluateTournamentTitle('[CoBr3] Liga Moii Julio 1/5')).toMatchObject({
      included: false,
      matchedKeyword: 'Commander Bracket 1–4',
    })
    expect(evaluateTournamentTitle('Commander Bracket 2 League').included)
      .toBe(false)
    expect(evaluateTournamentTitle('Bracket 1 Commander Night').included)
      .toBe(false)
    expect(evaluateTournamentTitle('[CoBr4] Optimized Commander').included)
      .toBe(false)
    expect(evaluateTournamentTitle('Commander Bracket 5 Championship').included)
      .toBe(true)
  })

  it('normalizes translated casual-event signals and accents', () => {
    expect(evaluateTournamentTitle('Commander Económico').included).toBe(false)
    expect(evaluateTournamentTitle('Torneo para Principiantes').included)
      .toBe(false)
    expect(evaluateTournamentTitle('Préconstruit Débutant').included).toBe(false)
    expect(evaluateTournamentTitle('Baixa Potência Commander').included)
      .toBe(false)
  })

  it('recognizes common Russian, Chinese, Japanese, and Korean signals', () => {
    expect(evaluateTournamentTitle('Бюджетный Командир').included).toBe(false)
    expect(evaluateTournamentTitle('休闲指挥官联赛').included).toBe(false)
    expect(evaluateTournamentTitle('初心者コマンダー交流会').included).toBe(false)
    expect(evaluateTournamentTitle('캐주얼 커맨더 리그').included).toBe(false)
  })

  it('adds configured regional terms without removing defaults', () => {
    const keywords = buildExcludedTitleKeywords([
      'regional phrase, tienda social',
      undefined,
    ])

    expect(keywords).toContain('budget')
    expect(keywords).toContain('regional phrase')
    expect(keywords).toContain('tienda social')
  })
})
