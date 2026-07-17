import { describe, expect, it, vi } from 'vitest'
import {
  EdhTop16Provider,
  extractEmbeddedArrays,
  mapEntry,
  mapTournament,
} from '../../supabase/functions/ingest-tournaments/edhtop16'

describe('EDHTop16 adapter mapping', () => {
  it('maps valid provider tournaments without leaking field names downstream', () => {
    expect(
      mapTournament({
        tournamentId: 'event-1',
        tournamentName: 'Championship',
        eventDate: '2026-07-01',
        players: 64,
      }),
    ).toMatchObject({
      sourceTournamentId: 'event-1',
      name: 'Championship',
      playerCount: 64,
    })
  })

  it('maps entries and preserves optional decklist URLs', () => {
    expect(
      mapEntry({
        entryId: 'entry-1',
        pilot: 'Player',
        commander: 'Tymna / Kraum',
        wins: 4,
        losses: 1,
        deckUrl: 'https://example.com/deck',
      }),
    ).toMatchObject({
      sourceEntryId: 'entry-1',
      playerName: 'Player',
      commanderName: 'Tymna / Kraum',
      wins: 4,
      losses: 1,
      decklistUrl: 'https://example.com/deck',
    })
  })

  it('skips malformed rows with no stable identity or Commander', () => {
    expect(mapTournament({ name: 'Missing ID' })).toBeNull()
    expect(mapEntry({ playerName: 'Missing Commander' })).toBeNull()
  })

  it('retries a rate-limited request with a bounded delay', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 429,
          headers: { 'retry-after': '0' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          '<script>{"edges":[{"node":{"TID":"event-1","name":"Event","size":32,"tournamentDate":"2026-07-01"}}]}</script>',
          { status: 200 },
        ),
      )
    const provider = new EdhTop16Provider(
      'https://provider.example',
      request,
    )

    await expect(
      provider.listTournaments({ minimumPlayers: 0 }),
    ).resolves.toHaveLength(1)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('extracts complete Relay arrays without depending on visual markup', () => {
    const html =
      '<script>{"entries":[{"id":"entry","standing":1,"player":{"name":"A [Player]"},"commander":{"name":"Kinnan"}}]}</script>'
    expect(extractEmbeddedArrays(html, 'entries')).toEqual([[
      {
        id: 'entry',
        standing: 1,
        player: { name: 'A [Player]' },
        commander: { name: 'Kinnan' },
      },
    ]])
  })
})
