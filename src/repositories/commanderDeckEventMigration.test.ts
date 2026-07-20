import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607190002_add_commander_deck_card_filter.sql?raw'

describe('Commander Deck card-filter migration', () => {
  it('uses complete normalized mainboards and requires every identity', () => {
    expect(migration).toContain("deck.parsing_status = 'complete'")
    expect(migration).toContain("card.board = 'mainboard'")
    expect(migration).toContain('canonical.oracle_id')
    expect(migration).toContain('having count(distinct canonical.oracle_id)')
  })

  it('bounds card-filtered event results', () => {
    expect(migration).toContain(
      'limit greatest(1, least(coalesce(p_limit, 100), 250))',
    )
  })
})
