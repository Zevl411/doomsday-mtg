import type { DeckComparisonSampleStatus } from '../models/deckComparison';

// These descriptive thresholds are shared by comparison and Data Health.
export const COMPARISON_READY_DECKS = 5;
export const SUFFICIENT_SAMPLE_DECKS = 20;

export function getAnalyticsSampleStatus(completeDeckCount: number): DeckComparisonSampleStatus {
  if (completeDeckCount >= SUFFICIENT_SAMPLE_DECKS) return 'sufficient';
  if (completeDeckCount >= COMPARISON_READY_DECKS) return 'limited';
  if (completeDeckCount >= 1) return 'insufficient';
  return 'unavailable';
}
