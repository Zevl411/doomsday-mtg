import { describe, expect, it } from 'vitest'
import {
  createAuthorizationHeaders,
  getFunctionErrorMessage,
  parseIngestionReport,
  parseTournamentDeckIngestionReport,
} from './ingestionRepository'

describe('getFunctionErrorMessage', () => {
  it('surfaces structured provider errors returned by the Edge Function', async () => {
    const error = {
      context: new Response(
        JSON.stringify({
          providerErrors: ['EDHTop16 request failed with 404.'],
        }),
        { status: 502 },
      ),
    }
    await expect(getFunctionErrorMessage(error)).resolves.toBe(
      'EDHTop16 request failed with 404.',
    )
  })

  it('uses a stable fallback for an unreadable platform error', async () => {
    await expect(getFunctionErrorMessage(new Error('private'))).resolves.toBe(
      'Tournament ingestion failed. Check the Edge Function logs.',
    )
  })

  it('surfaces card-level ingestion report errors', async () => {
    const error = {
      context: new Response(
        JSON.stringify({
          errors: ['Could not find the tournament_decks table.'],
        }),
        { status: 400 },
      ),
    }
    await expect(getFunctionErrorMessage(error)).resolves.toBe(
      'Could not find the tournament_decks table.',
    )
  })
})

describe('createAuthorizationHeaders', () => {
  it('formats the signed-in user token for the Edge Function gateway', () => {
    expect(createAuthorizationHeaders('user-access-token')).toEqual({
      Authorization: 'Bearer user-access-token',
    })
  })
})

describe('ingestion response validation', () => {
  it('accepts a complete tournament ingestion report', () => {
    const report = {
      tournamentsFetched: 1,
      tournamentsInserted: 1,
      tournamentsUpdated: 0,
      entriesFetched: 4,
      entriesInserted: 4,
      entriesUpdated: 0,
      entriesSkipped: 0,
      validationIssues: [],
      providerErrors: [],
      durationMs: 20,
      dryRun: false,
      requestsMade: 1,
      retries: 0,
      rateLimitedRequests: 0,
      exhaustedRequests: 0,
      tournamentsPartiallyIngested: 0,
      tournamentsExcluded: 0,
      tournamentsPurged: 0,
      excludedTournamentTitles: [],
    }

    expect(parseIngestionReport(report)).toEqual(report)
  })

  it('rejects incomplete tournament and card-level reports', () => {
    expect(() => parseIngestionReport({ dryRun: false })).toThrow(
      'tournament ingestion response was invalid',
    )
    expect(() =>
      parseTournamentDeckIngestionReport({
        entriesConsidered: 1,
        errors: [],
        hasMore: false,
      })
    ).toThrow('card-level ingestion response was invalid')
  })
})
