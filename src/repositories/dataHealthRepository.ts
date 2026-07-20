import { supabase } from '../lib/supabase'
import type {
  CommanderReadiness,
  DataHealthFilters,
  DataHealthReport,
  DataHealthSmokeTest,
  DataHealthSummary,
  IngestionJobHealth,
  RegionCoverage,
  UnresolvedCardHealth,
} from '../models/dataHealth'
import { checkComparisonSamples, checkDataHealthConsistency } from '../services/dataHealth'
import { parseTournamentSimilarityRows } from './deckComparisonRepository'
import { parseCommanderInclusionRows } from './tournamentRepository'

/** Admin diagnostics cross one typed repository and never query private Decks. */
export const dataHealthRepository = {
  async isCurrentUserAdmin(): Promise<boolean> {
    if (!supabase) return false
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return false
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    return !error && Boolean(data)
  },

  async load(filters: DataHealthFilters = {}): Promise<DataHealthReport> {
    requireSupabase()
    const [summaryResult, readinessResult, unresolvedResult, jobsResult, regionsResult] =
      await Promise.all([
        supabase!.rpc('get_data_health_summary'),
        supabase!.rpc('get_commander_analytics_readiness', {
          p_minimum_complete_decks: Math.max(
            0,
            filters.minimumCompleteDecks ?? 0,
          ),
          p_sample_status: filters.sampleStatus ?? null,
          p_paired_only: filters.pairedOnly ?? false,
          p_provider: filters.provider ?? null,
          p_region_key: null,
          p_start_date: filters.startDate ?? null,
          p_end_date: filters.endDate ?? null,
          p_limit: boundedLimit(filters.readinessLimit, 100),
        }),
        supabase!.rpc('get_unresolved_card_health', {
          p_minimum_occurrences: Math.max(
            1,
            filters.minimumOccurrences ?? 1,
          ),
          p_provider: filters.provider ?? null,
          p_issue_code: filters.issueCode ?? 'unknown_card',
          p_limit: boundedLimit(filters.unresolvedLimit, 100),
        }),
        supabase!.rpc('get_ingestion_job_health', {
          p_status: filters.jobStatus ?? null,
          p_stage: filters.jobStage ?? null,
          p_updated_since: filters.jobsUpdatedSince ?? null,
          p_limit: boundedLimit(filters.jobLimit, 100),
        }),
        supabase!.rpc('get_data_health_region_coverage', { p_limit: 50 }),
      ])

    throwRpcError(summaryResult.error)
    throwRpcError(readinessResult.error)
    throwRpcError(unresolvedResult.error)
    throwRpcError(jobsResult.error)
    throwRpcError(regionsResult.error)
    const summary = parseDataHealthSummary(summaryResult.data)
    const commanders = parseCommanderReadinessRows(readinessResult.data)
    return {
      summary,
      commanders,
      unresolvedCards: parseUnresolvedCardRows(unresolvedResult.data),
      jobs: parseIngestionJobHealthRows(jobsResult.data),
      regions: parseRegionCoverageRows(regionsResult.data),
      consistencyChecks: checkDataHealthConsistency(summary, commanders),
    }
  },

  async runSmokeTest(
    commander: CommanderReadiness,
    filters: Pick<DataHealthFilters, 'startDate' | 'endDate'> = {},
  ): Promise<DataHealthSmokeTest> {
    requireSupabase()
    const common = {
      p_commander_key: commander.commanderKey,
      p_start_date: filters.startDate ?? null,
      p_end_date: filters.endDate ?? null,
      p_minimum_tournament_size: null,
      p_maximum_standing: null,
      p_country_code: null,
      p_state_region: null,
      p_region_key: null,
      p_is_online: null,
      p_minimum_complete_decks: 1,
    }
    const [inclusionResult, aggregateResult, similarityResult] =
      await Promise.all([
        supabase!.rpc('get_commander_card_inclusion', {
          target_commander_key: commander.commanderKey,
          start_date: filters.startDate ?? null,
          end_date: filters.endDate ?? null,
          minimum_players: 0,
          country_filter: null,
          state_filter: null,
          region_filter: null,
          online_filter: null,
          maximum_standing: null,
          minimum_complete_decks: 1,
        }),
        supabase!.rpc('get_deck_comparison_aggregate', common),
        supabase!.rpc('get_similar_tournament_decks', {
          ...common,
          p_card_keys: [],
          p_similarity_limit: 20,
        }),
      ])
    throwRpcError(inclusionResult.error)
    throwRpcError(aggregateResult.error)
    throwRpcError(similarityResult.error)

    const inclusion = parseCommanderInclusionRows(inclusionResult.data)
    const aggregate = parseCommanderInclusionRows(aggregateResult.data)
    const similarities = parseTournamentSimilarityRows(similarityResult.data)
    const inclusionSample = inclusion[0]?.totalEligibleDecks ?? 0
    const aggregateSample = aggregate[0]?.totalEligibleDecks ?? 0
    const checks = checkComparisonSamples(
      inclusionSample,
      aggregateSample,
      similarities.length,
      aggregate[0]?.top16DeckCount ?? 0,
      aggregate[0]?.firstPlaceDeckCount ?? 0,
    )
    checks.unshift({
      label: 'Commander inclusion rows',
      status: inclusion.length ? 'pass' : 'warning',
      message: `${inclusion.length} bounded card rows returned.`,
    })
    checks.push({
      label: 'Tournament Deck identities',
      status: similarities.every((row) => Boolean(row.tournamentDeckId))
        ? 'pass'
        : 'fail',
      message: `${similarities.length} returned Deck IDs resolved through the similarity RPC.`,
    })
    checks.push({
      label: 'Canonical card references',
      status: inclusion.every((row) => Boolean(row.normalizedCardKey))
        ? 'pass'
        : 'fail',
      message: `${inclusion.length} inclusion rows returned stable analytical identities.`,
    })
    checks.push({
      label: 'Canonical-only execution',
      status: 'pass',
      message: 'Smoke checks used Supabase RPCs without Scryfall or provider APIs.',
    })
    return {
      commanderKey: commander.commanderKey,
      checks,
      inclusionRows: inclusion.length,
      aggregateRows: aggregate.length,
      similarityRows: similarities.length,
      inclusionSample,
      aggregateSample,
    }
  },
}

export function parseDataHealthSummary(value: unknown): DataHealthSummary {
  const row = singleRecord(value, 'The data health response was invalid.')
  requireFields(row, SUMMARY_NUMBER_FIELDS, 'The data health response was invalid.')
  requireNullableStrings(row, SUMMARY_DATE_FIELDS, 'The data health response was invalid.')
  return {
    tournamentCount: row.tournament_count,
    entryCount: row.entry_count,
    topdeckTournamentCount: row.topdeck_tournament_count,
    edhtop16TournamentCount: row.edhtop16_tournament_count,
    topdeckEntryCount: row.topdeck_entry_count,
    edhtop16EntryCount: row.edhtop16_entry_count,
    firstEventDate: optionalString(row.first_event_date),
    latestEventDate: optionalString(row.latest_event_date),
    tournamentWithLocationCount: row.tournament_with_location_count,
    tournamentWithoutLocationCount: row.tournament_without_location_count,
    tournamentMissingDateCount: row.tournament_missing_date_count,
    excludedCasualEventCount: row.excluded_casual_event_count,
    structuredEntryCount: row.structured_entry_count,
    plaintextEntryCount: row.plaintext_entry_count,
    urlOnlyEntryCount: row.url_only_entry_count,
    missingDecklistEntryCount: row.missing_decklist_entry_count,
    normalizedDeckCount: row.normalized_deck_count,
    completeDeckCount: row.complete_deck_count,
    partialDeckCount: row.partial_deck_count,
    unavailableDeckCount: row.unavailable_deck_count,
    invalidDeckCount: row.invalid_deck_count,
    canonicalCardCount: row.canonical_card_count,
    canonicalAliasCount: row.canonical_alias_count,
    canonicalWithOracleCount: row.canonical_with_oracle_count,
    fallbackIdentityCount: row.fallback_identity_count,
    unresolvedCardRowCount: row.unresolved_card_row_count,
    tournamentCardCount: row.tournament_card_count,
    tournamentCardWithoutCanonicalCount:
      row.tournament_card_without_canonical_count,
    suspiciousAliasCount: row.suspicious_alias_count,
    commanderWithOneCompleteCount: row.commander_with_one_complete_count,
    commanderWithFiveCompleteCount: row.commander_with_five_complete_count,
    commanderWithTwentyCompleteCount:
      row.commander_with_twenty_complete_count,
    commanderWithFiftyCompleteCount: row.commander_with_fifty_complete_count,
    commanderWithoutCompleteCount: row.commander_without_complete_count,
    pairedCommanderSampleCount: row.paired_commander_sample_count,
    regionalCompleteDeckCount: row.regional_complete_deck_count,
    possibleMatchCount: row.possible_match_count,
    linkedEventCount: row.linked_event_count,
    pendingJobCount: row.pending_job_count,
    runningJobCount: row.running_job_count,
    failedJobCount: row.failed_job_count,
    pausedJobCount: row.paused_job_count,
    completedJobCount: row.completed_job_count,
    staleJobCount: row.stale_job_count,
    lastSuccessfulTournamentIngestion:
      optionalString(row.last_successful_tournament_ingestion),
    lastSuccessfulDeckNormalization:
      optionalString(row.last_successful_deck_normalization),
  }
}

export function parseCommanderReadinessRows(
  value: unknown,
): CommanderReadiness[] {
  if (!Array.isArray(value)) {
    throw new Error('The Commander readiness response was invalid.')
  }
  return value.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.commander_key !== 'string' ||
      typeof row.commander_name !== 'string' ||
      !hasNumberFields(row, READINESS_NUMBER_FIELDS) ||
      !hasBooleanFields(row, READINESS_BOOLEAN_FIELDS) ||
      !isSampleStatus(row.sample_status) ||
      !isNullableString(row.first_event_date) ||
      !isNullableString(row.latest_event_date) ||
      !isNullableString(row.representative_deck_id)
    ) {
      throw new Error('The Commander readiness response was invalid.')
    }
    return {
      commanderKey: row.commander_key,
      commanderName: row.commander_name,
      completeDeckCount: row.complete_deck_count,
      partialDeckCount: row.partial_deck_count,
      unavailableDeckCount: row.unavailable_deck_count,
      tournamentCount: row.tournament_count,
      entryCount: row.entry_count,
      firstEventDate: optionalString(row.first_event_date),
      latestEventDate: optionalString(row.latest_event_date),
      countryCount: row.country_count,
      stateRegionCount: row.state_region_count,
      pairedCommander: row.paired_commander,
      inclusionReady: row.inclusion_ready,
      comparisonReady: row.comparison_ready,
      sampleStatus: row.sample_status,
      top16SampleCount: row.top16_sample_count,
      firstPlaceSampleCount: row.first_place_sample_count,
      regionalSampleCount: row.regional_sample_count,
      unresolvedCardRate: row.unresolved_card_rate,
      representativeDeckId: optionalString(row.representative_deck_id),
      aliasMismatchCount: row.alias_mismatch_count,
      oneSidedExtractionFailureCount:
        row.one_sided_extraction_failure_count,
    }
  })
}

export function parseUnresolvedCardRows(
  value: unknown,
): UnresolvedCardHealth[] {
  if (!Array.isArray(value)) {
    throw new Error('The unresolved-card report was invalid.')
  }
  return value.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.normalized_name !== 'string' ||
      typeof row.display_name !== 'string' ||
      !hasNumberFields(row, UNRESOLVED_NUMBER_FIELDS) ||
      !isNullableString(row.first_seen_at) ||
      !isNullableString(row.last_seen_at) ||
      typeof row.sample_issue_code !== 'string' ||
      typeof row.current_alias_match !== 'boolean'
    ) {
      throw new Error('The unresolved-card report was invalid.')
    }
    const providerBreakdown = parseProviderBreakdown(row.provider_breakdown)
    return {
      normalizedName: row.normalized_name,
      displayName: row.display_name,
      occurrenceCount: row.occurrence_count,
      affectedDeckCount: row.affected_deck_count,
      affectedCommanderCount: row.affected_commander_count,
      firstSeenAt: optionalString(row.first_seen_at),
      lastSeenAt: optionalString(row.last_seen_at),
      sampleIssueCode: row.sample_issue_code,
      providerBreakdown,
      currentAliasMatch: row.current_alias_match,
    }
  })
}

export function parseIngestionJobHealthRows(
  value: unknown,
): IngestionJobHealth[] {
  if (!Array.isArray(value)) {
    throw new Error('The ingestion job health response was invalid.')
  }
  return value.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.job_id !== 'string' ||
      typeof row.provider !== 'string' ||
      typeof row.job_status !== 'string' ||
      typeof row.stage !== 'string' ||
      typeof row.start_date !== 'string' ||
      typeof row.end_date !== 'string' ||
      typeof row.attempts !== 'number' ||
      typeof row.updated_at !== 'string' ||
      !isNullableString(row.last_error) ||
      typeof row.stale !== 'boolean'
    ) {
      throw new Error('The ingestion job health response was invalid.')
    }
    return {
      jobId: row.job_id,
      provider: row.provider,
      jobStatus: row.job_status,
      stage: row.stage,
      startDate: row.start_date,
      endDate: row.end_date,
      attempts: row.attempts,
      updatedAt: row.updated_at,
      lastError: optionalString(row.last_error),
      stale: row.stale,
    }
  })
}

export function parseRegionCoverageRows(value: unknown): RegionCoverage[] {
  if (!Array.isArray(value)) {
    throw new Error('The region coverage response was invalid.')
  }
  return value.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.region_key !== 'string' ||
      typeof row.tournament_count !== 'number' ||
      typeof row.entry_count !== 'number' ||
      typeof row.complete_deck_count !== 'number'
    ) {
      throw new Error('The region coverage response was invalid.')
    }
    return {
      regionKey: row.region_key,
      tournamentCount: row.tournament_count,
      entryCount: row.entry_count,
      completeDeckCount: row.complete_deck_count,
    }
  })
}

const SUMMARY_NUMBER_FIELDS = [
  'tournament_count', 'entry_count', 'topdeck_tournament_count',
  'edhtop16_tournament_count', 'topdeck_entry_count',
  'edhtop16_entry_count', 'tournament_with_location_count',
  'tournament_without_location_count', 'tournament_missing_date_count',
  'excluded_casual_event_count', 'structured_entry_count',
  'plaintext_entry_count', 'url_only_entry_count',
  'missing_decklist_entry_count', 'normalized_deck_count',
  'complete_deck_count', 'partial_deck_count', 'unavailable_deck_count',
  'invalid_deck_count', 'canonical_card_count', 'canonical_alias_count',
  'canonical_with_oracle_count', 'fallback_identity_count',
  'unresolved_card_row_count', 'tournament_card_count',
  'tournament_card_without_canonical_count', 'suspicious_alias_count',
  'commander_with_one_complete_count', 'commander_with_five_complete_count',
  'commander_with_twenty_complete_count', 'commander_with_fifty_complete_count',
  'commander_without_complete_count', 'paired_commander_sample_count',
  'regional_complete_deck_count',
  'possible_match_count', 'linked_event_count', 'pending_job_count',
  'running_job_count', 'failed_job_count', 'paused_job_count',
  'completed_job_count', 'stale_job_count',
] as const
const SUMMARY_DATE_FIELDS = [
  'first_event_date', 'latest_event_date',
  'last_successful_tournament_ingestion',
  'last_successful_deck_normalization',
] as const
const READINESS_NUMBER_FIELDS = [
  'complete_deck_count', 'partial_deck_count', 'unavailable_deck_count',
  'tournament_count', 'entry_count', 'country_count', 'state_region_count',
  'top16_sample_count', 'first_place_sample_count', 'regional_sample_count',
  'unresolved_card_rate', 'alias_mismatch_count',
  'one_sided_extraction_failure_count',
] as const
const READINESS_BOOLEAN_FIELDS = [
  'paired_commander', 'inclusion_ready', 'comparison_ready',
] as const
const UNRESOLVED_NUMBER_FIELDS = [
  'occurrence_count', 'affected_deck_count', 'affected_commander_count',
] as const

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
}

function throwRpcError(error: unknown) {
  if (!error) return
  console.warn('Data Health request failed.', error)
  throw new Error(
    isRecord(error) && typeof error.message === 'string' &&
      error.message.includes('Administrator access required')
      ? 'Administrator access required.'
      : 'Unable to load production data health.',
  )
}

function boundedLimit(value: number | undefined, fallback: number) {
  return Math.max(1, Math.min(value ?? fallback, 250))
}

function singleRecord(value: unknown, message: string) {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new Error(message)
  }
  return value[0]
}

function requireFields<
  Fields extends readonly string[],
>(
  row: Record<string, unknown>,
  fields: Fields,
  message: string,
): asserts row is Record<string, unknown> & Record<Fields[number], number> {
  if (!hasNumberFields(row, fields)) throw new Error(message)
}

function requireNullableStrings(
  row: Record<string, unknown>,
  fields: readonly string[],
  message: string,
): asserts row is Record<string, unknown> & Record<string, string | null> {
  if (!fields.every((field) => isNullableString(row[field]))) {
    throw new Error(message)
  }
}

function hasNumberFields<Fields extends readonly string[]>(
  row: Record<string, unknown>,
  fields: Fields,
): row is Record<string, unknown> & Record<Fields[number], number> {
  return fields.every((field) =>
    typeof row[field] === 'number' && Number.isFinite(row[field])
  )
}

function hasBooleanFields<Fields extends readonly string[]>(
  row: Record<string, unknown>,
  fields: Fields,
): row is Record<string, unknown> & Record<Fields[number], boolean> {
  return fields.every((field) => typeof row[field] === 'boolean')
}

function parseProviderBreakdown(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    throw new Error('The unresolved-card report was invalid.')
  }
  const result: Record<string, number> = {}
  for (const [provider, count] of Object.entries(value)) {
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      throw new Error('The unresolved-card report was invalid.')
    }
    result[provider] = count
  }
  return result
}

function optionalString(value: string | null): string | undefined {
  return value ?? undefined
}

function isSampleStatus(value: unknown): value is CommanderReadiness['sampleStatus'] {
  return ['unavailable', 'insufficient', 'limited', 'sufficient'].includes(
    String(value),
  )
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
