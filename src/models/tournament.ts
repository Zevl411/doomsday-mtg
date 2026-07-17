/** Provider-neutral tournament records keep external API shapes out of Vue. */
export type TournamentSource = 'edhtop16' | 'topdeck'
export type LocationPrecision =
  | 'exact' | 'venue' | 'city' | 'state' | 'country'
  | 'online' | 'unknown'

export interface Tournament {
  id: string
  source: TournamentSource
  sourceTournamentId: string
  name: string
  date: string | null
  playerCount: number | null
  url?: string
  importedAt: string
  sourceUpdatedAt?: string
  entryCount?: number
  venueName?: string
  city?: string
  stateRegion?: string
  countryCode?: string
  locationPrecision?: LocationPrecision
  isOnline: boolean
  regionKey: string
}

export interface TournamentEntry {
  id: string
  tournamentId: string
  sourceEntryId?: string
  playerName?: string
  playerExternalId?: string
  commanderName: string
  commanderKey: string
  colorIdentity: string[]
  standing?: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  decklistUrl?: string
  tournamentName?: string
  tournamentDate?: string
  tournamentUrl?: string
  source?: TournamentSource
  createdAt: string
  updatedAt: string
}

export interface TournamentDeckCard {
  name: string
  oracleId: string | null
  typeLine: string
  manaCost: string
  imageUrl: string
}

export interface TournamentEntryDecklist {
  commanders: TournamentDeckCard[]
  cards: TournamentDeckCard[]
}

export interface CommanderMetagameStats {
  commanderKey: string
  commanderName: string
  colorIdentity: string[]
  entries: number
  tournaments: number
  wins: number
  losses: number
  draws: number
  matchWinRate: number
  top16Finishes: number
  topCutRate: number
  firstPlaceFinishes: number
  metaShare: number
}

export interface MetagameFilters {
  startDate?: string
  endDate?: string
  minimumPlayers?: number
  minimumEntries?: number
  topFinishThreshold?: number
  countryCode?: string
  stateRegion?: string
  regionKey?: string
  isOnline?: boolean
}

export interface RegionalMetagameStats {
  regionKey: string
  displayName: string
  tournaments: number
  entries: number
  uniqueCommanders: number
  topCommander: string | null
  topCommanderEntries: number
  averageTournamentSize: number
}
