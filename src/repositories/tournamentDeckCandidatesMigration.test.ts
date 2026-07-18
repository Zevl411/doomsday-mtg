import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607170013_add_tournament_deck_ingestion_candidates.sql?raw'

const sql = migration.toLowerCase()

describe('tournament Deck ingestion candidates migration', () => {
  it('selects missing or requested partial Decks before limiting', () => {
    expect(sql).toContain('left join public.tournament_decks')
    expect(sql).toContain('deck.id is null')
    expect(sql).toContain(
      "include_partial and deck.parsing_status = 'partial'",
    )
    expect(sql).toContain('limit least(greatest(result_limit, 1), 100)')
  })

  it('restricts candidate selection to the service role', () => {
    expect(sql).toContain('security definer')
    expect(sql).toContain('to service_role')
  })
})
