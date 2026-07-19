import type {
  AssociationAnalysis,
  AssociationStrength,
  AssociationThresholds,
  CardAssociation,
} from '../models/cardAssociation'

export const DEFAULT_ASSOCIATION_THRESHOLDS: AssociationThresholds = {
  minimumSampleSize: 20,
  minimumOccurrenceCount: 3,
  minimumConfidence: 0.05,
  minimumLift: 1,
}

/**
 * Converts validated database statistics into presentation-neutral analysis.
 * The result stays descriptive: no label implies causation or recommends a
 * card for a personal Deck.
 */
export const cardAssociationService = {
  analyze(
    associations: CardAssociation[],
    thresholds: AssociationThresholds = DEFAULT_ASSOCIATION_THRESHOLDS,
  ): AssociationAnalysis[] {
    const significant = associations.filter(
      (association) => isStatisticallySignificant(association, thresholds),
    )
    const maximumRawScore = Math.max(
      0,
      ...significant.map(rawAssociationScore),
    )

    return significant.map((association) => ({
      ...association,
      strength: associationStrength(association),
      normalizedScore: maximumRawScore === 0
        ? 0
        : rawAssociationScore(association) / maximumRawScore,
      statisticallySignificant: true,
    }))
  },
}

export function isStatisticallySignificant(
  association: CardAssociation,
  thresholds: AssociationThresholds = DEFAULT_ASSOCIATION_THRESHOLDS,
): boolean {
  return association.sampleSize >= thresholds.minimumSampleSize
    && association.occurrenceCount >= thresholds.minimumOccurrenceCount
    && association.confidence >= thresholds.minimumConfidence
    && association.lift >= thresholds.minimumLift
}

export function associationStrength(
  association: CardAssociation,
): AssociationStrength {
  if (
    association.lift >= 1.5
    && association.confidence >= 0.5
    && association.deckCount >= 10
  ) return 'strong'
  if (
    association.lift >= 1.2
    && association.confidence >= 0.25
    && association.deckCount >= 5
  ) return 'moderate'
  return 'emerging'
}

function rawAssociationScore(association: CardAssociation): number {
  const reliability = Math.min(1, association.deckCount / 20)
  const boundedLift = Math.min(2, association.lift) / 2
  return association.support
    * association.confidence
    * boundedLift
    * reliability
}
