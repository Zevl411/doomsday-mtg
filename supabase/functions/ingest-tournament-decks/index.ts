import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  normalizeCardKey,
  normalizePlaintextDeck,
  normalizeStructuredDeck,
  evaluateDeckCompleteness,
  type CardCandidate,
  type CandidateIssue,
} from '../_shared/tournamentDeckNormalizer.ts'

interface DeckIngestionRequest {
  tournamentIds?: string[]
  entryIds?: string[]
  provider?: 'topdeck' | 'edhtop16'
  startDate?: string
  endDate?: string
  commanderKey?: string
  onlyMissing?: boolean
  retryPartial?: boolean
  dryRun?: boolean
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
const SCRYFALL_COLLECTION_URL = 'https://api.scryfall.com/cards/collection'
const SCRYFALL_NAMED_URL = 'https://api.scryfall.com/cards/named'
const BATCH_SIZE = 75
const SCRYFALL_USER_AGENT = `${Deno.env.get('APP_NAME') ?? 'DoomsdayMTG'}/0.2`
// TopDeck structured lists are much larger than entry summaries. Keep each
// invocation bounded so the Edge runtime does not materialize 500 deckObjs.
const ENTRY_BATCH_SIZE = 100

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const startedAt = Date.now()
  const report = createReport()
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authentication required.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) throw new Error('Supabase configuration is incomplete.')

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userData } = await userClient.auth.getUser()
    if (!userData.user) return json({ error: 'Authentication required.' }, 401)
    const { data: membership } = await userClient.from('admin_users')
      .select('user_id').eq('user_id', userData.user.id).maybeSingle()
    if (!membership) return json({ error: 'Administrator access required.' }, 403)

    const options = validateRequest(await request.json())
    const admin = createClient(url, serviceKey)
    // Resolve the tournament scope first. Filtering an embedded PostgREST
    // relation produced inconsistent parent-row results between providers.
    let tournamentQuery = admin.from('tournaments')
      .select('id, source, source_tournament_id, event_date')
      .order('event_date', { ascending: true })
      // Keeps the following UUID `in` filter below common proxy URL limits.
      .limit(200)
    if (options.provider) tournamentQuery = tournamentQuery.eq('source', options.provider)
    if (options.startDate) tournamentQuery = tournamentQuery.gte('event_date', options.startDate)
    if (options.endDate) {
      tournamentQuery = tournamentQuery.lt(
        'event_date',
        addUtcDays(options.endDate, 1),
      )
    }
    if (options.tournamentIds?.length) {
      tournamentQuery = tournamentQuery.in(
        'source_tournament_id',
        options.tournamentIds,
      )
    }
    const { data: tournaments, error: tournamentsError } = await tournamentQuery
    if (tournamentsError) {
      throw databaseError('load matching tournaments', tournamentsError)
    }
    const tournamentById = new Map(
      (tournaments ?? []).map((tournament) => [tournament.id, tournament]),
    )
    const tournamentDatabaseIds = [...tournamentById.keys()]
    if (!tournamentDatabaseIds.length) {
      report.durationMs = Date.now() - startedAt
      return json(report)
    }

    let query = admin.from('tournament_entries')
      .select(
        'id, tournament_id, source_entry_id, commander_key, commander_name, source_payload',
      )
      .in('tournament_id', tournamentDatabaseIds)
      .order('created_at', { ascending: true })
      .limit(ENTRY_BATCH_SIZE)
    if (options.entryIds?.length) query = query.in('id', options.entryIds)
    if (options.commanderKey) query = query.eq('commander_key', options.commanderKey)
    const { data: entries, error: entriesError } = await query
    if (entriesError) throw databaseError('load tournament entries', entriesError)
    report.entriesConsidered = entries?.length ?? 0

    const entryIds = (entries ?? []).map((entry) => entry.id)
    const { data: existing, error: existingError } = entryIds.length
      ? await admin.from('tournament_decks')
        .select('id, tournament_entry_id, parsing_status')
        .in('tournament_entry_id', entryIds)
      : { data: [], error: null }
    if (existingError) {
      throw databaseError('load existing tournament Decks', existingError)
    }
    const existingByEntry = new Map(
      (existing ?? []).map((deck) => [deck.tournament_entry_id, deck]),
    )
    const resolutionCache = new Map<string, ResolvedCard | null>()

    for (const entry of entries ?? []) {
      const tournament = tournamentById.get(entry.tournament_id)
      if (!tournament) continue
      const oldDeck = existingByEntry.get(entry.id)
      // "Retry partial" intentionally overrides "only missing" for incomplete
      // rows, while complete snapshots remain untouched.
      if (
        !options.dryRun &&
        options.onlyMissing &&
        oldDeck &&
        !(options.retryPartial && oldDeck.parsing_status === 'partial')
      ) {
        report.decksUnchanged += 1
        continue
      }
      if (
        !options.dryRun &&
        !options.retryPartial &&
        oldDeck?.parsing_status === 'partial'
      ) {
        report.decksUnchanged += 1
        continue
      }
      const raw = isRecord(entry.source_payload) ? entry.source_payload : {}
      const deckObject = raw.deckObj ?? raw.deckObject
      const decklist = raw.decklist
      const hasStructured = isRecord(deckObject)
      const hasPlaintext = typeof decklist === 'string' &&
        decklist.trim() !== '' && !/^https?:\/\//i.test(decklist)
      const isUrl = typeof decklist === 'string' && /^https?:\/\//i.test(decklist)
      if (hasStructured || hasPlaintext || isUrl) report.decklistsAvailable += 1

      let candidates: CardCandidate[] = []
      let issues: CandidateIssue[] = []
      if (hasStructured) {
        const normalized = normalizeStructuredDeck(deckObject)
        candidates = normalized.cards
        issues = normalized.issues
        report.structuredDecksUsed += 1
      } else if (hasPlaintext) {
        const normalized = normalizePlaintextDeck(decklist)
        candidates = normalized.cards
        issues = normalized.issues
        report.plaintextDecksUsed += 1
      } else {
        issues.push({
          code: isUrl ? 'unavailable_external_decklist' : 'unavailable_decklist',
          message: isUrl
            ? 'The external decklist host is not supported for server-side normalization.'
            : 'No decklist is available for this entry.',
        })
      }

      const resolved = candidates.length
        ? await resolveCandidates(candidates, resolutionCache)
        : []
      const unresolved = resolved.filter((item) => !item.card)
      report.cardsResolved += resolved.length - unresolved.length
      report.cardsUnresolved += unresolved.length
      for (const item of unresolved) {
        issues.push({
          code: 'unknown_card',
          message: `Scryfall could not resolve ${item.candidate.name}.`,
        })
      }
      const completeness = evaluateDeckCompleteness(
        candidates,
        unresolved.length,
        issues,
      )
      if (completeness.status === 'complete') report.decksCompleted += 1
      else if (completeness.status === 'unavailable') report.decksUnavailable += 1
      else report.decksPartial += 1
      if (options.dryRun) continue

      const deckRow = {
        tournament_entry_id: entry.id,
        source: tournament.source,
        source_deck_id: typeof raw.id === 'string' ? raw.id : entry.source_entry_id,
        commander_key: entry.commander_key,
        commander_name: entry.commander_name,
        mainboard_card_count: sumBoard(candidates, 'mainboard'),
        sideboard_card_count: sumBoard(candidates, 'sideboard'),
        parsing_status: completeness.status,
        parsing_issues: [...issues, ...completeness.issues],
        raw_decklist_available: hasPlaintext,
        structured_deck_available: hasStructured,
        imported_at: new Date().toISOString(),
      }
      const { data: storedDeck, error: deckError } = await admin
        .from('tournament_decks')
        .upsert(deckRow, { onConflict: 'tournament_entry_id' })
        .select('id').single()
      if (deckError) throw databaseError('save tournament Deck', deckError)
      if (oldDeck) report.decksUpdated += 1
      else report.decksInserted += 1

      // Replacing the normalized snapshot reconciles cards removed upstream.
      const { error: deleteError } = await admin.from('tournament_deck_cards')
        .delete().eq('tournament_deck_id', storedDeck.id)
      if (deleteError) {
        throw databaseError('replace tournament Deck cards', deleteError)
      }
      const cardRows = resolved.flatMap(({ candidate, card }) => card ? [{
        tournament_deck_id: storedDeck.id,
        board: candidate.board,
        oracle_id: card.oracle_id,
        scryfall_id: card.id,
        normalized_card_key: card.oracle_id ?? normalizeCardKey(card.name),
        card_name: card.name,
        quantity: candidate.quantity,
        type_line: card.type_line,
        color_identity: card.color_identity,
        colors: card.colors,
        mana_value: card.cmc,
        is_basic_land: card.type_line.includes('Basic Land'),
      }] : [])
      if (cardRows.length) {
        const { error: cardsError } = await admin.from('tournament_deck_cards')
          .upsert(cardRows, {
            onConflict: 'tournament_deck_id,board,normalized_card_key',
          })
        if (cardsError) {
          throw databaseError('save tournament Deck cards', cardsError)
        }
      }
    }
  } catch (error) {
    const message = publicErrorMessage(error)
    report.errors.push(message)
    // Log only the normalized error text. Provider payloads, credentials, and
    // participant data must never be written to Edge Function logs.
    console.error('Tournament Deck ingestion failed:', message)
  }
  report.durationMs = Date.now() - startedAt
  return json(report, report.errors.length ? 400 : 200)
})

interface ResolvedCard {
  id: string
  oracle_id?: string
  name: string
  flavor_name?: string
  type_line: string
  color_identity: string[]
  colors: string[]
  cmc: number
  card_faces?: Array<{ name?: string }>
}

async function resolveCandidates(
  candidates: CardCandidate[],
  cache: Map<string, ResolvedCard | null>,
) {
  const missing = [...new Set(candidates.map((card) => card.name))]
    .filter((name) => !cache.has(normalizeCardKey(name)))
  for (let index = 0; index < missing.length; index += BATCH_SIZE) {
    const names = missing.slice(index, index + BATCH_SIZE)
    const response = await fetchWithRetry(SCRYFALL_COLLECTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': SCRYFALL_USER_AGENT,
      },
      body: JSON.stringify({
        identifiers: names.map((name) => ({
          name: name.split('//')[0]?.trim() ?? name,
        })),
      }),
    })
    if (!response) throw new Error('Scryfall collection lookup returned no response.')
    const body: unknown = await response.json()
    const cards = isRecord(body) && Array.isArray(body.data)
      ? body.data.filter(isRecord) as unknown as ResolvedCard[]
      : []
    for (const name of names) {
      const key = normalizeCardKey(name)
      const card = cards.find((candidate) => getLookupNames(candidate).has(key))
      cache.set(key, card ?? null)
    }

    // Collection lookup is efficient but does not reliably recognize showcase
    // flavor names. Retry only misses through Scryfall's exact-name endpoint.
    for (const name of names.filter((item) =>
      cache.get(normalizeCardKey(item)) === null
    )) {
      // Sequential 110 ms spacing stays below Scryfall's ten-request-per-second
      // guidance when a batch contains several unusual flavor names.
      await new Promise((resolve) => setTimeout(resolve, 110))
      const response = await fetchWithRetry(
        `${SCRYFALL_NAMED_URL}?exact=${encodeURIComponent(name.trim())}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': SCRYFALL_USER_AGENT,
          },
        },
        true,
      )
      if (!response) continue
      const card: unknown = await response.json()
      cache.set(
        normalizeCardKey(name),
        isResolvedCard(card) ? card : null,
      )
    }
  }
  return candidates.map((candidate) => ({
    candidate,
    card: cache.get(normalizeCardKey(candidate.name)) ?? null,
  }))
}

function getLookupNames(card: ResolvedCard) {
  return new Set([
    card.name,
    card.flavor_name,
    card.name.split('//')[0],
    ...(card.card_faces?.map((face) => face.name) ?? []),
  ].filter((name): name is string => Boolean(name)).map(normalizeCardKey))
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  allowNotFound = false,
): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, init)
    if (response.ok) return response
    if (allowNotFound && response.status === 404) return null
    if ((response.status < 500 && response.status !== 429) || attempt === 2) {
      throw new Error(`Scryfall collection lookup failed (${response.status}).`)
    }
    const retryAfter = Number(response.headers.get('Retry-After'))
    await new Promise((resolve) => setTimeout(
      resolve,
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * 2 ** attempt,
    ))
  }
  throw new Error('Scryfall collection lookup failed.')
}

function isResolvedCard(value: unknown): value is ResolvedCard {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.type_line === 'string' &&
    Array.isArray(value.color_identity) &&
    Array.isArray(value.colors) &&
    typeof value.cmc === 'number'
}

function sumBoard(candidates: CardCandidate[], board: CardCandidate['board']) {
  return candidates.filter((card) => card.board === board)
    .reduce((total, card) => total + card.quantity, 0)
}

function validateRequest(value: unknown): DeckIngestionRequest {
  if (!isRecord(value)) throw new Error('A deck ingestion request is required.')
  return {
    tournamentIds: stringArray(value.tournamentIds),
    entryIds: stringArray(value.entryIds),
    provider: value.provider === 'topdeck' || value.provider === 'edhtop16'
      ? value.provider : undefined,
    startDate: stringValue(value.startDate),
    endDate: stringValue(value.endDate),
    commanderKey: stringValue(value.commanderKey),
    onlyMissing: value.onlyMissing !== false,
    retryPartial: value.retryPartial === true,
    dryRun: value.dryRun === true,
  }
}

function createReport() {
  return {
    entriesConsidered: 0, decklistsAvailable: 0,
    structuredDecksUsed: 0, plaintextDecksUsed: 0,
    externalUrlsFetched: 0, decksCompleted: 0, decksPartial: 0,
    decksUnavailable: 0, cardsResolved: 0, cardsUnresolved: 0,
    decksInserted: 0, decksUpdated: 0, decksUnchanged: 0,
    errors: [] as string[], durationMs: 0,
  }
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : undefined
}
function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
function addUtcDays(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error('The date range is invalid.')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function databaseError(operation: string, value: unknown) {
  return new Error(`Could not ${operation}: ${publicErrorMessage(value)}`)
}

function publicErrorMessage(value: unknown) {
  if (value instanceof Error) return value.message
  if (isRecord(value)) {
    const message = typeof value.message === 'string' ? value.message : ''
    const code = typeof value.code === 'string' ? ` (${value.code})` : ''
    const hint = typeof value.hint === 'string' && value.hint
      ? ` Hint: ${value.hint}` : ''
    if (message) return `${message}${code}${hint}`
  }
  return 'Unknown deck ingestion error.'
}
