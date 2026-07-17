import { supabase } from '../lib/supabase'
import { displayRegionKey } from '../utils/tournamentLocation'
import type {
  CommanderMetagameStats,
  MetagameFilters,
  Tournament,
  TournamentEntryDecklist,
  TournamentEntry,
  RegionalMetagameStats,
} from '../models/tournament'

export interface TournamentDetail {
  tournament: Tournament
  entries: TournamentEntry[]
}

export interface CommanderDetail {
  stats: CommanderMetagameStats | null
  entries: TournamentEntry[]
}

export interface TournamentLocationOptions {
  countries: string[]
  states: string[]
  regions: string[]
  hasOnline: boolean
}

const metagameCache = new Map<string, CommanderMetagameStats[]>()
const entryDecklistCache = new Map<string, TournamentEntryDecklist>()

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
      country_filter: normalized.countryCode ?? null,
      state_filter: normalized.stateRegion ?? null,
      region_filter: normalized.regionKey ?? null,
      online_filter: normalized.isOnline ?? null,
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
    if (filters.countryCode) {
      query = query.eq('tournaments.country_code', filters.countryCode)
    }
    if (filters.stateRegion) {
      query = query.eq('tournaments.state_region', filters.stateRegion)
    }
    if (filters.regionKey) {
      query = query.eq('tournaments.region_key', filters.regionKey)
    }
    if (filters.isOnline !== undefined) {
      query = query.eq('tournaments.is_online', filters.isOnline)
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
    if (filters.countryCode) query = query.eq('country_code', filters.countryCode)
    if (filters.stateRegion) query = query.eq('state_region', filters.stateRegion)
    if (filters.regionKey) query = query.eq('region_key', filters.regionKey)
    if (filters.isOnline !== undefined) {
      query = query.eq('is_online', filters.isOnline)
    }
    const { data, error } = await query
    if (error) throw friendlyError('load tournaments', error)
    return ((data ?? []) as TournamentRow[]).map(mapTournamentRow)
  },

  async getLocationOptions(): Promise<TournamentLocationOptions> {
    requireSupabase()
    const { data, error } = await supabase!
      .from('tournaments')
      .select('country_code, state_region, region_key, is_online')
      .limit(5000)
    if (error) throw friendlyError('load location filters', error)
    const rows = (data ?? []) as Array<{
      country_code?: string
      state_region?: string
      region_key?: string
      is_online?: boolean
    }>
    return {
      countries: unique(rows.map((row) => row.country_code)),
      states: unique(rows.map((row) => row.state_region)),
      regions: unique(rows.map((row) => row.region_key)),
      hasOnline: rows.some((row) => row.is_online === true),
    }
  },

  async getRegionalMetagame(
    filters: MetagameFilters = {},
  ): Promise<RegionalMetagameStats[]> {
    requireSupabase()
    const { data, error } = await supabase!.rpc('get_regional_metagame', {
      start_date: filters.startDate || null,
      end_date: filters.endDate || null,
      minimum_players: Math.max(0, filters.minimumPlayers ?? 0),
    })
    if (error) throw friendlyError('load regional metagame', error)
    return ((data ?? []) as RegionalRow[]).map((row) => ({
      regionKey: row.region_key,
      displayName: displayRegionKey(row.region_key),
      tournaments: Number(row.tournaments),
      entries: Number(row.entries),
      uniqueCommanders: Number(row.unique_commanders),
      topCommander: row.top_commander,
      topCommanderEntries: Number(row.top_commander_entries),
      averageTournamentSize: Number(row.average_tournament_size ?? 0),
    }))
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

  async getEntryDecklist(
    sourceEntryId: string,
  ): Promise<TournamentEntryDecklist> {
    requireSupabase()
    const cached = entryDecklistCache.get(sourceEntryId)
    if (cached) return cached

    const { data, error } = await supabase!.functions.invoke(
      'tournament-decklist',
      { body: { entryId: sourceEntryId } },
    )
    if (error) {
      throw new Error(await readFunctionError(error))
    }

    const decklist = normalizeEntryDecklist(data)
    if (!decklist) {
      throw new Error('The tournament decklist response was invalid.')
    }
    entryDecklistCache.set(sourceEntryId, decklist)
    return decklist
  },

  clearCache() {
    metagameCache.clear()
    entryDecklistCache.clear()
  },
}

function normalizeEntryDecklist(
  value: unknown,
): TournamentEntryDecklist | null {
  if (!isRecord(value)) return null
  const commanders = normalizeTournamentCards(value.commanders)
  const cards = normalizeTournamentCards(value.cards)
  if (!commanders || !cards) return null
  return { commanders, cards }
}

function normalizeTournamentCards(value: unknown) {
  if (!Array.isArray(value)) return null
  const cards: TournamentEntryDecklist['cards'] = []
  for (const card of value) {
    if (
      !isRecord(card) ||
      typeof card.name !== 'string' ||
      typeof card.imageUrl !== 'string'
    ) {
      return null
    }
    cards.push({
      name: card.name,
      oracleId: typeof card.oracleId === 'string' ? card.oracleId : null,
      typeLine: typeof card.typeLine === 'string' ? card.typeLine : '',
      manaCost: typeof card.manaCost === 'string' ? card.manaCost : '',
      imageUrl: card.imageUrl,
    })
  }
  return cards
}

async function readFunctionError(error: unknown): Promise<string> {
  if (
    isRecord(error) &&
    error.context instanceof Response
  ) {
    try {
      const body: unknown = await error.context.clone().json()
      if (isRecord(body) && typeof body.error === 'string') {
        return body.error
      }
    } catch {
      // Fall through to a stable public error.
    }
  }
  return 'Unable to load this tournament decklist.'
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
    countryCode: filters.countryCode || undefined,
    stateRegion: filters.stateRegion || undefined,
    regionKey: filters.regionKey || undefined,
    isOnline: filters.isOnline,
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
  venue_name?: string
  city?: string
  state_region?: string
  country_code?: string
  location_precision?: Tournament['locationPrecision']
  is_online?: boolean
  region_key?: string
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
    venueName: row.venue_name,
    city: row.city,
    stateRegion: row.state_region,
    countryCode: row.country_code,
    locationPrecision: row.location_precision,
    isOnline: row.is_online ?? false,
    regionKey: row.region_key ?? 'unknown',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

interface RegionalRow {
  region_key: string
  tournaments: number
  entries: number
  unique_commanders: number
  top_commander: string | null
  top_commander_entries: number
  average_tournament_size: number | null
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right))
}
