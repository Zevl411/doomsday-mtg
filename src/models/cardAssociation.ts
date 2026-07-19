export interface CardAssociationFilters {
  startDate?: string
  endDate?: string
  regionKey?: string
  minimumTournamentSize?: number
  maximumStanding?: number
  minimumSampleSize?: number
  minimumOccurrenceCount?: number
  minimumConfidence?: number
  minimumLift?: number
  limit?: number
}

export interface CardAssociation {
  commanderKey: string
  sourceOracleId: string
  sourceCardName: string
  associatedOracleId: string
  associatedCardName: string
  support: number
  confidence: number
  lift: number
  occurrenceCount: number
  deckCount: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  sampleSize: number
}

export type AssociationStrength = 'strong' | 'moderate' | 'emerging'

export interface AssociationAnalysis extends CardAssociation {
  strength: AssociationStrength
  normalizedScore: number
  statisticallySignificant: boolean
}

export interface AssociationThresholds {
  minimumSampleSize: number
  minimumOccurrenceCount: number
  minimumConfidence: number
  minimumLift: number
}

export interface CardAssociationCluster {
  clusterId: string
  memberOracleIds: string[]
  connectionCount: number
  averageLift: number
  sampleSize: number
}
