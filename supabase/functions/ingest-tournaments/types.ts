export type TournamentSource = 'edhtop16' | 'topdeck'

export interface ProviderTournament {
  sourceTournamentId: string
  name: string
  date: string | null
  playerCount: number | null
  url?: string
  sourceUpdatedAt?: string
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
  raw: unknown
}

export interface ProviderListOptions {
  startDate?: string
  endDate?: string
  minimumPlayers: number
  tournamentIds?: string[]
}

export interface TournamentProvider {
  source: TournamentSource
  listTournaments(options: ProviderListOptions): Promise<ProviderTournament[]>
  listEntries(tournament: ProviderTournament): Promise<ProviderTournamentEntry[]>
}

