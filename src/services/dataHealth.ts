import type {
  CommanderReadiness,
  DataHealthSummary,
  HealthCheck,
} from '../models/dataHealth'
import { getAnalyticsSampleStatus } from '../utils/sampleStatus'

export function getNormalizationCompletionRate(
  summary: DataHealthSummary,
): number {
  return summary.normalizedDeckCount === 0
    ? 0
    : summary.completeDeckCount / summary.normalizedDeckCount
}

export function getUnresolvedCardRate(summary: DataHealthSummary): number {
  return summary.tournamentCardCount === 0
    ? 0
    : summary.unresolvedCardRowCount / summary.tournamentCardCount
}

/** Impossible aggregate relationships are visible warnings, never hidden. */
export function checkDataHealthConsistency(
  summary: DataHealthSummary,
  commanders: CommanderReadiness[],
): HealthCheck[] {
  const checks: HealthCheck[] = []
  const classifiedDecks =
    summary.completeDeckCount +
    summary.partialDeckCount +
    summary.unavailableDeckCount +
    summary.invalidDeckCount
  checks.push(check(
    'Normalized Deck status totals',
    classifiedDecks <= summary.normalizedDeckCount,
    `${classifiedDecks} classified of ${summary.normalizedDeckCount} normalized Decks.`,
  ))
  checks.push(check(
    'Canonical card references',
    summary.tournamentCardWithoutCanonicalCount <= summary.tournamentCardCount,
    `${summary.tournamentCardWithoutCanonicalCount} of ${summary.tournamentCardCount} card rows lack canonical identity.`,
  ))
  for (const commander of commanders) {
    const ordered =
      commander.firstPlaceSampleCount <= commander.top16SampleCount &&
      commander.top16SampleCount <= commander.completeDeckCount
    if (!ordered) {
      checks.push({
        label: commander.commanderName,
        status: 'warning',
        message:
          'First-place, Top-16, and complete sample counts are inconsistent.',
      })
    }
    if (
      commander.sampleStatus !==
      getAnalyticsSampleStatus(commander.completeDeckCount)
    ) {
      checks.push({
        label: commander.commanderName,
        status: 'warning',
        message: 'The server and client sample classifications disagree.',
      })
    }
  }
  return checks
}

export function checkComparisonSamples(
  inclusionSample: number,
  aggregateSample: number,
  similarityRows: number,
  top16Sample: number,
  firstPlaceSample: number,
): HealthCheck[] {
  return [
    check(
      'Inclusion and aggregate sample',
      inclusionSample === aggregateSample,
      `${inclusionSample} inclusion Decks and ${aggregateSample} aggregate Decks.`,
    ),
    check(
      'Similarity sample bound',
      similarityRows <= aggregateSample,
      `${similarityRows} similarity rows from ${aggregateSample} eligible Decks.`,
    ),
    check(
      'Placement sample order',
      firstPlaceSample <= top16Sample && top16Sample <= aggregateSample,
      `${firstPlaceSample} first-place, ${top16Sample} Top-16, ${aggregateSample} total.`,
    ),
  ]
}

function check(
  label: string,
  passed: boolean,
  message: string,
): HealthCheck {
  return {
    label,
    status: passed ? 'pass' : 'warning',
    message,
  }
}
