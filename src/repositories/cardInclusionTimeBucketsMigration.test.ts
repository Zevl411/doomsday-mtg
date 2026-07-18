import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607180009_add_card_inclusion_time_buckets.sql?raw'

const sql = migration.toLowerCase()

describe('card inclusion time bucket migration', () => {
  it('supports only the four selectable aggregate periods', () => {
    expect(sql).toContain('get_commander_card_inclusion_over_time')
    expect(sql).toContain("when 'day' then 'day'")
    expect(sql).toContain("when 'month' then 'month'")
    expect(sql).toContain("when 'year' then 'year'")
    expect(sql).toContain("else 'week'")
  })

  it('uses complete normalized public tournament Decks', () => {
    expect(sql).toContain("deck.parsing_status = 'complete'")
    expect(sql).toContain('public.tournament_deck_card_details')
    expect(sql).toContain('to anon, authenticated')
    expect(sql).not.toContain('public.decks')
  })
})
