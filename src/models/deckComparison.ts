import type { CommanderCardInclusion, TournamentSource } from './tournament';

/** Filters shared by aggregate inclusion and bounded tournament similarity. */
export interface DeckComparisonFilters {
  startDate?: string;
  endDate?: string;
  minimumTournamentSize?: number;
  maximumStanding?: number;
  minimumCompleteDecks?: number;
}

export type DeckComparisonCategory =
  | 'shared-core'
  | 'shared-common'
  | 'shared-flexible'
  | 'shared-rare'
  | 'absent-core'
  | 'absent-common'
  | 'absent-flexible'
  | 'user-uncommon'
  | 'unresolved';

export type DeckComparisonSampleStatus = 'sufficient' | 'limited' | 'insufficient' | 'unavailable';

/** One descriptive aggregate row combined with the user's mainboard presence. */
export interface DeckComparisonCard extends CommanderCardInclusion {
  identityKey: string;
  userQuantity: number;
  isInUserDeck: boolean;
  category: DeckComparisonCategory;
}

export interface DeckComparisonSummary {
  userDeckId: string;
  userDeckName: string;
  commanderKey: string;
  commanderName: string;
  totalEligibleDecks: number;
  userMainboardUniqueCards: number;
  aggregateUniqueCards: number;
  sharedCardCount: number;
  aggregateOverlapRate: number;
  unresolvedUserCardCount: number;
  sampleStatus: DeckComparisonSampleStatus;
  cards: DeckComparisonCard[];
  filters: DeckComparisonFilters;
}

/** Bounded server-side Jaccard result for one complete tournament mainboard. */
export interface TournamentDeckSimilarity {
  tournamentDeckId: string;
  tournamentName: string;
  pilotName?: string;
  standing?: number;
  eventDate?: string;
  regionKey?: string;
  sharedCardCount: number;
  unionCardCount: number;
  similarityRate: number;
  source: TournamentSource;
  sourceUrl?: string;
}
