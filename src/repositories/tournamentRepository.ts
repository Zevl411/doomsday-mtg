import { supabase } from '../lib/supabase'
import type {
  CommanderMetagameStats,
  MetagameFilters,
  Tournament,
  TournamentEntry,
} from '../models/tournament'

export interface TournamentDetail {
  tournament: Tournament
  entries: TournamentEntry[]
}

export interface CommanderDetail {
  stats: CommanderMetagameStats | null
  entries: TournamentEntry[]
}

const metagameCache = new Map<string, CommanderMetagameStats[]>()

/** Queries only normalized public tables and shields views from Supabase rows. */
export const tournamentRepository = {
  async getCommanderMetagame(
    filters: MetagameFilters = {},
  ): Promise<CommanderMetagameStats[]> {
    requireSupabase()
    const normalized = normalizeFilters(filters)
    const cacheKey = JSON.stringify(normalized)
    const cached = metagameCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase!.rpc('get_commander_metagame', {
      start_date: normalized.startDate ?? null,
      end_date: normalized.endDate ?? null,
      minimum_players: normalized.minimumPlayers,
      minimum_entries: normalized.minimumEntries,
      top_finish_threshold: normalized.topFinishThreshold,
    })
    if (error) throw friendlyError('load Commander metagame', error)

    const result = ((data ?? []) as MetagameRow[]).map(mapMetagameRow)
    metagameCache.set(cacheKey, result)
    return result
  },

  async getCommanderDetails(
    commanderKey: string,
    filters: MetagameFilters = {},
  ): Promise<CommanderDetail> {
    requireSupabase()
    const stats = await this.getCommanderMetagame({
      ...filters,
      minimumEntries: 1,
    })
    let query = supabase!
      .from('tournament_entries')
      .select('*, tournaments!inner(*)')
      .eq('commander_key', commanderKey)
      .order('event_date', { referencedTable: 'tournaments', ascending: false })
      .limit(100)
    if (filters.startDate) {
      query = query.gte('tournaments.event_date', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('tournaments.event_date', filters.endDate)
    }
    if (filters.minimumPlayers) {
      query = query.gte('tournaments.player_count', filters.minimumPlayers)
    }
    const { data, error } = await query
    if (error) throw friendlyError('load Commander details', error)

    return {
      stats: stats.find((item) => item.commanderKey === commanderKey) ?? null,
      entries: ((data ?? []) as EntryRow[]).map(mapEntryRow),
    }
  },

  async getRecentTournaments(
    filters: MetagameFilters = {},
  ): Promise<Tournament[]> {
    requireSupabase()
    let query = supabase!
      .from('tournaments')
      .select('*, tournament_entries(count)')
      .order('event_date', { ascending: false })
      .limit(100)
    if (filters.startDate) query = query.gte('event_date', filters.startDate)
    if (filters.endDate) query = query.lte('event_date', filters.endDate)
    if (filters.minimumPlayers) {
      query = query.gte('player_count', filters.minimumPlayers)
    }
    const { data, error } = await query
    if (error) throw friendlyError('load tournaments', error)
    return ((data ?? []) as TournamentRow[]).map(mapTournamentRow)
  },

  async getTournament(tournamentId: string): Promise<TournamentDetail | null> {
    requireSupabase()
    const [tournamentResult, entriesResult] = await Promise.all([
      supabase!.from('tournaments').select('*').eq('id', tournamentId).maybeSingle(),
      supabase!
        .from('tournament_entries')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('standing', { ascending: true }),
    ])
    if (tournamentResult.error) {
      throw friendlyError('load tournament', tournamentResult.error)
    }
    if (entriesResult.error) {
      throw friendlyError('load tournament entries', entriesResult.error)
    }
    if (!tournamentResult.data) return null

    return {
      tournament: mapTournamentRow(tournamentResult.data as TournamentRow),
      entries: ((entriesResult.data ?? []) as EntryRow[]).map(mapEntryRow),
    }
  },

  clearCache() {
    metagameCache.clear()
  },
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Tournament data is unavailable because Supabase is not configured.')
  }
}

function normalizeFilters(filters: MetagameFilters) {
  return {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    minimumPlayers: Math.max(0, filters.minimumPlayers ?? 0),
    minimumEntries: Math.max(1, filters.minimumEntries ?? 1),
    topFinishThreshold: Math.max(1, filters.topFinishThreshold ?? 16),
  }
}

interface MetagameRow {
  commander_key: string
  commander_name: string
  color_identity: string[]
  entries: number
  tournaments: number
  wins: number
  losses: number
  draws: number
  match_win_rate: number
  top16_finishes: number
  top_cut_rate: number
  first_place_finishes: number
  meta_share: number
}

interface TournamentRow {
  id: string
  source: 'edhtop16' | 'topdeck'
  source_tournament_id: string
  name: string
  event_date: string | null
  player_count: number | null
  source_url?: string
  imported_at: string
  source_updated_at?: string
  tournament_entries?: Array<{ count: number }>
}

interface EntryRow {
  id: string
  tournament_id: string
  source_entry_id?: string
  player_name?: string
  player_external_id?: string
  commander_name: string
  commander_key: string
  color_identity?: string[]
  standing?: number
  wins: number
  losses: number
  draws: number
  win_rate?: number
  decklist_url?: string
  created_at: string
  updated_at: string
  tournaments?: TournamentRow
}

function mapMetagameRow(row: MetagameRow): CommanderMetagameStats {
  return {
    commanderKey: row.commander_key,
    commanderName: row.commander_name,
    colorIdentity: row.color_identity ?? [],
    entries: Number(row.entries),
    tournaments: Number(row.tournaments),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    matchWinRate: Number(row.match_win_rate),
    top16Finishes: Number(row.top16_finishes),
    topCutRate: Number(row.top_cut_rate),
    firstPlaceFinishes: Number(row.first_place_finishes),
    metaShare: Number(row.meta_share),
  }
}

function mapTournamentRow(row: TournamentRow): Tournament {
  return {
    id: row.id,
    source: row.source,
    sourceTournamentId: row.source_tournament_id,
    name: row.name,
    date: row.event_date,
    playerCount: row.player_count,
    url: row.source_url,
    importedAt: row.imported_at,
    sourceUpdatedAt: row.source_updated_at,
    entryCount: row.tournament_entries?.[0]?.count,
  }
}

function mapEntryRow(row: EntryRow): TournamentEntry {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    sourceEntryId: row.source_entry_id,
    playerName: row.player_name,
    playerExternalId: row.player_external_id,
    commanderName: row.commander_name,
    commanderKey: row.commander_key,
    colorIdentity: row.color_identity ?? [],
    standing: row.standing,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: row.win_rate ?? null,
    decklistUrl: row.decklist_url,
    tournamentName: row.tournaments?.name,
    tournamentDate: row.tournaments?.event_date ?? undefined,
    tournamentUrl: row.tournaments?.source_url,
    source: row.tournaments?.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function friendlyError(operation: string, error: unknown) {
  console.warn(`Tournament repository could not ${operation}.`, error)
  return new Error(`Unable to ${operation}. Please try again later.`)
}
