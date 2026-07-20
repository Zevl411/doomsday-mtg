import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607200001_optimize_partner_card_associations.sql?raw'

describe('partner card association optimization migration', () => {
  const sql = migration.toLowerCase()

  it('indexes source-card lookups before eligible Deck expansion', () => {
    expect(sql).toContain(
      'on public.tournament_deck_cards(canonical_card_id, tournament_deck_id)',
    )
    expect(sql).toContain('source_decks as materialized')
    expect(sql).toContain('card.canonical_card_id = source_card.id')
  })

  it('keeps complete Deck and Commander boundaries', () => {
    expect(sql).toContain('deck.commander_key = p_commander_key')
    expect(sql).toContain("deck.parsing_status = 'complete'")
  })
})
