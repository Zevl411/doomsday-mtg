import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607170006_create_tournament_decks.sql?raw'

const sql = migration.toLowerCase()

describe('tournament Deck migration', () => {
  it('creates one normalized Deck per entry and idempotent cards', () => {
    expect(sql).toContain('tournament_entry_id uuid not null unique')
    expect(sql).toContain('unique (tournament_deck_id, board, normalized_card_key)')
    expect(sql).toContain('quantity integer not null check (quantity > 0)')
  })

  it('allows public reads without browser writes', () => {
    expect(sql).toContain('for select to anon, authenticated')
    expect(sql).toContain('revoke insert, update, delete')
  })

  it('aggregates complete mainboards by Deck presence', () => {
    expect(sql).toContain("d.parsing_status = 'complete'")
    expect(sql).toContain("where c.board = 'mainboard'")
    expect(sql).toContain('count(distinct c.tournament_deck_id)')
    expect(sql).toContain('c.decks::numeric / t.total')
  })
})
