import { describe, expect, it } from 'vitest'
import functionSource from '../../supabase/functions/ingest-tournaments/index.ts?raw'
import deckIngestionFunctionSource from '../../supabase/functions/ingest-tournament-decks/index.ts?raw'
import workerFunctionSource from '../../supabase/functions/process-tournament-ingestion/index.ts?raw'
import decklistFunctionSource from '../../supabase/functions/tournament-decklist/index.ts?raw'
import repositorySource from '../repositories/ingestionRepository.ts?raw'

describe('tournament ingestion function boundaries', () => {
  it('requires authenticated admin membership before provider work', () => {
    expect(functionSource).toContain("request.headers.get('Authorization')")
    expect(functionSource).toContain(".from('admin_users')")
    expect(functionSource).toContain('Administrator access required.')
  })

  it('uses stable upsert identities and supports dry runs', () => {
    expect(functionSource).toContain("onConflict: 'source,source_tournament_id'")
    expect(functionSource).toContain(
      "onConflict: 'tournament_id,source_entry_key'",
    )
    expect(functionSource).toContain('if (options.dryRun) return')
  })

  it('bounds concurrent tournament processing', () => {
    expect(functionSource).toContain(
      'mapWithConcurrency(tournaments, 3',
    )
  })

  it('allows the headers sent by the Supabase browser client', () => {
    expect(functionSource).toContain(
      'authorization, x-client-info, apikey, content-type',
    )
  })

  it('guards the development reset with an exact confirmation token', () => {
    expect(functionSource).toContain("'clear-tournament-data'")
    expect(functionSource).toContain(
      "request.confirmationToken !== 'CLEAR TOURNAMENT DATA'",
    )
    expect(functionSource).toContain("'clear_tournament_ingestion_data'")
  })

  it('preserves useful PostgREST error messages', () => {
    expect(functionSource).toContain(
      "typeof error.message === 'string'",
    )
    expect(functionSource).toContain(
      "typeof error.code === 'string'",
    )
  })
})

describe('browser ingestion orchestration', () => {
  it('splits direct date discovery into bounded provider windows', () => {
    expect(repositorySource).toContain(
      'createDateWindows(options.startDate, options.endDate, 3)',
    )
    expect(repositorySource).toContain(
      'Tournament metadata ingestion failed:',
    )
  })
})

describe('normalized tournament deck ingestion boundaries', () => {
  it('persists resolved Commander color identity on tournament entries', () => {
    expect(deckIngestionFunctionSource).toContain(
      "item.candidate.board === 'commander'",
    )
    expect(deckIngestionFunctionSource).toContain(
      ".update({ color_identity: commanderColorIdentity })",
    )
  })

  it('filters missing normalized Decks before applying the batch limit', () => {
    expect(deckIngestionFunctionSource).toContain(
      'const ENTRY_BATCH_SIZE = 10',
    )
    expect(deckIngestionFunctionSource).toContain(
      "'get_tournament_deck_ingestion_candidates'",
    )
    expect(deckIngestionFunctionSource).toContain('.limit(ENTRY_BATCH_SIZE)')
    expect(deckIngestionFunctionSource).toContain(
      'report.hasMore = report.entriesConsidered === ENTRY_BATCH_SIZE',
    )
  })

  it('completes metadata batches without automatic Deck normalization', () => {
    expect(workerFunctionSource).toContain("status: 'completed'")
    expect(workerFunctionSource).not.toContain(
      '/functions/v1/ingest-tournament-decks',
    )
  })
})

describe('tournament decklist function boundaries', () => {
  it('loads one provider entry on demand and returns preview image data', () => {
    expect(decklistFunctionSource).toContain(
      'query DoomsdayTournamentEntryDeck',
    )
    expect(decklistFunctionSource).toContain('cardPreviewImageUrl')
    expect(decklistFunctionSource).toContain('variables: { id: entryId }')
  })

  it('parses stored TopDeck Decks on demand without normalized Deck rows', () => {
    expect(decklistFunctionSource).toContain(
      "tournament?.source === 'topdeck'",
    )
    expect(decklistFunctionSource).toContain('normalizeStructuredDeck')
    expect(decklistFunctionSource).toContain('normalizePlaintextDeck')
    expect(decklistFunctionSource).toContain(
      ".eq('id', tournamentEntryId)",
    )
  })

  it('validates entry IDs and exposes browser CORS headers', () => {
    expect(decklistFunctionSource).toContain(
      '.test(tournamentEntryId)',
    )
    expect(decklistFunctionSource).toContain(
      'authorization, x-client-info, apikey, content-type',
    )
  })
})
