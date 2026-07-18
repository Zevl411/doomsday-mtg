import { describe, expect, it } from 'vitest'
import functionSource from '../../supabase/functions/ingest-tournaments/index.ts?raw'
import deckIngestionFunctionSource from '../../supabase/functions/ingest-tournament-decks/index.ts?raw'
import workerFunctionSource from '../../supabase/functions/process-tournament-ingestion/index.ts?raw'
import decklistFunctionSource from '../../supabase/functions/tournament-decklist/index.ts?raw'
import repositorySource from '../repositories/ingestionRepository.ts?raw'
import tournamentRepositorySource from '../repositories/tournamentRepository.ts?raw'

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

  it('does not retain redundant raw tournament payloads', () => {
    expect(functionSource).not.toContain(
      'source_payload: tournament.raw',
    )
    // Entry payloads remain available until their Deck is normalized.
    expect(functionSource).toContain('source_payload: entry.raw')
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
      'const ENTRY_BATCH_SIZE = 25',
    )
    expect(deckIngestionFunctionSource).toContain(
      "'get_tournament_deck_ingestion_candidates'",
    )
    expect(deckIngestionFunctionSource).toContain('.limit(ENTRY_BATCH_SIZE)')
    expect(deckIngestionFunctionSource).toContain(
      'report.hasMore = loadedEntryCount === ENTRY_BATCH_SIZE',
    )
  })

  it('bulk-classifies unavailable Decks before the bounded entry batch', () => {
    expect(deckIngestionFunctionSource).toContain(
      "'mark_unavailable_tournament_decks'",
    )
    expect(deckIngestionFunctionSource).toContain(
      'report.decksUnavailable += skipped',
    )
    expect(deckIngestionFunctionSource.indexOf(
      "'mark_unavailable_tournament_decks'",
    )).toBeLessThan(deckIngestionFunctionSource.indexOf(
      "'get_tournament_deck_ingestion_candidates'",
    ))
  })

  it('reuses persistent canonical aliases before calling Scryfall', () => {
    expect(deckIngestionFunctionSource).toContain(
      "from('canonical_card_aliases')",
    )
    expect(deckIngestionFunctionSource).toContain(
      'loadCanonicalCardCache',
    )
    expect(deckIngestionFunctionSource).toContain(
      "from('canonical_cards')",
    )
    expect(deckIngestionFunctionSource).toContain(
      'canonical_card_id: canonicalCardId',
    )
    expect(deckIngestionFunctionSource).toContain(
      "onConflict: 'tournament_deck_id,board,canonical_card_id'",
    )
  })

  it('accepts double-faced Scryfall cards without top-level colors', () => {
    expect(deckIngestionFunctionSource).toContain(
      'value.colors === undefined',
    )
    expect(deckIngestionFunctionSource).toContain(
      'card.card_faces?.flatMap((face) => face.colors ?? [])',
    )
    expect(deckIngestionFunctionSource).toContain(
      'colors: getResolvedColors(card)',
    )
  })

  it('releases redundant provider payloads after complete normalization', () => {
    expect(deckIngestionFunctionSource).toContain(
      ".update({ source_payload: null })",
    )
    expect(deckIngestionFunctionSource).toContain(
      "completeness.status === 'complete'",
    )
  })

  it('continues metadata batches through bounded Deck normalization', () => {
    expect(workerFunctionSource).toContain("stage: 'decks'")
    expect(workerFunctionSource).toContain(
      '/functions/v1/ingest-tournament-decks',
    )
    expect(workerFunctionSource).toContain('onlyMissing: true')
    expect(workerFunctionSource).toContain(
      "status: hasMore ? 'pending' : 'completed'",
    )
  })

  it('lets direct metadata ingestion enqueue only the Deck stage', () => {
    expect(functionSource).toContain("'create-deck-job'")
    expect(functionSource).toMatch(
      /function isJobAction[\s\S]*'create-deck-job'/,
    )
    expect(functionSource).toContain(".update({ stage: 'decks' })")
    expect(repositorySource).toContain('createDeckNormalizationJob')
  })
})

describe('tournament decklist function boundaries', () => {
  it('keeps normalized double-faced cards without requiring a printing ID', () => {
    expect(tournamentRepositorySource).not.toContain(
      "card.board === 'mainboard' && card.scryfallId",
    )
    expect(tournamentRepositorySource).not.toContain(
      "card.board === 'commander' && card.scryfallId",
    )
  })

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

  it('refetches a targeted TopDeck event when its stored payload was released', () => {
    expect(decklistFunctionSource).toContain('loadTopDeckDecklist')
    expect(decklistFunctionSource).toContain(
      'tournamentIds: [tournamentId]',
    )
    expect(decklistFunctionSource).toContain(
      "Deno.env.get('TOPDECK_API_KEY')",
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
