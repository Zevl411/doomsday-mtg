import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdhTop16Provider } from './edhtop16.ts'
import { TopDeckProvider } from './topdeck.ts'
import {
  buildExcludedTitleKeywords,
  EXCLUDED_TITLE_KEYWORD_CONFIG_KEYS,
  evaluateTournamentTitle,
} from './tournamentRelevance.ts'
import type {
  ProviderTournament,
  ProviderTournamentEntry,
  TournamentProvider,
} from './types.ts'

// Supplying `any` here preserves the ungenerated Supabase schema behavior.
// Plain `ReturnType<typeof createClient>` loses the generic and Deno infers
// every table row as `never`, even though the runtime client is valid.
type AdminClient = ReturnType<typeof createClient<any>>

interface IngestionRequest {
  provider: 'edhtop16' | 'topdeck'
  startDate?: string
  endDate?: string
  minimumPlayers?: number
  maximumPlayers?: number
  tournamentIds?: string[]
  last?: number
  includeRounds?: boolean
  enrichLocation?: boolean
  excludeCasualEvents?: boolean
  dryRun?: boolean
}

interface JobActionRequest {
  action:
    | 'create-job' | 'create-deck-job'
    | 'pause-job' | 'resume-job' | 'cancel-job' | 'retry-job'
    | 'purge-casual-events' | 'clear-tournament-data'
  jobId?: string
  provider?: 'edhtop16' | 'topdeck'
  startDate?: string
  endDate?: string
  windowDays?: number
  minimumPlayers?: number
  includeRounds?: boolean
  enrichLocation?: boolean
  excludeCasualEvents?: boolean
  dryRun?: boolean
  confirmationToken?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // supabase-js adds x-client-info to function calls, so browser preflight
  // must explicitly allow it alongside authentication and JSON headers.
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const startedAt = Date.now()
  const report = createReport()

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authentication required.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) {
      throw new Error('Edge Function Supabase configuration is incomplete.')
    }

    const admin = createClient(url, serviceKey)
    const workerSecret = Deno.env.get('INGESTION_WORKER_SECRET')
    const isWorker = Boolean(
      workerSecret &&
      request.headers.get('x-ingestion-worker-secret') === workerSecret,
    )
    let userId: string | null = null
    if (!isWorker) {
      const userClient = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
      })
      const { data: userData } = await userClient.auth.getUser()
      if (!userData.user) return json({ error: 'Authentication required.' }, 401)
      userId = userData.user.id
      const { data: membership } = await userClient
        .from('admin_users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()
      if (!membership) return json({ error: 'Administrator access required.' }, 403)
    }

    const requestBody: unknown = await request.json()
    if (isJobAction(requestBody)) {
      if (!userId) return json({ error: 'A user must manage ingestion jobs.' }, 403)
      return json(await handleJobAction(admin, requestBody, userId))
    }
    const options = validateRequest(requestBody)
    const provider = getProvider(options.provider)
    const fetchedTournaments = await provider.listTournaments(options)
    report.tournamentsFetched = fetchedTournaments.length
    const excludedKeywords = getExcludedTitleKeywords()
    const excludedTournaments = options.excludeCasualEvents
      ? fetchedTournaments.filter((tournament) =>
        !evaluateTournamentTitle(tournament.name, excludedKeywords).included
      )
      : []
    const excludedIds = new Set(
      excludedTournaments.map((tournament) => tournament.sourceTournamentId),
    )
    const tournaments = fetchedTournaments.filter((tournament) =>
      !excludedIds.has(tournament.sourceTournamentId)
    )
    report.tournamentsExcluded = excludedTournaments.length
    report.excludedTournamentTitles = excludedTournaments
      .slice(0, 25)
      .map((tournament) => tournament.name)

    // A real run removes a previously stored copy of an explicitly excluded
    // event. Cascading foreign keys remove its entries and normalized Decks.
    if (!options.dryRun && excludedTournaments.length) {
      for (const tournament of excludedTournaments) {
        const { data: purged, error } = await admin.from('tournaments')
          .delete()
          .eq('source', provider.source)
          .eq('source_tournament_id', tournament.sourceTournamentId)
          .select('id')
        if (error) throw error
        report.tournamentsPurged += purged?.length ?? 0
      }
    }
    if (!fetchedTournaments.length) {
      report.validationIssues.push(
        createEmptyResultMessage(options),
      )
    }
    // A small worker pool prevents provider and database request bursts.
    await mapWithConcurrency(tournaments, 3, async (tournament) => {
      try {
        const entries = await provider.listEntries(tournament)
        report.entriesFetched += entries.length
        if (options.dryRun) return

        const { data: existingTournament } = await admin
          .from('tournaments')
          .select('id')
          .eq('source', provider.source)
          .eq('source_tournament_id', tournament.sourceTournamentId)
          .maybeSingle()
        const { data: storedTournament, error: tournamentError } = await admin
          .from('tournaments')
          .upsert(mapTournament(tournament, provider), {
            onConflict: 'source,source_tournament_id',
          })
          .select('id')
          .single()
        if (tournamentError) throw tournamentError
        if (existingTournament) report.tournamentsUpdated += 1
        else report.tournamentsInserted += 1

        // Provider-specific rows remain separate in this milestone. The link
        // records preserve explicit identities for safe future canonicalization;
        // similar names are never automatically merged.
        const { data: explicitMatch } = await admin
          .from('tournaments')
          .select('id')
          .eq('source_tournament_id', tournament.sourceTournamentId)
          .neq('source', provider.source)
          .limit(1)
          .maybeSingle()
        const { error: linkError } = await admin
          .from('tournament_source_links')
          .upsert({
            // An identical upstream ID is strong evidence. Names alone never
            // select a canonical link.
            tournament_id: explicitMatch?.id ?? storedTournament.id,
            source: provider.source,
            source_tournament_id: tournament.sourceTournamentId,
            source_url: tournament.url,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'source,source_tournament_id' })
        if (linkError) throw linkError

        const normalizedEntries = await Promise.all(
          entries.map((entry) => mapEntry(entry, storedTournament.id)),
        )
        if (normalizedEntries.length) {
          const entryKeys = normalizedEntries.map(
            (entry) => entry.source_entry_key,
          )
          const { data: existingEntries } = await admin
            .from('tournament_entries')
            .select('source_entry_key')
            .eq('tournament_id', storedTournament.id)
            .in('source_entry_key', entryKeys)
          const existingKeys = new Set(
            existingEntries?.map((entry) => entry.source_entry_key) ?? [],
          )
          const { error: entriesError } = await admin
            .from('tournament_entries')
            .upsert(normalizedEntries, {
              onConflict: 'tournament_id,source_entry_key',
            })
          if (entriesError) throw entriesError
          report.entriesUpdated += normalizedEntries.filter((entry) =>
            existingKeys.has(entry.source_entry_key)
          ).length
          report.entriesInserted += normalizedEntries.filter(
            (entry) => !existingKeys.has(entry.source_entry_key),
          ).length
        }
      } catch (error) {
        report.tournamentsPartiallyIngested += 1
        report.providerErrors.push(readError(error))
      }
    })

    const metrics = provider.getMetrics?.()
    if (metrics) Object.assign(report, metrics)
    report.durationMs = Date.now() - startedAt
    report.dryRun = options.dryRun
    return json(report)
  } catch (error) {
    report.providerErrors.push(readError(error))
    report.durationMs = Date.now() - startedAt
    return json(report, 400)
  }
})

function getProvider(source: 'edhtop16' | 'topdeck'): TournamentProvider {
  if (source === 'topdeck') {
    return new TopDeckProvider({
      apiKey: Deno.env.get('TOPDECK_API_KEY') ?? '',
      baseUrl: Deno.env.get('TOPDECK_API_BASE_URL'),
    })
  }
  if (source === 'edhtop16') {
    return new EdhTop16Provider(
      Deno.env.get('EDHTOP16_BASE_URL') ?? 'https://edhtop16.com',
    )
  }
  throw new Error('Unsupported tournament provider.')
}

function validateRequest(value: unknown): Required<
  Pick<IngestionRequest, 'provider' | 'minimumPlayers' | 'dryRun'>
> &
  Omit<IngestionRequest, 'provider' | 'minimumPlayers' | 'dryRun'> {
  if (
    !isRecord(value) ||
    (value.provider !== 'edhtop16' && value.provider !== 'topdeck')
  ) {
    throw new Error('Provider must be topdeck or edhtop16.')
  }
  const minimumPlayers = Number(value.minimumPlayers ?? 0)
  if (!Number.isInteger(minimumPlayers) || minimumPlayers < 0) {
    throw new Error('Minimum players must be a non-negative integer.')
  }
  const maximumPlayers = value.maximumPlayers === undefined ||
      value.maximumPlayers === ''
    ? undefined
    : Number(value.maximumPlayers)
  if (
    maximumPlayers !== undefined &&
    (!Number.isInteger(maximumPlayers) || maximumPlayers < minimumPlayers)
  ) {
    throw new Error('Maximum players must be an integer at least the minimum.')
  }
  const last = value.last === undefined || value.last === ''
    ? undefined
    : Number(value.last)
  if (last !== undefined && (!Number.isInteger(last) || last < 1)) {
    throw new Error('Last must be a positive integer.')
  }
  if (last !== undefined && (value.startDate || value.endDate)) {
    throw new Error('Use either a date range or last days, not both.')
  }
  for (const field of ['startDate', 'endDate'] as const) {
    if (
      value[field] !== undefined &&
      (typeof value[field] !== 'string' || Number.isNaN(Date.parse(value[field])))
    ) {
      throw new Error(`${field} must be a valid date.`)
    }
  }
  if (
    value.tournamentIds !== undefined &&
    (!Array.isArray(value.tournamentIds) ||
      !value.tournamentIds.every((id) => typeof id === 'string'))
  ) {
    throw new Error('Tournament IDs must be strings.')
  }
  const tournamentIds = Array.isArray(value.tournamentIds)
    ? value.tournamentIds
      .map((id) => id.trim())
      .filter(Boolean)
    : []
  return {
    provider: value.provider,
    minimumPlayers,
    maximumPlayers,
    dryRun: value.dryRun === true,
    startDate: value.startDate as string | undefined,
    endDate: value.endDate as string | undefined,
    // Empty arrays must become undefined. TopDeck interprets TID: [] as an
    // explicit ID query and therefore ignores the discovery filters.
    tournamentIds: tournamentIds.length ? tournamentIds : undefined,
    last,
    includeRounds: value.includeRounds === true,
    enrichLocation: value.enrichLocation === true,
    excludeCasualEvents: value.excludeCasualEvents !== false,
  }
}

function mapTournament(
  tournament: ProviderTournament,
  provider: TournamentProvider,
) {
  return {
    source: provider.source,
    source_tournament_id: tournament.sourceTournamentId,
    name: tournament.name,
    event_date: tournament.date,
    player_count: tournament.playerCount,
    source_url: tournament.url,
    // Tournament metadata is fully represented by the normalized columns
    // above. Avoid retaining the large provider response for every event.
    imported_at: new Date().toISOString(),
    source_updated_at: tournament.sourceUpdatedAt,
    venue_name: tournament.location?.venueName,
    city: tournament.location?.city,
    state_region: tournament.location?.stateRegion,
    country_code: tournament.location?.countryCode,
    latitude: tournament.location?.latitude,
    longitude: tournament.location?.longitude,
    location_precision: tournament.location?.locationPrecision ?? 'unknown',
    is_online: tournament.location?.isOnline ?? false,
    region_key: tournament.location?.regionKey ?? 'unknown',
    location_source: tournament.location?.locationSource,
    location_confidence: tournament.location?.locationConfidence,
  }
}

async function mapEntry(
  entry: ProviderTournamentEntry,
  tournamentId: string,
) {
  const identity = normalizeCommander(entry.commanderName)
  const games = entry.wins + entry.losses + entry.draws
  const stableInput = entry.sourceEntryId ??
    `${entry.playerExternalId ?? entry.playerName ?? 'unknown'}|${identity.key}`
  return {
    tournament_id: tournamentId,
    source_entry_id: entry.sourceEntryId,
    source_entry_key: await sha256(stableInput),
    player_name: entry.playerName,
    player_external_id: entry.playerExternalId,
    commander_name: identity.displayName,
    commander_key: identity.key,
    color_identity: entry.colorIdentity,
    standing: entry.standing,
    wins: entry.wins,
    losses: entry.losses,
    draws: entry.draws,
    win_rate: games ? entry.wins / games : null,
    decklist_url: entry.decklistUrl,
    source_payload: entry.raw,
    commander_extraction_status: entry.commanderExtractionStatus,
    decklist_availability: entry.decklistAvailability,
  }
}

function normalizeCommander(name: string) {
  const displayName = name.replace(/\s+/g, ' ').trim()
  const parts = displayName
    .split(/\s*(?:\/\/|\/|&|\+|\bwith\b|\band\b)\s*/i)
    .map((part) => part.toLocaleLowerCase().trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
  return { displayName, key: parts.join(' // ') }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
) {
  let nextIndex = 0
  async function worker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex]
      nextIndex += 1
      if (item !== undefined) await work(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

function createReport() {
  return {
    tournamentsFetched: 0,
    tournamentsInserted: 0,
    tournamentsUpdated: 0,
    entriesFetched: 0,
    entriesInserted: 0,
    entriesUpdated: 0,
    entriesSkipped: 0,
    validationIssues: [] as string[],
    providerErrors: [] as string[],
    durationMs: 0,
    dryRun: false,
    requestsMade: 0,
    retries: 0,
    rateLimitedRequests: 0,
    exhaustedRequests: 0,
    tournamentsPartiallyIngested: 0,
    tournamentsExcluded: 0,
    tournamentsPurged: 0,
    excludedTournamentTitles: [] as string[],
  }
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function readError(error: unknown) {
  if (error instanceof Error) return error.message
  if (isRecord(error)) {
    const message = typeof error.message === 'string' ? error.message : ''
    const code = typeof error.code === 'string' ? ` (${error.code})` : ''
    const hint = typeof error.hint === 'string' && error.hint
      ? ` Hint: ${error.hint}`
      : ''
    if (message) return `${message}${code}${hint}`
  }
  return 'Unknown ingestion error.'
}

function getExcludedTitleKeywords() {
  return buildExcludedTitleKeywords(
    EXCLUDED_TITLE_KEYWORD_CONFIG_KEYS.map((key) => Deno.env.get(key)),
  )
}

function createEmptyResultMessage(options: {
  provider: string
  startDate?: string
  endDate?: string
  last?: number
  minimumPlayers: number
  maximumPlayers?: number
  tournamentIds?: string[]
}) {
  const range = options.last
    ? `the last ${options.last} days`
    : options.startDate || options.endDate
      ? `${options.startDate ?? 'any date'} through ${options.endDate ?? 'any date'}`
      : 'the provider default range'
  const ids = options.tournamentIds?.length
    ? ` for ${options.tournamentIds.length} requested tournament ID(s)`
    : ''
  const maximum = options.maximumPlayers === undefined
    ? ''
    : ` and at most ${options.maximumPlayers}`
  return `${options.provider} returned no completed tournaments${ids} for ${range} with at least ${options.minimumPlayers}${maximum} players. Try a known TID, minimum players 0, or a wider historical range.`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isJobAction(value: unknown): value is JobActionRequest {
  return isRecord(value) && [
    'create-job',
    'create-deck-job',
    'pause-job',
    'resume-job',
    'cancel-job',
    'retry-job',
    'purge-casual-events',
    'clear-tournament-data',
  ].includes(String(value.action))
}

async function handleJobAction(
  admin: AdminClient,
  request: JobActionRequest,
  userId: string,
) {
  if (request.action === 'clear-tournament-data') {
    if (request.confirmationToken !== 'CLEAR TOURNAMENT DATA') {
      throw new Error('Tournament reset confirmation was invalid.')
    }
    const { data, error } = await admin.rpc(
      'clear_tournament_ingestion_data',
    )
    if (error) throw error
    return data
  }
  if (request.action === 'purge-casual-events') {
    return await purgeCasualEvents(admin, request)
  }
  if (
    request.action === 'create-job' ||
    request.action === 'create-deck-job'
  ) {
    if (
      request.provider !== 'topdeck' && request.provider !== 'edhtop16'
    ) throw new Error('A supported provider is required.')
    if (
      !request.startDate || !request.endDate ||
      Number.isNaN(Date.parse(request.startDate)) ||
      Number.isNaN(Date.parse(request.endDate)) ||
      request.endDate < request.startDate
    ) throw new Error('A valid historical date range is required.')
    const windowDays = Number(request.windowDays ?? 7)
    if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 15) {
      throw new Error('Batch size must be between 1 and 15 days.')
    }
    const { data: job, error } = await admin
      .from('tournament_ingestion_jobs')
      .insert({
        provider: request.provider,
        start_date: request.startDate,
        end_date: request.endDate,
        window_days: windowDays,
        minimum_players: Math.max(0, Number(request.minimumPlayers ?? 0)),
        include_rounds: request.includeRounds === true,
        enrich_location: request.enrichLocation === true,
        exclude_casual_events: request.excludeCasualEvents !== false,
        created_by: userId,
      })
      .select('*')
      .single()
    if (error) throw error
    const { error: batchError } = await admin.rpc(
      'create_tournament_ingestion_batches',
      { target_job_id: job.id },
    )
    if (batchError) throw batchError
    if (request.action === 'create-deck-job') {
      // Direct metadata ingestion can enqueue only the second stage. The cron
      // worker then drains normalized Decks without holding the browser open.
      const { error: stageError } = await admin
        .from('tournament_ingestion_batches')
        .update({ stage: 'decks' })
        .eq('job_id', job.id)
      if (stageError) throw stageError
    }
    return { jobId: job.id }
  }

  if (!request.jobId) throw new Error('An ingestion job ID is required.')
  if (request.action === 'pause-job') {
    const { error } = await admin.from('tournament_ingestion_jobs')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', request.jobId)
    if (error) throw error
  } else if (request.action === 'resume-job') {
    const { error } = await admin.from('tournament_ingestion_jobs')
      .update({ status: 'pending', completed_at: null, updated_at: new Date().toISOString() })
      .eq('id', request.jobId)
    if (error) throw error
  } else if (request.action === 'cancel-job') {
    const { error: batchError } = await admin
      .from('tournament_ingestion_batches')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('job_id', request.jobId)
      .eq('status', 'pending')
    if (batchError) throw batchError
    const { error } = await admin.from('tournament_ingestion_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', request.jobId)
    if (error) throw error
  } else {
    const { error: batchError } = await admin
      .from('tournament_ingestion_batches')
      .update({ status: 'pending', last_error: null, completed_at: null })
      .eq('job_id', request.jobId)
      .eq('status', 'failed')
    if (batchError) throw batchError
    const { error } = await admin.from('tournament_ingestion_jobs')
      .update({ status: 'pending', completed_at: null })
      .eq('id', request.jobId)
    if (error) throw error
  }
  return { jobId: request.jobId }
}

async function purgeCasualEvents(
  admin: AdminClient,
  request: JobActionRequest,
) {
  for (const value of [request.startDate, request.endDate]) {
    if (value && Number.isNaN(Date.parse(value))) {
      throw new Error('Purge dates must be valid calendar dates.')
    }
  }
  if (
    request.startDate &&
    request.endDate &&
    request.endDate < request.startDate
  ) {
    throw new Error('Purge end date must not be before its start date.')
  }
  let query = admin.from('tournaments')
    .select('id, name, event_date, tournament_entries(count)')
    .eq('source', 'topdeck')
    .order('event_date', { ascending: true })
    .limit(10000)
  if (request.startDate) query = query.gte('event_date', request.startDate)
  if (request.endDate) {
    const exclusiveEnd = new Date(`${request.endDate}T00:00:00.000Z`)
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
    query = query.lt('event_date', exclusiveEnd.toISOString())
  }
  const { data, error } = await query
  if (error) throw error
  const keywords = getExcludedTitleKeywords()
  const matches = (data ?? []).filter((tournament) =>
    !evaluateTournamentTitle(tournament.name, keywords).included
  )
  const entriesAffected = matches.reduce(
    (total, tournament) =>
      total + Number(tournament.tournament_entries?.[0]?.count ?? 0),
    0,
  )
  let eventsPurged = 0
  if (request.dryRun === false) {
    // Short ID batches keep the generated PostgREST URL bounded.
    for (let index = 0; index < matches.length; index += 100) {
      const ids = matches.slice(index, index + 100).map((item) => item.id)
      const { data: deleted, error: deleteError } = await admin
        .from('tournaments').delete().in('id', ids).select('id')
      if (deleteError) throw deleteError
      eventsPurged += deleted?.length ?? 0
    }
  }
  return {
    dryRun: request.dryRun !== false,
    eventsMatched: matches.length,
    eventsPurged,
    entriesAffected,
    titles: matches.slice(0, 100).map((tournament) => tournament.name),
    truncated: matches.length > 100,
  }
}
