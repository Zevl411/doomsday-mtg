import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deckComparisonRepository,
  parseTournamentSimilarityRows,
} from './deckComparisonRepository';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));
beforeEach(() => {
  mocks.rpc.mockReset();
});

describe('deck comparison repository validation', () => {
  it('maps valid similarity rows with nullable metadata', () => {
    expect(
      parseTournamentSimilarityRows([
        {
          tournament_deck_id: 'deck-1',
          tournament_name: 'Open',
          pilot_name: null,
          standing: null,
          event_date: null,
          region_key: null,
          shared_card_count: 50,
          union_card_count: 100,
          similarity_rate: 0.5,
          source: 'topdeck',
          source_url: null,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        tournamentDeckId: 'deck-1',
        sharedCardCount: 50,
        similarityRate: 0.5,
        source: 'topdeck',
      }),
    ]);
  });

  it('accepts an empty sample', () => {
    expect(parseTournamentSimilarityRows([])).toEqual([]);
  });

  it('rejects invalid successful responses', () => {
    expect(() => parseTournamentSimilarityRows({})).toThrow(
      'tournament similarity response was invalid',
    );
    expect(() =>
      parseTournamentSimilarityRows([
        {
          tournament_deck_id: 'deck-1',
        },
      ]),
    ).toThrow('tournament similarity response was invalid');
  });

  it('passes only card keys and filters to the public similarity RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await expect(
      deckComparisonRepository.compare('kinnan', ['oracle:a', 'oracle:a'], { maximumStanding: 16 }),
    ).resolves.toEqual({ inclusion: [], similarities: [] });
    expect(mocks.rpc).toHaveBeenCalledWith(
      'get_similar_tournament_decks',
      expect.objectContaining({
        p_commander_key: 'kinnan',
        p_card_keys: ['oracle:a'],
        p_region_key: null,
        p_maximum_standing: 16,
        p_similarity_limit: 20,
      }),
    );
  });

  it('maps Supabase failures to a stable comparison error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({
      data: null,
      error: new Error('private database detail'),
    });
    await expect(deckComparisonRepository.compare('kinnan', [], {})).rejects.toThrow(
      'Unable to compare similar tournament Decks',
    );
  });

  it('rejects an invalid successful aggregate response', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ invalid: true }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    await expect(deckComparisonRepository.compare('kinnan', [], {})).rejects.toThrow(
      'deck comparison response was invalid',
    );
  });
});
