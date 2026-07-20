import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  associationSuggestionRepository,
  parseAssociationSuggestionRows,
} from './associationSuggestionRepository'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const sourceId = '00000000-0000-4000-8000-000000000001'
const suggestedId = '00000000-0000-4000-8000-000000000002'
const validRow = {
  commander_key: 'thrasios // tymna',
  source_oracle_id: sourceId,
  source_card_name: 'Card X',
  suggested_oracle_id: suggestedId,
  suggested_card_name: 'Card D',
  support: 0.42,
  confidence: 42 / 57,
  lift: 1.4,
  occurrence_count: 42,
  joint_deck_count: 42,
  source_deck_count: 57,
  sample_size: 100,
}

beforeEach(() => mocks.rpc.mockReset())

describe('association suggestion repository validation', () => {
  it('maps exact evidence counts from a valid response', () => {
    expect(parseAssociationSuggestionRows([validRow])).toEqual([{
      commanderKey: 'thrasios // tymna',
      sourceOracleId: sourceId,
      sourceCardName: 'Card X',
      suggestedOracleId: suggestedId,
      suggestedCardName: 'Card D',
      support: 0.42,
      confidence: 42 / 57,
      lift: 1.4,
      occurrenceCount: 42,
      jointDeckCount: 42,
      sourceDeckCount: 57,
      sampleSize: 100,
    }])
  })

  it.each([
    {},
    [{ ...validRow, confidence: 2 }],
    [{ ...validRow, source_deck_count: 20 }],
    [{ ...validRow, sample_size: 20 }],
    [{ ...validRow, suggested_oracle_id: sourceId }],
    [{ ...validRow, source_oracle_id: 'not-a-uuid' }],
  ])('rejects malformed successful responses', (value) => {
    expect(() => parseAssociationSuggestionRows(value)).toThrow(
      'Association suggestion response was invalid.',
    )
  })

  it('deduplicates sources and passes the existing association filters', async () => {
    mocks.rpc.mockResolvedValue({ data: [validRow], error: null })
    await associationSuggestionRepository.getSuggestionEvidence(
      'thrasios // tymna',
      [sourceId, sourceId, 'invalid'],
      {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        minimumTournamentSize: 32,
        maximumStanding: 16,
        minimumSampleSize: 30,
        minimumOccurrenceCount: 5,
        minimumConfidence: 0.2,
        minimumLift: 1.1,
        minimumSupportingCards: 2,
        limit: 25,
      },
    )
    expect(mocks.rpc).toHaveBeenCalledWith(
      'get_association_based_card_suggestions',
      {
        p_commander_key: 'thrasios // tymna',
        p_source_oracle_ids: [sourceId],
        p_start_date: '2025-01-01',
        p_end_date: '2025-12-31',
        p_region_key: null,
        p_minimum_tournament_size: 32,
        p_maximum_standing: 16,
        p_minimum_sample_size: 30,
        p_minimum_occurrence_count: 5,
        p_minimum_confidence: 0.2,
        p_minimum_lift: 1.1,
        p_minimum_supporting_cards: 2,
        p_limit: 25,
      },
    )
  })

  it('does not call Supabase without Oracle-backed source cards', async () => {
    await expect(
      associationSuggestionRepository.getSuggestionEvidence(
        'kinnan',
        ['legacy-name'],
      ),
    ).resolves.toEqual([])
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('maps database errors to stable non-strategic copy', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('private') })
    await expect(
      associationSuggestionRepository.getSuggestionEvidence(
        'kinnan',
        [sourceId],
      ),
    ).rejects.toThrow('Unable to load association-based card suggestions.')
  })
})
