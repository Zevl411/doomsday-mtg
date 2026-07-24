import type {
  AssociationBasedSuggestion,
  AssociationSuggestionFilters,
  AssociationSuggestionRow,
} from '../models/associationSuggestion';
import type { ScryfallCard } from '../types/card';

/**
 * Groups measurable association rows without inferring strategy or card value.
 * Scores exist only to order evidence bundles within the same filtered sample.
 */
export const associationSuggestionService = {
  buildSuggestions(
    rows: AssociationSuggestionRow[],
    ownedOracleIds: string[],
    filters: AssociationSuggestionFilters = {},
  ): AssociationBasedSuggestion[] {
    const owned = new Set(ownedOracleIds.map((value) => value.toLowerCase()));
    const minimumSupportingCards = Math.max(1, filters.minimumSupportingCards ?? 2);
    const grouped = new Map<string, AssociationSuggestionRow[]>();

    for (const row of rows) {
      const candidateKey = row.suggestedOracleId.toLowerCase();
      if (owned.has(candidateKey)) continue;
      const candidateRows = grouped.get(candidateKey) ?? [];
      // One source card should contribute at most one evidence row.
      const existingIndex = candidateRows.findIndex(
        (item) => item.sourceOracleId === row.sourceOracleId,
      );
      if (existingIndex === -1) candidateRows.push(row);
      else if (evidenceScore(row) > evidenceScore(candidateRows[existingIndex]!))
        candidateRows[existingIndex] = row;
      grouped.set(candidateKey, candidateRows);
    }

    const unnormalized = [...grouped.values()]
      .filter((evidence) => evidence.length >= minimumSupportingCards)
      .map((evidence) => {
        evidence.sort(
          (left, right) =>
            evidenceScore(right) - evidenceScore(left) ||
            right.jointDeckCount - left.jointDeckCount ||
            left.sourceCardName.localeCompare(right.sourceCardName),
        );
        const first = evidence[0]!;
        return {
          suggestedOracleId: first.suggestedOracleId,
          suggestedCardName: first.suggestedCardName,
          suggestedCard: null,
          supportingCardCount: evidence.length,
          evidence: evidence.map((item) => ({
            sourceOracleId: item.sourceOracleId,
            sourceCardName: item.sourceCardName,
            support: item.support,
            confidence: item.confidence,
            lift: item.lift,
            jointDeckCount: item.jointDeckCount,
            sourceDeckCount: item.sourceDeckCount,
            sampleSize: item.sampleSize,
          })),
          aggregateScore: evidence.reduce((total, item) => total + evidenceScore(item), 0),
          sampleSize: first.sampleSize,
          commanderKey: first.commanderKey,
        } satisfies AssociationBasedSuggestion;
      })
      .sort(
        (left, right) =>
          right.aggregateScore - left.aggregateScore ||
          right.supportingCardCount - left.supportingCardCount ||
          left.suggestedCardName.localeCompare(right.suggestedCardName),
      );

    const maximumScore = Math.max(
      0,
      ...unnormalized.map((suggestion) => suggestion.aggregateScore),
    );
    return unnormalized.slice(0, Math.max(1, filters.limit ?? 30)).map((suggestion) => ({
      ...suggestion,
      aggregateScore: maximumScore === 0 ? 0 : suggestion.aggregateScore / maximumScore,
    }));
  },

  attachCards(
    suggestions: AssociationBasedSuggestion[],
    cards: ScryfallCard[],
  ): AssociationBasedSuggestion[] {
    const byOracleId = new Map(
      cards
        .filter((card): card is ScryfallCard & { oracle_id: string } => Boolean(card.oracle_id))
        .map((card) => [card.oracle_id.toLowerCase(), card]),
    );
    return suggestions.map((suggestion) => ({
      ...suggestion,
      suggestedCard: byOracleId.get(suggestion.suggestedOracleId.toLowerCase()) ?? null,
    }));
  },
};

/** Exact evidence copy is deliberately formulaic rather than strategic. */
export function formatSuggestionEvidence(
  sourceCardName: string,
  jointDeckCount: number,
  sourceDeckCount: number,
): string {
  return `Among ${sourceDeckCount} eligible tournament Decks containing ${sourceCardName}, ${jointDeckCount} also contained this card.`;
}

function evidenceScore(row: AssociationSuggestionRow): number {
  const boundedLift = Math.min(3, row.lift) / 3;
  const observedReliability = Math.min(1, row.jointDeckCount / 10);
  return row.confidence * boundedLift * observedReliability;
}
