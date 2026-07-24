/** Provider-neutral tournament records keep external API shapes out of Vue. */
export type TournamentSource = 'edhtop16' | 'topdeck';
export type LocationPrecision =
  'exact' | 'venue' | 'city' | 'state' | 'country' | 'online' | 'unknown';

export interface Tournament {
  id: string;
  source: TournamentSource;
  sourceTournamentId: string;
  name: string;
  date: string | null;
  playerCount: number | null;
  url?: string;
  importedAt: string;
  sourceUpdatedAt?: string;
  entryCount?: number;
  // This excludes placeholder entries whose Commander could not be resolved.
  registeredCommanderCount?: number;
  commanderRegistrationRate?: number;
  venueName?: string;
  city?: string;
  stateRegion?: string;
  countryCode?: string;
  locationPrecision?: LocationPrecision;
  isOnline: boolean;
  regionKey: string;
}

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  sourceEntryId?: string;
  playerName?: string;
  playerExternalId?: string;
  commanderName: string;
  commanderKey: string;
  colorIdentity: string[];
  standing?: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  decklistUrl?: string;
  tournamentName?: string;
  tournamentDate?: string;
  tournamentUrl?: string;
  source?: TournamentSource;
  createdAt: string;
  updatedAt: string;
  tournamentDeckId?: string;
}

export interface TournamentDeckCard {
  name: string;
  quantity: number;
  oracleId: string | null;
  typeLine: string;
  manaCost: string;
  manaValue: number | null;
  imageUrl: string;
  backImageUrl?: string;
  colorIdentity?: string[];
}

export interface TournamentEntryDecklist {
  commanders: TournamentDeckCard[];
  cards: TournamentDeckCard[];
}

export interface CommanderMetagameStats {
  commanderKey: string;
  commanderName: string;
  colorIdentity: string[];
  imageUrls?: string[];
  entries: number;
  tournaments: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinRate: number;
  top16Finishes: number;
  topCutRate: number;
  firstPlaceFinishes: number;
  metaShare: number;
}

export interface MetagameFilters {
  startDate?: string;
  endDate?: string;
  minimumPlayers?: number;
  maximumPlayers?: number;
  minimumEntries?: number;
  topFinishThreshold?: number;
  tournamentSort?: 'date' | 'player-count';
  sortAscending?: boolean;
}

export interface RegionalMetagameStats {
  regionKey: string;
  displayName: string;
  tournaments: number;
  entries: number;
  uniqueCommanders: number;
  topCommander: string | null;
  topCommanderEntries: number;
  averageTournamentSize: number;
}

export type TournamentDeckBoard =
  'commander' | 'mainboard' | 'sideboard' | 'maybeboard' | 'considering' | 'companion' | 'unknown';
export type TournamentDeckParsingStatus =
  'complete' | 'partial' | 'unavailable' | 'invalid' | 'pending';

export interface NormalizedTournamentDeckCard {
  id: string;
  board: TournamentDeckBoard;
  oracleId?: string;
  scryfallId?: string;
  normalizedCardKey: string;
  cardName: string;
  quantity: number;
  typeLine?: string;
  colorIdentity: string[];
  colors: string[];
  manaValue?: number;
  isBasicLand: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NormalizedTournamentDeck {
  id: string;
  tournamentEntryId: string;
  source: TournamentSource;
  sourceDeckId?: string;
  commanderKey: string;
  commanderName: string;
  mainboardCardCount?: number;
  sideboardCardCount?: number;
  parsingStatus: TournamentDeckParsingStatus;
  parsingIssues: Array<{ code: string; message: string }>;
  rawDecklistAvailable: boolean;
  structuredDeckAvailable: boolean;
  importedAt: string;
  updatedAt: string;
  cards: NormalizedTournamentDeckCard[];
  entry: TournamentEntry;
  tournament: Tournament;
}

export interface CommanderCardInclusion {
  normalizedCardKey: string;
  oracleId?: string;
  cardName: string;
  typeLine?: string;
  colorIdentity: string[];
  manaValue?: number;
  imageUrl?: string;
  backImageUrl?: string;
  deckCount: number;
  totalEligibleDecks: number;
  inclusionRate: number;
  averageQuantity: number;
  top16DeckCount: number;
  top16InclusionRate: number;
  firstPlaceDeckCount: number;
  firstPlaceInclusionRate: number;
}

export type CardInclusionPeriod = 'day' | 'week' | 'month' | 'year';

export interface CardInclusionHistoryPoint {
  periodStart: string;
  deckCount: number;
  totalEligibleDecks: number;
  eventCount: number;
  cardEventCount: number;
  inclusionRate: number;
  eventInclusionRate: number;
}

export interface CardInclusionFilters extends MetagameFilters {
  maximumStanding?: number;
  minimumCompleteDecks?: number;
}
