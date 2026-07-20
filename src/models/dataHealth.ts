import type { DeckComparisonSampleStatus } from './deckComparison'

/** Server-calculated production totals; no private user Deck data is included. */
export interface DataHealthSummary {
  tournamentCount: number
  entryCount: number
  topdeckTournamentCount: number
  edhtop16TournamentCount: number
  topdeckEntryCount: number
  edhtop16EntryCount: number
  firstEventDate?: string
  latestEventDate?: string
  tournamentWithLocationCount: number
  tournamentWithoutLocationCount: number
  tournamentMissingDateCount: number
  excludedCasualEventCount: number
  structuredEntryCount: number
  plaintextEntryCount: number
  urlOnlyEntryCount: number
  missingDecklistEntryCount: number
  normalizedDeckCount: number
  completeDeckCount: number
  partialDeckCount: number
  unavailableDeckCount: number
  invalidDeckCount: number
  canonicalCardCount: number
  canonicalAliasCount: number
  canonicalWithOracleCount: number
  fallbackIdentityCount: number
  unresolvedCardRowCount: number
  tournamentCardCount: number
  tournamentCardWithoutCanonicalCount: number
  suspiciousAliasCount: number
  commanderWithOneCompleteCount: number
  commanderWithFiveCompleteCount: number
  commanderWithTwentyCompleteCount: number
  commanderWithFiftyCompleteCount: number
  commanderWithoutCompleteCount: number
  pairedCommanderSampleCount: number
  regionalCompleteDeckCount: number
  possibleMatchCount: number
  linkedEventCount: number
  pendingJobCount: number
  runningJobCount: number
  failedJobCount: number
  pausedJobCount: number
  completedJobCount: number
  staleJobCount: number
  lastSuccessfulTournamentIngestion?: string
  lastSuccessfulDeckNormalization?: string
}

export interface CommanderReadiness {
  commanderKey: string
  commanderName: string
  completeDeckCount: number
  partialDeckCount: number
  unavailableDeckCount: number
  tournamentCount: number
  entryCount: number
  firstEventDate?: string
  latestEventDate?: string
  countryCount: number
  stateRegionCount: number
  pairedCommander: boolean
  inclusionReady: boolean
  comparisonReady: boolean
  sampleStatus: DeckComparisonSampleStatus
  top16SampleCount: number
  firstPlaceSampleCount: number
  regionalSampleCount: number
  unresolvedCardRate: number
  representativeDeckId?: string
  aliasMismatchCount: number
  oneSidedExtractionFailureCount: number
}

export interface UnresolvedCardHealth {
  normalizedName: string
  displayName: string
  occurrenceCount: number
  affectedDeckCount: number
  affectedCommanderCount: number
  firstSeenAt?: string
  lastSeenAt?: string
  sampleIssueCode: string
  providerBreakdown: Record<string, number>
  currentAliasMatch: boolean
}

export interface IngestionJobHealth {
  jobId: string
  provider: string
  jobStatus: string
  stage: string
  startDate: string
  endDate: string
  attempts: number
  updatedAt: string
  lastError?: string
  stale: boolean
}

export interface RegionCoverage {
  regionKey: string
  tournamentCount: number
  entryCount: number
  completeDeckCount: number
}

export interface DataHealthFilters {
  minimumCompleteDecks?: number
  sampleStatus?: DeckComparisonSampleStatus
  pairedOnly?: boolean
  provider?: 'topdeck' | 'edhtop16'
  startDate?: string
  endDate?: string
  readinessLimit?: number
  minimumOccurrences?: number
  issueCode?: string
  unresolvedLimit?: number
  jobStatus?: string
  jobStage?: string
  jobsUpdatedSince?: string
  jobLimit?: number
}

export type HealthCheckStatus = 'pass' | 'warning' | 'fail'

export interface HealthCheck {
  label: string
  status: HealthCheckStatus
  message: string
}

export interface DataHealthReport {
  summary: DataHealthSummary
  commanders: CommanderReadiness[]
  unresolvedCards: UnresolvedCardHealth[]
  jobs: IngestionJobHealth[]
  regions: RegionCoverage[]
  consistencyChecks: HealthCheck[]
}

export interface DataHealthSmokeTest {
  commanderKey: string
  checks: HealthCheck[]
  inclusionRows: number
  aggregateRows: number
  similarityRows: number
  inclusionSample: number
  aggregateSample: number
}
