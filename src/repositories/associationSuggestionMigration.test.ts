import { describe, expect, it } from 'vitest'
import sql from '../../supabase/migrations/202607190004_prune_suggestion_candidates_early.sql?raw'

describe('association suggestion SQL regression boundaries', () => {
  it('reuses complete Oracle-backed mainboard association inputs', () => {
    expect(sql).toContain("deck.parsing_status = 'complete'")
    expect(sql).toContain("card.board = 'mainboard'")
    expect(sql).toContain('canonical.oracle_id is not null')
    expect(sql).not.toMatch(/parsing_status\s+in\s*\([^)]*partial/i)
  })

  it('uses the v0.4 support, confidence, and lift formulas', () => {
    expect(sql).toContain(
      'joint.joint_decks::numeric /\\n        nullif(sample.sample_size, 0) support'
        .replace('\\n', '\n'),
    )
    expect(sql).toContain(
      'joint.joint_decks::numeric /\\n        nullif(source_totals.deck_count, 0) confidence'
        .replace('\\n', '\n'),
    )
    expect(sql).toContain('candidate_totals.deck_count::numeric')
  })

  it('batches source cards and requires distinct supporting evidence', () => {
    expect(sql).toContain('p_source_oracle_ids uuid[]')
    expect(sql).toContain(
      'count(distinct thresholded.source_card_id)',
    )
    expect(sql).toContain('p_minimum_supporting_cards integer default 2')
  })

  it('excludes existing source cards and retains all sample filters', () => {
    expect(sql).toContain('left join requested_sources source')
    expect(sql).toContain('where source.id is null')
    expect(
      sql.indexOf('candidate_deck_cards as materialized'),
    ).toBeLessThan(sql.indexOf('ranked_candidates as'))
    expect(sql).toContain('p_start_date')
    expect(sql).toContain('p_end_date')
    expect(sql).toContain('tournament.region_key = p_region_key')
    expect(sql).toContain('p_minimum_tournament_size')
    expect(sql).toContain('entry.standing <= p_maximum_standing')
  })
})
