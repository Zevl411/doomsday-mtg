import { describe, expect, it } from 'vitest'
import functionSource from '../../supabase/functions/ingest-tournaments/index.ts?raw'
import decklistFunctionSource from '../../supabase/functions/tournament-decklist/index.ts?raw'

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
})

describe('tournament decklist function boundaries', () => {
  it('loads one provider entry on demand and returns preview image data', () => {
    expect(decklistFunctionSource).toContain(
      'query DoomsdayTournamentEntryDeck',
    )
    expect(decklistFunctionSource).toContain('cardPreviewImageUrl')
    expect(decklistFunctionSource).toContain('variables: { id: entryId }')
  })

  it('validates entry IDs and exposes browser CORS headers', () => {
    expect(decklistFunctionSource).toContain('entryId.length > 200')
    expect(decklistFunctionSource).toContain(
      'authorization, x-client-info, apikey, content-type',
    )
  })
})
