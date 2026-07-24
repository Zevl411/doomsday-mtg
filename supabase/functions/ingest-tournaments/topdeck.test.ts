import { describe, expect, it, vi } from 'vitest';

import { TopDeckProvider } from './topdeck.ts';

const fixture = [
  {
    TID: 'T-100',
    name: 'Regional Championship',
    startDate: 1_767_225_600,
    participantCount: 64,
    eventData: {
      city: 'Tampa',
      state: 'FL',
      country: 'US',
      lat: 27.95,
      lng: -82.46,
    },
    standings: [
      {
        id: 'player-1',
        name: 'Ada',
        wins: 5,
        losses: 1,
        draws: 0,
        decklist: 'Commander\n1 Tymna the Weaver\n1 Kraum, Ludevic’s Opus\n\nDeck\n1 Island',
        deckObj: {
          Commanders: {
            'Tymna the Weaver': 1,
            'Kraum, Ludevic’s Opus': 1,
          },
        },
      },
    ],
  },
];

describe('TopDeckProvider', () => {
  it('constructs an authenticated EDH bulk request and maps location/decks', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response(fixture));
    const provider = new TopDeckProvider({
      apiKey: 'fixture-key',
      fetcher,
    });
    const tournaments = await provider.listTournaments({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      minimumPlayers: 16,
      includeRounds: false,
    });
    const entries = await provider.listEntries(tournaments[0]!);

    const [, init] = fetcher.mock.calls[0]!;
    expect(init.headers.Authorization).toBe('fixture-key');
    expect(JSON.parse(init.body)).toMatchObject({
      game: 'Magic: The Gathering',
      format: 'EDH',
      participantMin: 16,
      rounds: false,
      columns: ['name', 'id', 'decklist', 'wins', 'draws', 'losses', 'winRate'],
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(tournaments[0]).toMatchObject({
      sourceTournamentId: 'T-100',
      playerCount: 64,
      location: {
        countryCode: 'US',
        regionKey: 'country:US/state:FL',
      },
    });
    expect(entries[0]).toMatchObject({
      commanderName: 'Tymna the Weaver // Kraum, Ludevic’s Opus',
      commanderExtractionStatus: 'extracted',
      decklistAvailability: 'structured',
    });
  });

  it('omits TID when the admin field supplies an empty array', async () => {
    const fetcher = vi.fn().mockResolvedValue(response([]));
    const provider = new TopDeckProvider({
      apiKey: 'fixture-key',
      fetcher,
    });
    await provider.listTournaments({
      minimumPlayers: 0,
      tournamentIds: [],
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    const body = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(body).not.toHaveProperty('TID');
    expect(body).toMatchObject({
      start: 1767225600,
      end: 1769903999,
    });
  });

  it('retries 429 responses using Retry-After and reports metrics', async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({}, 429, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(response([]));
    const provider = new TopDeckProvider({
      apiKey: 'fixture-key',
      fetcher,
      wait,
    });
    await provider.listTournaments({ minimumPlayers: 0 });
    expect(wait).toHaveBeenCalledWith(1000);
    expect(provider.getMetrics()).toMatchObject({
      requestsMade: 2,
      retries: 1,
      rateLimitedRequests: 1,
    });
  });

  it('returns the provider validation message for rejected requests', async () => {
    const provider = new TopDeckProvider({
      apiKey: 'fixture-key',
      fetcher: vi
        .fn()
        .mockResolvedValue(response({ error: 'Both game and format are required.' }, 400)),
    });
    await expect(provider.listTournaments({ minimumPlayers: 0 })).rejects.toThrow(
      'TopDeck request failed (400): Both game and format are required.',
    );
  });

  it('keeps standings when a decklist cannot identify a commander', async () => {
    const provider = new TopDeckProvider({
      apiKey: 'fixture-key',
      fetcher: vi.fn().mockImplementation(async () =>
        response([
          {
            TID: 'T-2',
            standings: [{ id: 'entry', name: 'Player' }],
          },
        ]),
      ),
    });
    const tournaments = await provider.listTournaments({ minimumPlayers: 0 });
    expect(await provider.listEntries(tournaments[0]!)).toMatchObject([
      {
        commanderName: 'Unknown commander',
        commanderExtractionStatus: 'missing',
        decklistAvailability: 'missing',
      },
    ]);
  });

  it('extracts Commanders from decorative plaintext headings', async () => {
    const provider = new TopDeckProvider({
      apiKey: 'fixture-key',
      fetcher: vi.fn().mockImplementation(async () =>
        response([
          {
            TID: 'T-3',
            standings: [
              {
                name: 'Player',
                decklist: '~~Commanders~~\n1 Rograkh, Son of Rohgahh\n\n**Mainboard**\n1 Mountain',
              },
            ],
          },
        ]),
      ),
    });
    const tournaments = await provider.listTournaments({ minimumPlayers: 0 });
    expect((await provider.listEntries(tournaments[0]!))[0]).toMatchObject({
      commanderName: 'Rograkh, Son of Rohgahh',
      commanderExtractionStatus: 'extracted',
      decklistAvailability: 'plaintext',
    });
  });
});

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}
