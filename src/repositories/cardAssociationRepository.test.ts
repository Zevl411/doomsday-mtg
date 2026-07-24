import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cardAssociationRepository,
  parseCardAssociationClusterRows,
  parseCardAssociationRows,
} from './cardAssociationRepository';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

const oracleA = '00000000-0000-4000-8000-000000000001';
const oracleB = '00000000-0000-4000-8000-000000000002';

const validRow = {
  commander_key: 'thrasios // tymna',
  source_oracle_id: oracleA,
  source_card_name: 'Card A',
  associated_oracle_id: oracleB,
  associated_card_name: 'Card B',
  support: 0.3,
  confidence: 0.6,
  lift: 1.5,
  occurrence_count: 12,
  deck_count: 12,
  first_seen_at: '2025-01-01T00:00:00Z',
  last_seen_at: '2026-01-01T00:00:00Z',
  sample_size: 40,
};

beforeEach(() => mocks.rpc.mockReset());

describe('card association repository response validation', () => {
  it('maps valid association rows without unchecked response casts', () => {
    expect(parseCardAssociationRows([validRow])).toEqual([
      {
        commanderKey: 'thrasios // tymna',
        sourceOracleId: oracleA,
        sourceCardName: 'Card A',
        associatedOracleId: oracleB,
        associatedCardName: 'Card B',
        support: 0.3,
        confidence: 0.6,
        lift: 1.5,
        occurrenceCount: 12,
        deckCount: 12,
        firstSeenAt: '2025-01-01T00:00:00Z',
        lastSeenAt: '2026-01-01T00:00:00Z',
        sampleSize: 40,
      },
    ]);
  });

  it.each([
    {},
    [{ ...validRow, confidence: 1.1 }],
    [{ ...validRow, deck_count: 41 }],
    [{ ...validRow, associated_oracle_id: 'not-an-oracle-id' }],
    [{ ...validRow, first_seen_at: 'not-a-date' }],
  ])('rejects invalid successful RPC data', (value) => {
    expect(() => parseCardAssociationRows(value)).toThrow('Card association response was invalid.');
  });

  it('deduplicates validated cluster identities', () => {
    expect(
      parseCardAssociationClusterRows([
        {
          cluster_id: oracleA,
          member_oracle_ids: [oracleA, oracleB, oracleB, '00000000-0000-4000-8000-000000000003'],
          connection_count: 3,
          average_lift: 1.4,
          sample_size: 50,
        },
      ])[0]?.memberOracleIds,
    ).toHaveLength(3);
  });

  it('passes paired Commander and event filters to the RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: [validRow], error: null });
    await cardAssociationRepository.getAssociations('thrasios // tymna', oracleA, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      minimumTournamentSize: 32,
      maximumStanding: 16,
      minimumSampleSize: 30,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      'get_commander_card_associations',
      expect.objectContaining({
        p_commander_key: 'thrasios // tymna',
        p_source_oracle_id: oracleA,
        p_start_date: '2025-01-01',
        p_end_date: '2025-12-31',
        p_region_key: null,
        p_minimum_tournament_size: 32,
        p_maximum_standing: 16,
        p_minimum_sample_size: 30,
      }),
    );
  });

  it('maps database failures to a stable public error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('private') });
    await expect(cardAssociationRepository.getAssociations('kinnan', oracleA)).rejects.toThrow(
      'Unable to load observed card associations.',
    );
  });
});
