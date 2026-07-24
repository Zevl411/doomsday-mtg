import { describe, expect, it } from 'vitest';

import {
  checkComparisonSamples,
  checkDataHealthConsistency,
  getNormalizationCompletionRate,
  getUnresolvedCardRate,
} from './dataHealth';

import type { CommanderReadiness, DataHealthSummary } from '../models/dataHealth';

const summary = (overrides: Partial<DataHealthSummary> = {}): DataHealthSummary => ({
  tournamentCount: 2,
  entryCount: 20,
  topdeckTournamentCount: 1,
  edhtop16TournamentCount: 1,
  topdeckEntryCount: 10,
  edhtop16EntryCount: 10,
  tournamentWithLocationCount: 1,
  tournamentWithoutLocationCount: 1,
  tournamentMissingDateCount: 0,
  excludedCasualEventCount: 1,
  structuredEntryCount: 10,
  plaintextEntryCount: 5,
  urlOnlyEntryCount: 3,
  missingDecklistEntryCount: 2,
  normalizedDeckCount: 10,
  completeDeckCount: 6,
  partialDeckCount: 2,
  unavailableDeckCount: 1,
  invalidDeckCount: 1,
  canonicalCardCount: 100,
  canonicalAliasCount: 110,
  canonicalWithOracleCount: 95,
  fallbackIdentityCount: 5,
  unresolvedCardRowCount: 2,
  tournamentCardCount: 100,
  tournamentCardWithoutCanonicalCount: 2,
  suspiciousAliasCount: 0,
  commanderWithOneCompleteCount: 1,
  commanderWithFiveCompleteCount: 1,
  commanderWithTwentyCompleteCount: 1,
  commanderWithFiftyCompleteCount: 0,
  commanderWithoutCompleteCount: 0,
  pairedCommanderSampleCount: 0,
  regionalCompleteDeckCount: 6,
  possibleMatchCount: 1,
  linkedEventCount: 1,
  pendingJobCount: 0,
  runningJobCount: 1,
  failedJobCount: 0,
  pausedJobCount: 0,
  completedJobCount: 4,
  staleJobCount: 0,
  ...overrides,
});

const commander = (overrides: Partial<CommanderReadiness> = {}): CommanderReadiness => ({
  commanderKey: 'kinnan, bonder prodigy',
  commanderName: 'Kinnan, Bonder Prodigy',
  completeDeckCount: 20,
  partialDeckCount: 0,
  unavailableDeckCount: 0,
  tournamentCount: 2,
  entryCount: 20,
  countryCount: 1,
  stateRegionCount: 1,
  pairedCommander: false,
  inclusionReady: true,
  comparisonReady: true,
  sampleStatus: 'sufficient',
  top16SampleCount: 10,
  firstPlaceSampleCount: 1,
  regionalSampleCount: 20,
  unresolvedCardRate: 0,
  aliasMismatchCount: 0,
  oneSidedExtractionFailureCount: 0,
  ...overrides,
});

describe('data health service', () => {
  it('calculates rates from validated counts and handles empty totals', () => {
    expect(getNormalizationCompletionRate(summary())).toBe(0.6);
    expect(getUnresolvedCardRate(summary())).toBe(0.02);
    expect(getNormalizationCompletionRate(summary({ normalizedDeckCount: 0 }))).toBe(0);
    expect(getUnresolvedCardRate(summary({ tournamentCardCount: 0 }))).toBe(0);
  });

  it('surfaces impossible aggregate and Commander relationships', () => {
    const checks = checkDataHealthConsistency(
      summary({
        normalizedDeckCount: 1,
        tournamentCardCount: 1,
        tournamentCardWithoutCanonicalCount: 2,
      }),
      [
        commander({
          sampleStatus: 'limited',
          top16SampleCount: 21,
          firstPlaceSampleCount: 22,
        }),
      ],
    );
    expect(checks.filter((check) => check.status === 'warning')).toHaveLength(4);
  });

  it('checks equivalent RPC sample sizes and bounded result ordering', () => {
    expect(checkComparisonSamples(5, 5, 5, 3, 1).every((check) => check.status === 'pass')).toBe(
      true,
    );
    expect(
      checkComparisonSamples(4, 5, 6, 3, 4).filter((check) => check.status === 'warning'),
    ).toHaveLength(3);
  });
});
