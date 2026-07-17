import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EdhTop16Provider } from './edhtop16.ts'
import type {
  ProviderTournament,
  ProviderTournamentEntry,
  TournamentProvider,
} from './types.ts'

interface IngestionRequest {
  provider: 'edhtop16'
  startDate?: string
  endDate?: string
  minimumPlayers?: number
  tournamentIds?: string[]
  dryRun?: boolean
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

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userData } = await userClient.auth.getUser()
    if (!userData.user) return json({ error: 'Authentication required.' }, 401)
    const { data: membership } = await userClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!membership) return json({ error: 'Administrator access required.' }, 403)

    const options = validateRequest(await request.json())
    const provider = getProvider(options.provider)
    const tournaments = await provider.listTournaments(options)
    report.tournamentsFetched = tournaments.length
    const admin = createClient(url, serviceKey)

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
        report.providerErrors.push(readError(error))
      }
    })

    report.durationMs = Date.now() - startedAt
    report.dryRun = options.dryRun
    return json(report)
  } catch (error) {
    report.providerErrors.push(readError(error))
    report.durationMs = Date.now() - startedAt
    return json(report, 400)
  }
})

function getProvider(source: 'edhtop16'): TournamentProvider {
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
  if (!isRecord(value) || value.provider !== 'edhtop16') {
    throw new Error('Provider must be edhtop16.')
  }
  const minimumPlayers = Number(value.minimumPlayers ?? 0)
  if (!Number.isInteger(minimumPlayers) || minimumPlayers < 0) {
    throw new Error('Minimum players must be a non-negative integer.')
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
  return {
    provider: 'edhtop16',
    minimumPlayers,
    dryRun: value.dryRun === true,
    startDate: value.startDate as string | undefined,
    endDate: value.endDate as string | undefined,
    tournamentIds: value.tournamentIds as string[] | undefined,
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
    source_payload: tournament.raw,
    imported_at: new Date().toISOString(),
    source_updated_at: tournament.sourceUpdatedAt,
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
  }
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown ingestion error.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
