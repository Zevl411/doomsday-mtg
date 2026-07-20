/** One complete normalized Commander Deck matching all selected card filters. */
export interface CommanderDeckEvent {
  tournamentEntryId: string
  tournamentId: string
  tournamentDeckId: string
  tournamentName: string
  eventDate: string | null
  playerName: string | null
  standing: number | null
  wins: number
  losses: number
  draws: number
}
