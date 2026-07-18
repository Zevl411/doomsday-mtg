import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202607170010_connect_tournament_deck_ingestion.sql?raw'

const sql = migration.toLowerCase()

describe('connected tournament ingestion migration', () => {
  it('adds a durable Deck stage and normalization counters', () => {
    expect(sql).toContain("check (stage in ('tournaments', 'decks'))")
    expect(sql).toContain('deck_entries_considered')
    expect(sql).toContain('decks_completed')
    expect(sql).toContain('tournament_ingestion_batches_stage_queue_idx')
  })
})
