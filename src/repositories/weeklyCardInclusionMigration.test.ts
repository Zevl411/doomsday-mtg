import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607180008_add_weekly_card_inclusion.sql?raw'

const sql = migration.toLowerCase()

describe('weekly card inclusion migration', () => {
  it('uses normalized public data and returns zero-inclusion weeks', () => {
    expect(sql).toContain('get_commander_card_inclusion_by_week')
    expect(sql).toContain("date_trunc('week', tournament.event_date)")
    expect(sql).toContain('left join weekly_cards using (week_start)')
    expect(sql).toContain("deck.parsing_status = 'complete'")
    expect(sql).toContain("card.board = 'mainboard'")
  })

  it('grants bounded read access without exposing private Decks', () => {
    expect(sql).toContain('to anon, authenticated')
    expect(sql).not.toContain('public.decks')
    expect(sql).not.toContain('source_payload')
  })
})
