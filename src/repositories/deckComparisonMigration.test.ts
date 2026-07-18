import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607180001_add_deck_comparison.sql?raw'
import canonicalMigration from '../../supabase/migrations/202607180005_use_canonical_cards_for_deck_comparison.sql?raw'
import partialSampleMigration from '../../supabase/migrations/202607180006_allow_partial_deck_comparison_samples.sql?raw'
import performanceMigration from '../../supabase/migrations/202607180014_optimize_similar_tournament_decks.sql?raw'

const sql = migration.toLowerCase()
const canonicalSql = canonicalMigration.toLowerCase()
const partialSampleSql = partialSampleMigration.toLowerCase()
const performanceSql = performanceMigration.toLowerCase()

describe('deck comparison migration', () => {
  it('uses only complete matching Commander mainboards', () => {
    expect(sql).toContain('get_deck_comparison_aggregate')
    expect(sql).toContain('d.commander_key = p_commander_key')
    expect(sql).toContain("d.parsing_status = 'complete'")
    expect(sql).toContain("c.board = 'mainboard'")
    expect(sql).toContain('select distinct')
  })

  it('applies date, size, placement, region, and online filters', () => {
    expect(sql).toContain('p_start_date')
    expect(sql).toContain('p_end_date')
    expect(sql).toContain('p_minimum_tournament_size')
    expect(sql).toContain('p_maximum_standing')
    expect(sql).toContain('p_country_code')
    expect(sql).toContain('p_state_region')
    expect(sql).toContain('p_region_key')
    expect(sql).toContain('p_is_online')
  })

  it('computes bounded Jaccard similarity with deterministic ordering', () => {
    expect(sql).toContain('shared_count::numeric / union_count')
    expect(sql).toContain('case when union_count = 0 then 0')
    expect(sql).toContain('standing asc nulls last')
    expect(sql).toContain('event_date desc nulls last')
    expect(sql).toContain('limit greatest(1, least')
  })

  it('aggregates aliases through Oracle-first analytical identity', () => {
    expect(sql).toContain("'oracle:' || lower(c.oracle_id::text)")
    expect(sql).toContain("'name:' || lower(trim(c.normalized_card_key))")
    expect(sql).toContain('count(distinct tournament_deck_id)')
  })

  it('is public read-only analysis without private Deck access', () => {
    expect(sql).toContain('to anon, authenticated')
    expect(sql).not.toContain('from public.decks')
    expect(sql).not.toContain('auth.uid()')
  })

  it('reads newly normalized cards through canonical card details', () => {
    expect(canonicalSql).toContain(
      'from public.tournament_deck_card_details card',
    )
    expect(canonicalSql).not.toContain(
      'from public.tournament_deck_cards card',
    )
    expect(canonicalSql).toContain('get_deck_comparison_aggregate')
    expect(canonicalSql).toContain('get_similar_tournament_decks')
  })

  it('allows partial samples only when at least 25 mainboard cards exist', () => {
    expect(partialSampleSql).toContain(
      "deck.parsing_status in ('complete', 'partial')",
    )
    expect(partialSampleSql).toContain("card.board = 'mainboard'")
    expect(partialSampleSql).toContain('coalesce(sum(card.quantity), 0)')
    expect(partialSampleSql).toContain('>= 25')
    expect(partialSampleSql).toContain(
      'from public.tournament_decks_for_comparison deck',
    )
  })

  it('scores similar Decks in one grouped pass with covering indexes', () => {
    expect(performanceSql).toContain(
      'tournament_deck_cards_mainboard_cover_idx',
    )
    expect(performanceSql).toContain(
      'tournament_decks_commander_comparison_idx',
    )
    expect(performanceSql).toContain('deck_metrics.deck_card_count')
    expect(performanceSql).toContain('user_total.card_count')
    expect(performanceSql).toContain('deck_metrics.shared_count')
    expect(performanceSql).not.toContain(
      'where compared.tournament_deck_id = sample.id',
    )
  })

  it('checks comparison eligibility without canonical detail joins', () => {
    const viewDefinition = performanceSql.slice(
      performanceSql.indexOf(
        'create or replace view public.tournament_decks_for_comparison',
      ),
      performanceSql.indexOf(
        'create or replace function public.get_similar_tournament_decks',
      ),
    )
    expect(viewDefinition).toContain(
      'from public.tournament_deck_cards card',
    )
    expect(viewDefinition).not.toContain(
      'from public.tournament_deck_card_details card',
    )
  })
})
