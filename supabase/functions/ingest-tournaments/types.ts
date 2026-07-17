export type TournamentSource = 'edhtop16' | 'topdeck'

export type LocationPrecision =
  | 'exact'
  | 'venue'
  | 'city'
  | 'state'
  | 'country'
  | 'online'
  | 'unknown'

export interface NormalizedTournamentLocation {
  venueName: string | null
  city: string | null
  stateRegion: string | null
  countryCode: string | null
  latitude: number | null
  longitude: number | null
  locationPrecision: LocationPrecision
  isOnline: boolean
  regionKey: string
  locationSource: string | null
  locationConfidence: 'high' | 'medium' | 'low' | null
}

export interface ProviderTournament {
  sourceTournamentId: string
  name: string
  date: string | null
  playerCount: number | null
  url?: string
  sourceUpdatedAt?: string
  location?: NormalizedTournamentLocation
  raw: unknown
}

export interface ProviderTournamentEntry {
  sourceEntryId?: string
  playerName?: string
  playerExternalId?: string
  commanderName: string
  colorIdentity: string[]
  standing?: number
  wins: number
  losses: number
  draws: number
  decklistUrl?: string
  commanderExtractionStatus?: 'extracted' | 'missing' | 'invalid'
  decklistAvailability?: 'structured' | 'plaintext' | 'url' | 'missing'
  raw: unknown
}

export interface ProviderListOptions {
  startDate?: string
  endDate?: string
  minimumPlayers: number
  maximumPlayers?: number
  tournamentIds?: string[]
  last?: number
  includeRounds?: boolean
  enrichLocation?: boolean
}

export interface TournamentProvider {
  source: TournamentSource
  listTournaments(options: ProviderListOptions): Promise<ProviderTournament[]>
  listEntries(tournament: ProviderTournament): Promise<ProviderTournamentEntry[]>
  getMetrics?(): ProviderRequestMetrics
}

export interface ProviderRequestMetrics {
  requestsMade: number
  retries: number
  rateLimitedRequests: number
  exhaustedRequests: number
}
