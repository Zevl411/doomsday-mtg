import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  commanderDeckEventRepository,
  parseCommanderDeckEvents,
} from './commanderDeckEventRepository';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

const oracleIds = Array.from(
  { length: 6 },
  (_, index) => `00000000-0000-4000-8000-00000000000${index + 1}`,
);
const validRow = {
  tournament_entry_id: '10000000-0000-4000-8000-000000000001',
  tournament_id: '20000000-0000-4000-8000-000000000001',
  tournament_deck_id: '30000000-0000-4000-8000-000000000001',
  tournament_name: 'Observed Event',
  event_date: '2026-07-19T12:00:00Z',
  player_name: 'Pilot',
  standing: 4,
  wins: 5,
  losses: 1,
  draws: 0,
};

beforeEach(() => mocks.rpc.mockReset());

describe('commander Deck event repository', () => {
  it('validates and maps card-filtered event rows', () => {
    expect(parseCommanderDeckEvents([validRow])).toEqual([
      {
        tournamentEntryId: validRow.tournament_entry_id,
        tournamentId: validRow.tournament_id,
        tournamentDeckId: validRow.tournament_deck_id,
        tournamentName: 'Observed Event',
        eventDate: validRow.event_date,
        playerName: 'Pilot',
        standing: 4,
        wins: 5,
        losses: 1,
        draws: 0,
      },
    ]);
  });

  it.each([
    null,
    [{}],
    [{ ...validRow, tournament_deck_id: 'invalid' }],
    [{ ...validRow, wins: -1 }],
    [{ ...validRow, event_date: 'not-a-date' }],
  ])('rejects malformed RPC responses', (value) => {
    expect(() => parseCommanderDeckEvents(value)).toThrow(
      'Commander card-filtered event response was invalid.',
    );
  });

  it('deduplicates identities and limits the request to five cards', async () => {
    mocks.rpc.mockResolvedValue({ data: [validRow], error: null });

    await commanderDeckEventRepository.getByCards(
      'thrasios // tymna',
      [oracleIds[0], ...oracleIds, oracleIds[0]],
      500,
    );

    expect(mocks.rpc).toHaveBeenCalledWith('get_commander_deck_events_by_cards', {
      p_commander_key: 'thrasios // tymna',
      p_oracle_ids: oracleIds.slice(0, 5),
      p_limit: 250,
    });
  });

  it('does not query without Oracle identities', async () => {
    await expect(
      commanderDeckEventRepository.getByCards('kinnan', ['legacy-name']),
    ).resolves.toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
