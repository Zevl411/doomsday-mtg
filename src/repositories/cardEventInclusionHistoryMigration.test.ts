import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607190005_add_card_event_inclusion_history.sql?raw'

const sql = migration.toLowerCase()

describe('card event inclusion history migration', () => {
  it('counts card appearances in distinct tournaments', () => {
    expect(sql).toContain(
      'count(distinct eligible.event_id)::bigint as events',
    )
    expect(sql).toContain('card_event_count bigint')
    expect(sql).toContain('event_inclusion_rate numeric')
  })

  it('keeps history limited to complete normalized Decks', () => {
    expect(sql).toContain("deck.parsing_status = 'complete'")
    expect(sql).toContain("card.board = 'mainboard'")
  })

  it('reloads PostgREST after restoring RPC access', () => {
    expect(sql).toContain('to anon, authenticated')
    expect(sql).toContain("notify pgrst, 'reload schema'")
  })
})
