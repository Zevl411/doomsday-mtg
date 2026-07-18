import { supabase } from '../lib/supabase'

export interface IngestionOptions {
  provider: 'edhtop16' | 'topdeck'
  startDate?: string
  endDate?: string
  last?: number
  minimumPlayers: number
  dryRun: boolean
  maximumPlayers?: number
  tournamentIds?: string[]
  includeRounds?: boolean
  enrichLocation?: boolean
  excludeCasualEvents?: boolean
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
  requestsMade: number
  retries: number
  rateLimitedRequests: number
  exhaustedRequests: number
  tournamentsPartiallyIngested: number
  tournamentsExcluded: number
  tournamentsPurged: number
  excludedTournamentTitles: string[]
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
  topDeckCount: number
  edhTop16Count: number
  locationCount: number
  unknownLocationCount: number
  commanderFailureCount: number
  structuredDeckCount: number
  plaintextDeckCount: number
  urlOnlyDeckCount: number
  unavailableSourceDeckCount: number
  possibleMatchCount: number
  linkedEventCount: number
  normalizedDeckCount: number
  completeDeckCount: number
  partialDeckCount: number
  deckCoverage: TournamentDeckCoverage[]
  recentTournaments: AdminTournamentSummary[]
}

export interface TournamentDeckCoverage {
  dimension: string
  groupKey: string
  decks: number
  complete: number
  partial: number
  unavailable: number
  unresolvedCards: number
}

export type IngestionJobStatus =
  | 'pending' | 'running' | 'completed' | 'completed_with_errors'
  | 'paused' | 'cancelled'

export interface IngestionJob {
  id: string
  provider: 'topdeck' | 'edhtop16'
  startDate: string
  endDate: string
  windowDays: number
  status: IngestionJobStatus
  totalBatches: number
  completedBatches: number
  failedBatches: number
  createdAt: string
  lastError?: string
}

export interface CreateIngestionJobOptions {
  provider: 'topdeck' | 'edhtop16'
  startDate: string
  endDate: string
  windowDays: number
  minimumPlayers: number
  includeRounds: boolean
  enrichLocation: boolean
  excludeCasualEvents: boolean
}

export interface PurgeCasualEventsOptions {
  startDate?: string
  endDate?: string
  dryRun: boolean
}

export interface PurgeCasualEventsReport {
  dryRun: boolean
  eventsMatched: number
  eventsPurged: number
  entriesAffected: number
  titles: string[]
  truncated: boolean
}

export interface ClearTournamentDataReport {
  tournamentsDeleted: number
  entriesDeleted: number
  normalizedDecksDeleted: number
  normalizedCardsDeleted: number
  ingestionJobsDeleted: number
}

export interface TournamentDeckIngestionOptions {
  provider?: 'topdeck' | 'edhtop16'
  startDate?: string
  endDate?: string
  last?: number
  commanderKey?: string
  tournamentIds?: string[]
  onlyMissing: boolean
  retryPartial: boolean
  dryRun: boolean
}

export interface TournamentDeckIngestionReport {
  entriesConsidered: number
  decklistsAvailable: number
  structuredDecksUsed: number
  plaintextDecksUsed: number
  externalUrlsFetched: number
  decksCompleted: number
  decksPartial: number
  decksUnavailable: number
  cardsResolved: number
  cardsUnresolved: number
  decksInserted: number
  decksUpdated: number
  decksUnchanged: number
  errors: string[]
  durationMs: number
  hasMore: boolean
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

  /**
   * TopDeck materializes a complete discovery response before normalization.
   * Split normal date-range runs into small windows so one provider response
   * cannot exhaust the Edge Function's memory allocation.
   */
  async ingestAllTournaments(
    options: IngestionOptions,
  ): Promise<IngestionReport> {
    const windows = createDateWindows(options.startDate, options.endDate, 3)
    if (
      windows.length <= 1 ||
      options.last ||
      options.tournamentIds?.length
    ) {
      return this.ingest(options)
    }

    const total = emptyIngestionReport(options.dryRun)
    for (const window of windows) {
      let report: IngestionReport
      try {
        report = await this.ingest({
          ...options,
          startDate: window.startDate,
          endDate: window.endDate,
        })
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Unknown tournament metadata ingestion error.'
        throw new Error(`Tournament metadata ingestion failed: ${message}`)
      }
      addIngestionReport(total, report)
      if (report.providerErrors.length) return total
    }
    return total
  },

  async createJob(options: CreateIngestionJobOptions): Promise<string> {
    const result = await invokeAuthenticatedFunction({
      action: 'create-job',
      ...options,
    })
    if (!isRecord(result) || typeof result.jobId !== 'string') {
      throw new Error('The ingestion job response was invalid.')
    }
    return result.jobId
  },

  async updateJob(
    jobId: string,
    action: 'pause-job' | 'resume-job' | 'cancel-job' | 'retry-job',
  ): Promise<void> {
    await invokeAuthenticatedFunction({ action, jobId })
  },

  async purgeCasualEvents(
    options: PurgeCasualEventsOptions,
  ): Promise<PurgeCasualEventsReport> {
    const result = await invokeAuthenticatedFunction({
      action: 'purge-casual-events',
      ...options,
    })
    if (
      !isRecord(result) ||
      typeof result.eventsMatched !== 'number' ||
      typeof result.eventsPurged !== 'number' ||
      typeof result.entriesAffected !== 'number' ||
      !Array.isArray(result.titles)
    ) {
      throw new Error('The casual-event purge response was invalid.')
    }
    return result as unknown as PurgeCasualEventsReport
  },

  async clearTournamentData(): Promise<ClearTournamentDataReport> {
    const result = await invokeAuthenticatedFunction({
      action: 'clear-tournament-data',
      confirmationToken: 'CLEAR TOURNAMENT DATA',
    })
    if (
      !isRecord(result) ||
      typeof result.tournamentsDeleted !== 'number' ||
      typeof result.entriesDeleted !== 'number' ||
      typeof result.normalizedDecksDeleted !== 'number' ||
      typeof result.normalizedCardsDeleted !== 'number' ||
      typeof result.ingestionJobsDeleted !== 'number'
    ) {
      throw new Error('The tournament reset response was invalid.')
    }
    return result as unknown as ClearTournamentDataReport
  },

  async ingestTournamentDecks(
    options: TournamentDeckIngestionOptions,
  ): Promise<TournamentDeckIngestionReport> {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Your session has expired. Sign in again.')
    const { data, error } = await supabase.functions.invoke(
      'ingest-tournament-decks',
      {
        body: options,
        headers: createAuthorizationHeaders(token),
      },
    )
    if (error) throw new Error(await getFunctionErrorMessage(error))
    return data as TournamentDeckIngestionReport
  },

  /**
   * Drains bounded Edge Function batches. Each invocation selects
   * only rows that still need a normalized Deck, so large ranges advance
   * without exceeding one function's memory or execution limits.
   */
  async ingestAllTournamentDecks(
    options: TournamentDeckIngestionOptions,
  ): Promise<TournamentDeckIngestionReport> {
    // A dry run cannot advance the missing-row queue because it intentionally
    // writes nothing, so one representative bounded batch is sufficient.
    if (options.dryRun || !options.onlyMissing) {
      return this.ingestTournamentDecks(options)
    }

    const total = emptyDeckIngestionReport()
    for (let batch = 0; batch < 100; batch += 1) {
      let report: TournamentDeckIngestionReport
      try {
        report = await this.ingestTournamentDecks(options)
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Unknown card-level ingestion error.'
        throw new Error(`Card-level decklist normalization failed: ${message}`)
      }
      addDeckIngestionReport(total, report)
      if (!report.hasMore) return total
    }
    throw new Error(
      'Decklist normalization paused after 100 batches. Run ingestion again to continue.',
    )
  },

  async getJobs(): Promise<IngestionJob[]> {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase
      .from('tournament_ingestion_jobs')
      .select(
        '*, tournament_ingestion_batches(last_error, updated_at)',
      )
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw new Error('Unable to load historical ingestion jobs.')
    return ((data ?? []) as IngestionJobRow[]).map((row) => {
      const errors = [...(row.tournament_ingestion_batches ?? [])]
        .filter((batch) => batch.last_error)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      return {
        id: row.id,
        provider: row.provider,
        startDate: row.start_date,
        endDate: row.end_date,
        windowDays: row.window_days,
        status: row.status,
        totalBatches: row.total_batches,
        completedBatches: row.completed_batches,
        failedBatches: row.failed_batches,
        createdAt: row.created_at,
        lastError: errors[0]?.last_error ?? undefined,
      }
    })
  },

  /** Loads small aggregate counts and a bounded recent-import table. */
  async getDashboardMetrics(): Promise<IngestionDashboardMetrics> {
    if (!supabase) throw new Error('Supabase is not configured.')

    const [
      tournamentsResult,
      entriesResult,
      decklistsResult,
      recentResult,
      topDeckResult,
      edhTop16Result,
      locationResult,
      commanderFailuresResult,
      structuredDecksResult,
      plaintextDecksResult,
      urlDecksResult,
      unavailableSourceDecksResult,
      possibleMatchesResult,
      linkedEventsResult,
      normalizedDecksResult,
      completeDecksResult,
      partialDecksResult,
      coverageResult,
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
      supabase.from('tournaments').select('*', { count: 'exact', head: true })
        .eq('source', 'topdeck'),
      supabase.from('tournaments').select('*', { count: 'exact', head: true })
        .eq('source', 'edhtop16'),
      supabase.from('tournaments').select('*', { count: 'exact', head: true })
        .not('region_key', 'is', null)
        .neq('region_key', 'unknown'),
      supabase.from('tournament_entries').select('*', { count: 'exact', head: true })
        .in('commander_extraction_status', ['missing', 'invalid']),
      supabase.from('tournament_entries').select('*', { count: 'exact', head: true })
        .eq('decklist_availability', 'structured'),
      supabase.from('tournament_entries').select('*', { count: 'exact', head: true })
        .eq('decklist_availability', 'plaintext'),
      supabase.from('tournament_entries').select('*', { count: 'exact', head: true })
        .eq('decklist_availability', 'url'),
      supabase.from('tournament_entries').select('*', { count: 'exact', head: true })
        .eq('decklist_availability', 'missing'),
      supabase.from('possible_tournament_matches')
        .select('*', { count: 'exact', head: true }),
      supabase.from('linked_tournament_events')
        .select('tournament_id', { count: 'exact', head: true }),
      supabase.from('tournament_decks')
        .select('*', { count: 'exact', head: true }),
      supabase.from('tournament_decks')
        .select('*', { count: 'exact', head: true })
        .eq('parsing_status', 'complete'),
      supabase.from('tournament_decks')
        .select('*', { count: 'exact', head: true })
        .eq('parsing_status', 'partial'),
      supabase.rpc('get_tournament_deck_coverage'),
    ])

    const error =
      tournamentsResult.error ??
      entriesResult.error ??
      decklistsResult.error ??
      recentResult.error
      ?? topDeckResult.error
      ?? edhTop16Result.error
      ?? locationResult.error
      ?? commanderFailuresResult.error
      ?? structuredDecksResult.error
      ?? plaintextDecksResult.error
      ?? urlDecksResult.error
      ?? unavailableSourceDecksResult.error
      ?? possibleMatchesResult.error
      ?? linkedEventsResult.error
      ?? normalizedDecksResult.error
      ?? completeDecksResult.error
      ?? partialDecksResult.error
      ?? coverageResult.error
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
      topDeckCount: topDeckResult.count ?? 0,
      edhTop16Count: edhTop16Result.count ?? 0,
      locationCount: locationResult.count ?? 0,
      unknownLocationCount:
        (tournamentsResult.count ?? 0) - (locationResult.count ?? 0),
      commanderFailureCount: commanderFailuresResult.count ?? 0,
      structuredDeckCount: structuredDecksResult.count ?? 0,
      plaintextDeckCount: plaintextDecksResult.count ?? 0,
      urlOnlyDeckCount: urlDecksResult.count ?? 0,
      unavailableSourceDeckCount: unavailableSourceDecksResult.count ?? 0,
      possibleMatchCount: possibleMatchesResult.count ?? 0,
      linkedEventCount: linkedEventsResult.count ?? 0,
      normalizedDeckCount: normalizedDecksResult.count ?? 0,
      completeDeckCount: completeDecksResult.count ?? 0,
      partialDeckCount: partialDecksResult.count ?? 0,
      deckCoverage: ((coverageResult.data ?? []) as DeckCoverageRow[])
        .map((row) => ({
          dimension: row.dimension,
          groupKey: row.group_key,
          decks: Number(row.decks),
          complete: Number(row.complete),
          partial: Number(row.partial),
          unavailable: Number(row.unavailable),
          unresolvedCards: Number(row.unresolved_cards),
        })),
    }
  },
}

function emptyDeckIngestionReport(): TournamentDeckIngestionReport {
  return {
    entriesConsidered: 0,
    decklistsAvailable: 0,
    structuredDecksUsed: 0,
    plaintextDecksUsed: 0,
    externalUrlsFetched: 0,
    decksCompleted: 0,
    decksPartial: 0,
    decksUnavailable: 0,
    cardsResolved: 0,
    cardsUnresolved: 0,
    decksInserted: 0,
    decksUpdated: 0,
    decksUnchanged: 0,
    errors: [],
    durationMs: 0,
    hasMore: false,
  }
}

function emptyIngestionReport(dryRun: boolean): IngestionReport {
  return {
    tournamentsFetched: 0,
    tournamentsInserted: 0,
    tournamentsUpdated: 0,
    entriesFetched: 0,
    entriesInserted: 0,
    entriesUpdated: 0,
    entriesSkipped: 0,
    validationIssues: [],
    providerErrors: [],
    durationMs: 0,
    dryRun,
    requestsMade: 0,
    retries: 0,
    rateLimitedRequests: 0,
    exhaustedRequests: 0,
    tournamentsPartiallyIngested: 0,
    tournamentsExcluded: 0,
    tournamentsPurged: 0,
    excludedTournamentTitles: [],
  }
}

function addIngestionReport(total: IngestionReport, report: IngestionReport) {
  total.tournamentsFetched += report.tournamentsFetched
  total.tournamentsInserted += report.tournamentsInserted
  total.tournamentsUpdated += report.tournamentsUpdated
  total.entriesFetched += report.entriesFetched
  total.entriesInserted += report.entriesInserted
  total.entriesUpdated += report.entriesUpdated
  total.entriesSkipped += report.entriesSkipped
  total.durationMs += report.durationMs
  total.requestsMade += report.requestsMade
  total.retries += report.retries
  total.rateLimitedRequests += report.rateLimitedRequests
  total.exhaustedRequests += report.exhaustedRequests
  total.tournamentsPartiallyIngested += report.tournamentsPartiallyIngested
  total.tournamentsExcluded += report.tournamentsExcluded
  total.tournamentsPurged += report.tournamentsPurged
  total.validationIssues.push(...report.validationIssues)
  total.providerErrors.push(...report.providerErrors)
  total.excludedTournamentTitles.push(...report.excludedTournamentTitles)
}

function createDateWindows(
  startDate: string | undefined,
  endDate: string | undefined,
  windowDays: number,
) {
  if (!startDate || !endDate) return []
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00.000Z`)
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00.000Z`)
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) return []

  const windows: Array<{ startDate: string; endDate: string }> = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const windowEnd = new Date(cursor)
    windowEnd.setUTCDate(windowEnd.getUTCDate() + windowDays - 1)
    if (windowEnd > end) windowEnd.setTime(end.getTime())
    windows.push({
      startDate: cursor.toISOString().slice(0, 10),
      endDate: windowEnd.toISOString().slice(0, 10),
    })
    cursor.setUTCDate(cursor.getUTCDate() + windowDays)
  }
  return windows
}

function addDeckIngestionReport(
  total: TournamentDeckIngestionReport,
  report: TournamentDeckIngestionReport,
) {
  total.entriesConsidered += report.entriesConsidered
  total.decklistsAvailable += report.decklistsAvailable
  total.structuredDecksUsed += report.structuredDecksUsed
  total.plaintextDecksUsed += report.plaintextDecksUsed
  total.externalUrlsFetched += report.externalUrlsFetched
  total.decksCompleted += report.decksCompleted
  total.decksPartial += report.decksPartial
  total.decksUnavailable += report.decksUnavailable
  total.cardsResolved += report.cardsResolved
  total.cardsUnresolved += report.cardsUnresolved
  total.decksInserted += report.decksInserted
  total.decksUpdated += report.decksUpdated
  total.decksUnchanged += report.decksUnchanged
  total.errors.push(...report.errors)
  total.durationMs += report.durationMs
  total.hasMore = report.hasMore
}

async function invokeAuthenticatedFunction(
  body: Record<string, unknown>,
): Promise<unknown> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (sessionError || !accessToken) {
    throw new Error('Your session has expired. Sign in again.')
  }
  const { data, error } = await supabase.functions.invoke(
    'ingest-tournaments',
    {
      body,
      headers: createAuthorizationHeaders(accessToken),
    },
  )
  if (error) throw new Error(await getFunctionErrorMessage(error))
  return data
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

interface DeckCoverageRow {
  dimension: string
  group_key: string
  decks: number
  complete: number
  partial: number
  unavailable: number
  unresolved_cards: number
}

interface IngestionJobRow {
  id: string
  provider: 'topdeck' | 'edhtop16'
  start_date: string
  end_date: string
  window_days: number
  status: IngestionJobStatus
  total_batches: number
  completed_batches: number
  failed_batches: number
  created_at: string
  tournament_ingestion_batches?: Array<{
    last_error: string | null
    updated_at: string
  }>
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
          Array.isArray(body.errors) &&
          body.errors.every((item) => typeof item === 'string') &&
          body.errors.length
        ) {
          return body.errors.join(' ')
        }
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
