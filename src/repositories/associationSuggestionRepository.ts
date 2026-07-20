import { supabase } from '../lib/supabase'
import type {
  AssociationSuggestionFilters,
  AssociationSuggestionRow,
} from '../models/associationSuggestion'

/**
 * Loads one validated evidence matrix for all Oracle-backed mainboard cards.
 * A single batched RPC avoids one network request and SQL scan per Deck card.
 */
export const associationSuggestionRepository = {
  async getSuggestionEvidence(
    commanderKey: string,
    sourceOracleIds: string[],
    filters: AssociationSuggestionFilters = {},
  ): Promise<AssociationSuggestionRow[]> {
    if (!supabase) {
      throw new Error(
        'Association-based card suggestions are unavailable because Supabase is not configured.',
      )
    }

    const uniqueSourceIds = [...new Set(
      sourceOracleIds.filter((value) => isUuid(value)),
    )]
    if (!uniqueSourceIds.length) return []

    const { data, error } = await supabase.rpc(
      'get_association_based_card_suggestions',
      {
        p_commander_key: commanderKey,
        p_source_oracle_ids: uniqueSourceIds,
        p_start_date: filters.startDate ?? null,
        p_end_date: filters.endDate ?? null,
        p_region_key: null,
        p_minimum_tournament_size:
          nonNegativeInteger(filters.minimumTournamentSize, 0),
        p_maximum_standing:
          optionalPositiveInteger(filters.maximumStanding),
        p_minimum_sample_size:
          positiveInteger(filters.minimumSampleSize, 20),
        p_minimum_occurrence_count:
          positiveInteger(filters.minimumOccurrenceCount, 3),
        p_minimum_confidence: rateNumber(filters.minimumConfidence, 0.05),
        p_minimum_lift: nonNegativeNumber(filters.minimumLift, 1),
        p_minimum_supporting_cards:
          positiveInteger(filters.minimumSupportingCards, 2),
        p_limit: boundedInteger(filters.limit, 30, 1, 100),
      },
    )
    if (error) {
      console.warn('Association suggestion RPC failed', error)
      throw new Error('Unable to load association-based card suggestions.')
    }
    const rows = parseAssociationSuggestionRows(data)
    const sourceSet = new Set(uniqueSourceIds)
    const responseSampleSize = rows[0]?.sampleSize
    if (rows.some((row) =>
      row.commanderKey !== commanderKey
      || !sourceSet.has(row.sourceOracleId)
      || sourceSet.has(row.suggestedOracleId)
      || row.sampleSize !== responseSampleSize
    )) {
      throw invalidResponse()
    }
    return rows
  },
}

/** Rejects malformed successful responses before they reach domain services. */
export function parseAssociationSuggestionRows(
  value: unknown,
): AssociationSuggestionRow[] {
  if (!Array.isArray(value)) throw invalidResponse()
  return value.map((row) => {
    if (
      !isRecord(row)
      || !isString(row.commander_key)
      || !isUuid(row.source_oracle_id)
      || !isString(row.source_card_name)
      || !isUuid(row.suggested_oracle_id)
      || !isString(row.suggested_card_name)
      || !isRate(row.support)
      || !isRate(row.confidence)
      || !isNonNegativeNumber(row.lift)
      || !isNonNegativeInteger(row.occurrence_count)
      || !isNonNegativeInteger(row.joint_deck_count)
      || !isPositiveInteger(row.source_deck_count)
      || !isPositiveInteger(row.sample_size)
      || row.joint_deck_count > row.source_deck_count
      || row.source_deck_count > row.sample_size
      || row.source_oracle_id === row.suggested_oracle_id
    ) {
      throw invalidResponse()
    }
    return {
      commanderKey: row.commander_key,
      sourceOracleId: row.source_oracle_id,
      sourceCardName: row.source_card_name,
      suggestedOracleId: row.suggested_oracle_id,
      suggestedCardName: row.suggested_card_name,
      support: row.support,
      confidence: row.confidence,
      lift: row.lift,
      occurrenceCount: row.occurrence_count,
      jointDeckCount: row.joint_deck_count,
      sourceDeckCount: row.source_deck_count,
      sampleSize: row.sample_size,
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isRate(value: unknown): value is number {
  return isNonNegativeNumber(value) && value <= 1
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value)
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0
}

function nonNegativeInteger(value: number | undefined, fallback: number) {
  return isNonNegativeInteger(value) ? value : fallback
}

function positiveInteger(value: number | undefined, fallback: number) {
  return isPositiveInteger(value) ? value : fallback
}

function optionalPositiveInteger(value: number | undefined) {
  return isPositiveInteger(value) ? value : null
}

function nonNegativeNumber(value: number | undefined, fallback: number) {
  return isNonNegativeNumber(value) ? value : fallback
}

function rateNumber(value: number | undefined, fallback: number) {
  return isRate(value) ? value : fallback
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback
  return Math.max(minimum, Math.min(value, maximum))
}

function invalidResponse() {
  return new Error('Association suggestion response was invalid.')
}
