import { supabase } from '../lib/supabase'
import type { CommanderDeckEvent } from '../models/commanderDeckEvent'

/** Validates complete-Deck event filter rows returned by Supabase. */
export const commanderDeckEventRepository = {
  async getByCards(
    commanderKey: string,
    oracleIds: string[],
    limit = 100,
  ): Promise<CommanderDeckEvent[]> {
    if (!supabase) throw new Error('Supabase is not configured.')
    const uniqueIds = [...new Set(oracleIds.filter(isUuid))].slice(0, 5)
    if (!uniqueIds.length) return []
    const { data, error } = await supabase.rpc(
      'get_commander_deck_events_by_cards',
      {
        p_commander_key: commanderKey,
        p_oracle_ids: uniqueIds,
        p_limit: Math.max(1, Math.min(Math.floor(limit), 250)),
      },
    )
    if (error) {
      console.warn('Commander card-filtered events failed', error)
      throw new Error('Unable to filter Commander Decks by cards.')
    }
    return parseCommanderDeckEvents(data)
  },
}

export function parseCommanderDeckEvents(value: unknown): CommanderDeckEvent[] {
  if (!Array.isArray(value)) throw invalidResponse()
  return value.map((row) => {
    if (
      !isRecord(row)
      || !isUuid(row.tournament_entry_id)
      || !isUuid(row.tournament_id)
      || !isUuid(row.tournament_deck_id)
      || !isString(row.tournament_name)
      || !isNullableDate(row.event_date)
      || !isNullableString(row.player_name)
      || !isNullablePositiveInteger(row.standing)
      || !isNonNegativeInteger(row.wins)
      || !isNonNegativeInteger(row.losses)
      || !isNonNegativeInteger(row.draws)
    ) throw invalidResponse()
    return {
      tournamentEntryId: row.tournament_entry_id,
      tournamentId: row.tournament_id,
      tournamentDeckId: row.tournament_deck_id,
      tournamentName: row.tournament_name,
      eventDate: row.event_date,
      playerName: row.player_name,
      standing: row.standing,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
}
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}
function isNullableDate(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
}
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null
    || (typeof value === 'number' && Number.isInteger(value) && value > 0)
}
function invalidResponse() {
  return new Error('Commander card-filtered event response was invalid.')
}
