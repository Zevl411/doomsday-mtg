import { describe, expect, it } from 'vitest';

import sql from '../../supabase/migrations/202607180019_add_card_association_engine.sql?raw';

describe('card association SQL regression boundaries', () => {
  it('uses complete normalized mainboards and Oracle-backed identities only', () => {
    expect(sql).toContain("deck.parsing_status = 'complete'");
    expect(sql).toContain("card.board = 'mainboard'");
    expect(sql).toContain('canonical.oracle_id is not null');
    expect(sql).not.toMatch(/parsing_status\s+in\s*\([^)]*partial/i);
  });

  it('calculates support, confidence, and lift from one eligible sample', () => {
    expect(sql).toContain('joint.deck_count::numeric / nullif(sample.sample_size, 0) support');
    expect(sql).toContain(
      'joint.deck_count::numeric / nullif(source_total.deck_count, 0) confidence',
    );
    expect(sql).toContain('candidate_totals.deck_count::numeric');
  });

  it('supports paired keys, date, region, event-size, and placement filters', () => {
    expect(sql).toContain('deck.commander_key = p_commander_key');
    expect(sql).toContain('p_start_date');
    expect(sql).toContain('p_end_date');
    expect(sql).toContain('tournament.region_key = p_region_key');
    expect(sql).toContain('p_minimum_tournament_size');
    expect(sql).toContain('entry.standing <= p_maximum_standing');
  });

  it('protects minimum samples and avoids duplicate identity rows', () => {
    expect(sql).toContain('p_minimum_sample_size integer default 20');
    expect(sql).toContain('p_minimum_occurrence_count integer default 3');
    expect(sql).toContain('primary key (commander_key, source_card_id, associated_card_id)');
    expect(sql).toContain('group by card.tournament_deck_id, card.canonical_card_id');
  });
});
