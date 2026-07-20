import type { ScryfallCard } from '../types/card'

/** Filters reuse the v0.4 association sample and threshold definitions. */
export interface AssociationSuggestionFilters {
  startDate?: string
  endDate?: string
  regionKey?: string
  minimumTournamentSize?: number
  maximumStanding?: number
  minimumSampleSize?: number
  minimumOccurrenceCount?: number
  minimumConfidence?: number
  minimumLift?: number
  minimumSupportingCards?: number
  limit?: number
}

/** One source-card relationship supporting an observed suggestion. */
export interface AssociationSuggestionEvidence {
  sourceOracleId: string
  sourceCardName: string
  support: number
  confidence: number
  lift: number
  jointDeckCount: number
  sourceDeckCount: number
  sampleSize: number
}

/**
 * A suggestion is an evidence bundle, not a claim about Deck needs, strategy,
 * card quality, or expected performance.
 */
export interface AssociationBasedSuggestion {
  suggestedOracleId: string
  suggestedCardName: string
  suggestedCard: ScryfallCard | null
  supportingCardCount: number
  evidence: AssociationSuggestionEvidence[]
  aggregateScore: number
  sampleSize: number
  commanderKey: string
}

/** Validated database row before evidence is grouped by suggested card. */
export interface AssociationSuggestionRow
  extends AssociationSuggestionEvidence {
  suggestedOracleId: string
  suggestedCardName: string
  commanderKey: string
  occurrenceCount: number
}
