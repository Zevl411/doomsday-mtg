import { describe, expect, it } from 'vitest'
import {
  parseCommanderReadinessRows,
  parseDataHealthSummary,
  parseIngestionJobHealthRows,
  parseRegionCoverageRows,
  parseUnresolvedCardRows,
} from './dataHealthRepository'

const numberFields = [
  'tournament_count', 'entry_count', 'topdeck_tournament_count',
  'edhtop16_tournament_count', 'tournament_with_location_count',
  'topdeck_entry_count', 'edhtop16_entry_count',
  'tournament_without_location_count', 'tournament_missing_date_count',
  'excluded_casual_event_count', 'structured_entry_count',
  'plaintext_entry_count', 'url_only_entry_count',
  'missing_decklist_entry_count', 'normalized_deck_count',
  'complete_deck_count', 'partial_deck_count', 'unavailable_deck_count',
  'invalid_deck_count', 'canonical_card_count', 'canonical_alias_count',
  'canonical_with_oracle_count', 'fallback_identity_count',
  'unresolved_card_row_count', 'tournament_card_count',
  'tournament_card_without_canonical_count', 'suspicious_alias_count',
  'commander_with_one_complete_count', 'commander_with_five_complete_count',
  'commander_with_twenty_complete_count', 'commander_with_fifty_complete_count',
  'commander_without_complete_count', 'paired_commander_sample_count',
  'regional_complete_deck_count',
  'possible_match_count', 'linked_event_count', 'pending_job_count',
  'running_job_count', 'failed_job_count', 'paused_job_count',
  'completed_job_count', 'stale_job_count',
]

describe('data health response validation', () => {
  it('parses the single aggregate row and nullable timestamps', () => {
    const row = Object.fromEntries(numberFields.map((field) => [field, 1]))
    Object.assign(row, {
      first_event_date: null,
      latest_event_date: '2026-07-18T00:00:00Z',
      last_successful_tournament_ingestion: null,
      last_successful_deck_normalization: null,
    })
    expect(parseDataHealthSummary([row])).toMatchObject({
      tournamentCount: 1,
      firstEventDate: undefined,
      latestEventDate: '2026-07-18T00:00:00Z',
    })
  })

  it('rejects missing, malformed, and extra aggregate rows', () => {
    expect(() => parseDataHealthSummary([])).toThrow(
      'The data health response was invalid.',
    )
    expect(() => parseDataHealthSummary([{}, {}])).toThrow()
    expect(() => parseDataHealthSummary([{
      ...Object.fromEntries(numberFields.map((field) => [field, 1])),
      first_event_date: null,
      latest_event_date: null,
      last_successful_tournament_ingestion: null,
      last_successful_deck_normalization: 'invalid-but-still-a-string',
      tournament_count: '1',
    }])).toThrow()
  })

  it('validates readiness rows and preserves paired diagnostics', () => {
    const row = {
      commander_key: 'a // b',
      commander_name: 'A // B',
      complete_deck_count: 5,
      partial_deck_count: 1,
      unavailable_deck_count: 0,
      tournament_count: 2,
      entry_count: 6,
      first_event_date: null,
      latest_event_date: null,
      country_count: 1,
      state_region_count: 1,
      paired_commander: true,
      inclusion_ready: true,
      comparison_ready: true,
      sample_status: 'limited',
      top16_sample_count: 2,
      first_place_sample_count: 1,
      regional_sample_count: 4,
      unresolved_card_rate: 0,
      representative_deck_id: null,
      alias_mismatch_count: 0,
      one_sided_extraction_failure_count: 1,
    }
    expect(parseCommanderReadinessRows([row])[0]).toMatchObject({
      commanderKey: 'a // b',
      pairedCommander: true,
      oneSidedExtractionFailureCount: 1,
    })
    expect(() => parseCommanderReadinessRows([{ ...row, sample_status: 'great' }]))
      .toThrow('The Commander readiness response was invalid.')
  })

  it('validates unresolved-card provider counts and ingestion jobs', () => {
    const unresolved = {
      normalized_name: 'unknown',
      display_name: 'Unknown',
      occurrence_count: 4,
      affected_deck_count: 3,
      affected_commander_count: 2,
      first_seen_at: null,
      last_seen_at: null,
      sample_issue_code: 'unknown_card',
      provider_breakdown: {},
      current_alias_match: false,
    }
    expect(parseUnresolvedCardRows([unresolved])[0]?.providerBreakdown)
      .toEqual({})
    expect(() => parseUnresolvedCardRows([{
      ...unresolved,
      provider_breakdown: { topdeck: 'four' },
    }])).toThrow('The unresolved-card report was invalid.')

    const job = {
      job_id: 'job',
      provider: 'topdeck',
      job_status: 'running',
      stage: 'decks',
      start_date: '2026-07-01',
      end_date: '2026-07-02',
      attempts: 2,
      updated_at: '2026-07-18T00:00:00Z',
      last_error: null,
      stale: false,
    }
    expect(parseIngestionJobHealthRows([job])[0]?.jobId).toBe('job')
    expect(() => parseIngestionJobHealthRows([{ ...job, attempts: '2' }]))
      .toThrow('The ingestion job health response was invalid.')
  })

  it('validates bounded regional coverage rows', () => {
    expect(parseRegionCoverageRows([{
      region_key: 'country:US',
      tournament_count: 2,
      entry_count: 20,
      complete_deck_count: 10,
    }])[0]?.regionKey).toBe('country:US')
    expect(() => parseRegionCoverageRows([{ region_key: 'country:US' }]))
      .toThrow('The region coverage response was invalid.')
  })
})
