import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607180002_create_canonical_cards.sql?raw'

const sql = migration.toLowerCase()

describe('canonical card migration', () => {
  it('stores card facts once and provider spellings as aliases', () => {
    expect(sql).toContain('create table if not exists public.canonical_cards')
    expect(sql).toContain(
      'create table if not exists public.canonical_card_aliases',
    )
    expect(sql).toContain('oracle_id uuid unique')
    expect(sql).toContain('normalized_card_key text primary key')
  })

  it('links compact tournament rows to canonical cards', () => {
    expect(sql).toContain('add column if not exists canonical_card_id uuid')
    expect(sql).toContain(
      'tournament_deck_cards_canonical_unique_idx',
    )
    expect(sql).toContain(
      'tournament_deck_id, board, canonical_card_id',
    )
    expect(sql).toContain('drop index if exists public.tournament_deck_cards_key_idx')
    expect(sql).toContain('keep_normalized_entry_payload_compact')
  })

  it('backfills legacy rows and centralizes compatibility reads', () => {
    expect(sql).toContain('insert into public.canonical_cards')
    expect(sql).toContain('update public.tournament_deck_cards deck_card')
    expect(sql).toContain(
      'create or replace view public.tournament_deck_card_details',
    )
    expect(sql).toContain('with (security_invoker = true)')
  })

  it('moves inclusion and comparison RPCs onto canonical details', () => {
    expect(sql).toContain('get_commander_card_inclusion')
    expect(sql).toContain('get_deck_comparison_aggregate')
    expect(sql).toContain('get_similar_tournament_decks')
    expect(sql.match(/from public\.tournament_deck_card_details/g))
      .toHaveLength(3)
  })

  it('allows public reads without browser writes', () => {
    expect(sql).toContain('for select to anon, authenticated')
    expect(sql).toContain('revoke insert, update, delete')
  })
})
