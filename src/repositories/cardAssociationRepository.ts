import { supabase } from '../lib/supabase'
import type {
  CardAssociation,
  CardAssociationCluster,
  CardAssociationFilters,
} from '../models/cardAssociation'

export const cardAssociationRepository = {
  async getAssociations(
    commanderKey: string,
    sourceOracleId: string,
    filters: CardAssociationFilters = {},
  ): Promise<CardAssociation[]> {
    requireSupabase()
    const { data, error } = await supabase!.rpc(
      'get_commander_card_associations',
      {
        p_commander_key: commanderKey,
        p_source_oracle_id: sourceOracleId,
        p_start_date: filters.startDate ?? null,
        p_end_date: filters.endDate ?? null,
        p_region_key: filters.regionKey ?? null,
        p_minimum_tournament_size:
          nonNegativeInteger(filters.minimumTournamentSize, 0),
        p_maximum_standing:
          optionalPositiveInteger(filters.maximumStanding),
        p_minimum_sample_size:
          positiveInteger(filters.minimumSampleSize, 20),
        p_minimum_occurrence_count:
          positiveInteger(filters.minimumOccurrenceCount, 3),
        p_minimum_confidence:
          nonNegativeNumber(filters.minimumConfidence, 0),
        p_minimum_lift: nonNegativeNumber(filters.minimumLift, 0),
        p_limit: boundedInteger(filters.limit, 100, 1, 250),
      },
    )
    if (error) {
      console.warn('Card association RPC failed', error)
      throw new Error('Unable to load observed card associations.')
    }
    return parseCardAssociationRows(data)
  },

  async getClusters(
    commanderKey: string,
    filters: {
      minimumDeckCount?: number
      minimumConfidence?: number
      minimumLift?: number
      limit?: number
    } = {},
  ): Promise<CardAssociationCluster[]> {
    requireSupabase()
    const { data, error } = await supabase!.rpc(
      'get_commander_card_association_clusters',
      {
        p_commander_key: commanderKey,
        p_minimum_deck_count:
          positiveInteger(filters.minimumDeckCount, 5),
        p_minimum_confidence:
          nonNegativeNumber(filters.minimumConfidence, 0.2),
        p_minimum_lift: nonNegativeNumber(filters.minimumLift, 1.1),
        p_limit: boundedInteger(filters.limit, 25, 1, 100),
      },
    )
    if (error) {
      console.warn('Card association cluster RPC failed', error)
      throw new Error('Unable to load card association clusters.')
    }
    return parseCardAssociationClusterRows(data)
  },
}

export function parseCardAssociationRows(value: unknown): CardAssociation[] {
  if (!Array.isArray(value)) throw invalidResponse()
  return value.map((row) => {
    if (
      !isRecord(row)
      || !isString(row.commander_key)
      || !isUuid(row.source_oracle_id)
      || !isString(row.source_card_name)
      || !isUuid(row.associated_oracle_id)
      || !isString(row.associated_card_name)
      || !isRate(row.support)
      || !isRate(row.confidence)
      || !isNonNegativeNumber(row.lift)
      || !isNonNegativeInteger(row.occurrence_count)
      || !isNonNegativeInteger(row.deck_count)
      || !isNullableDate(row.first_seen_at)
      || !isNullableDate(row.last_seen_at)
      || !isNonNegativeInteger(row.sample_size)
      || row.deck_count > row.sample_size
    ) {
      throw invalidResponse()
    }

    return {
      commanderKey: row.commander_key,
      sourceOracleId: row.source_oracle_id,
      sourceCardName: row.source_card_name,
      associatedOracleId: row.associated_oracle_id,
      associatedCardName: row.associated_card_name,
      support: row.support,
      confidence: row.confidence,
      lift: row.lift,
      occurrenceCount: row.occurrence_count,
      deckCount: row.deck_count,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      sampleSize: row.sample_size,
    }
  })
}

export function parseCardAssociationClusterRows(
  value: unknown,
): CardAssociationCluster[] {
  if (!Array.isArray(value)) throw invalidClusterResponse()
  return value.map((row) => {
    if (
      !isRecord(row)
      || !isUuid(row.cluster_id)
      || !Array.isArray(row.member_oracle_ids)
      || !row.member_oracle_ids.every(isUuid)
      || row.member_oracle_ids.length < 3
      || !isNonNegativeInteger(row.connection_count)
      || !isNonNegativeNumber(row.average_lift)
      || !isNonNegativeInteger(row.sample_size)
    ) {
      throw invalidClusterResponse()
    }
    return {
      clusterId: row.cluster_id,
      memberOracleIds: [...new Set(row.member_oracle_ids)],
      connectionCount: row.connection_count,
      averageLift: row.average_lift,
      sampleSize: row.sample_size,
    }
  })
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
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

function isNullableDate(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
}

function nonNegativeInteger(value: number | undefined, fallback: number) {
  return isNonNegativeInteger(value) ? value : fallback
}

function positiveInteger(value: number | undefined, fallback: number) {
  return isNonNegativeInteger(value) && value > 0 ? value : fallback
}

function optionalPositiveInteger(value: number | undefined) {
  return isNonNegativeInteger(value) && value > 0 ? value : null
}

function nonNegativeNumber(value: number | undefined, fallback: number) {
  return isNonNegativeNumber(value) ? value : fallback
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
  return new Error('Card association response was invalid.')
}

function invalidClusterResponse() {
  return new Error('Card association cluster response was invalid.')
}
