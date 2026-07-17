import { supabase } from '../lib/supabase'

export interface IngestionOptions {
  provider: 'edhtop16'
  startDate?: string
  endDate?: string
  minimumPlayers: number
  dryRun: boolean
}

export interface IngestionReport {
  tournamentsFetched: number
  tournamentsInserted: number
  tournamentsUpdated: number
  entriesFetched: number
  entriesInserted: number
  entriesUpdated: number
  entriesSkipped: number
  validationIssues: string[]
  providerErrors: string[]
  durationMs: number
  dryRun: boolean
}

export interface AdminTournamentSummary {
  id: string
  name: string
  source: string
  eventDate: string | null
  playerCount: number | null
  importedAt: string
}

export interface IngestionDashboardMetrics {
  tournamentCount: number
  entryCount: number
  linkedDecklistCount: number
  latestImportAt: string | null
  recentTournaments: AdminTournamentSummary[]
}

/** Keeps Edge Function invocation and admin checks outside presentation code. */
export const ingestionRepository = {
  async isCurrentUserAdmin(): Promise<boolean> {
    if (!supabase) return false
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return false
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (error) return false
    return Boolean(data)
  },

  async ingest(options: IngestionOptions): Promise<IngestionReport> {
    if (!supabase) throw new Error('Supabase is not configured.')

    // Database requests use the client's session automatically. Supplying the
    // access token explicitly here also guarantees that the Edge Function
    // gateway receives Authorization when validating verify_jwt requests.
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (sessionError || !accessToken) {
      throw new Error('Your session has expired. Sign in again to ingest data.')
    }

    const { data, error } = await supabase.functions.invoke(
      'ingest-tournaments',
      {
        body: options,
        headers: createAuthorizationHeaders(accessToken),
      },
    )
    if (error) {
      throw new Error(await getFunctionErrorMessage(error))
    }
    return data as IngestionReport
  },

  /** Loads small aggregate counts and a bounded recent-import table. */
  async getDashboardMetrics(): Promise<IngestionDashboardMetrics> {
    if (!supabase) throw new Error('Supabase is not configured.')

    const [
      tournamentsResult,
      entriesResult,
      decklistsResult,
      recentResult,
    ] = await Promise.all([
      supabase.from('tournaments').select('*', { count: 'exact', head: true }),
      supabase
        .from('tournament_entries')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('tournament_entries')
        .select('*', { count: 'exact', head: true })
        .not('decklist_url', 'is', null),
      supabase
        .from('tournaments')
        .select(
          'id, name, source, event_date, player_count, imported_at',
        )
        .order('imported_at', { ascending: false })
        .limit(10),
    ])

    const error =
      tournamentsResult.error ??
      entriesResult.error ??
      decklistsResult.error ??
      recentResult.error
    if (error) {
      console.warn('Unable to load ingestion dashboard metrics.', error)
      throw new Error('Unable to load admin dashboard metrics.')
    }

    const recentTournaments = (
      (recentResult.data ?? []) as AdminTournamentRow[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      source: row.source,
      eventDate: row.event_date,
      playerCount: row.player_count,
      importedAt: row.imported_at,
    }))

    return {
      tournamentCount: tournamentsResult.count ?? 0,
      entryCount: entriesResult.count ?? 0,
      linkedDecklistCount: decklistsResult.count ?? 0,
      latestImportAt: recentTournaments[0]?.importedAt ?? null,
      recentTournaments,
    }
  },
}

/** Kept separate so authorization formatting can be tested without a request. */
export function createAuthorizationHeaders(
  accessToken: string,
): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` }
}

interface AdminTournamentRow {
  id: string
  name: string
  source: string
  event_date: string | null
  player_count: number | null
  imported_at: string
}

/** Supabase attaches the Edge Function response to HTTP errors as context. */
export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'context' in error &&
    error.context instanceof Response
  ) {
    try {
      const body: unknown = await error.context.clone().json()
      if (isRecord(body)) {
        if (typeof body.error === 'string') return body.error
        if (
          Array.isArray(body.providerErrors) &&
          body.providerErrors.every((item) => typeof item === 'string') &&
          body.providerErrors.length
        ) {
          return body.providerErrors.join(' ')
        }
      }
    } catch {
      // A non-JSON platform error falls through to the stable message below.
    }
  }
  return 'Tournament ingestion failed. Check the Edge Function logs.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
