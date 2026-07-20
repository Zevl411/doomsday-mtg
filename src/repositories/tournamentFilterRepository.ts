export type TournamentSizeRange = 'small' | 'standard' | 'large' | 'major'
export type TournamentTimePeriod =
  | '30-days'
  | '3-months'
  | '6-months'
  | '1-year'
  | 'all'
export type TournamentSortOrder =
  | 'date-desc'
  | 'date-asc'
  | 'size-desc'
  | 'size-asc'

export interface TournamentFilterPreferences {
  sizeRange: TournamentSizeRange
  timePeriod: TournamentTimePeriod
  sortOrder: TournamentSortOrder
  registeredCommandersOnly: boolean
}

const STORAGE_KEY = 'doomsday-mtg-tournament-filters'
const sizeRanges = new Set(['small', 'standard', 'large', 'major'])
const timePeriods = new Set([
  '30-days',
  '3-months',
  '6-months',
  '1-year',
  'all',
])
const sortOrders = new Set([
  'date-desc',
  'date-asc',
  'size-desc',
  'size-asc',
])

/**
 * Browser persistence stays behind this repository so the Vue view does not
 * depend directly on localStorage and malformed saved values remain harmless.
 */
export const tournamentFilterRepository = {
  load(): TournamentFilterPreferences | null {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')
      if (!isRecord(value)) return null
      if (
        !sizeRanges.has(String(value.sizeRange)) ||
        !timePeriods.has(String(value.timePeriod)) ||
        !sortOrders.has(String(value.sortOrder)) ||
        typeof value.registeredCommandersOnly !== 'boolean'
      ) {
        return null
      }

      return {
        sizeRange: value.sizeRange as TournamentSizeRange,
        timePeriod: value.timePeriod as TournamentTimePeriod,
        sortOrder: value.sortOrder as TournamentSortOrder,
        registeredCommandersOnly: value.registeredCommandersOnly,
      }
    } catch {
      return null
    }
  },

  save(preferences: TournamentFilterPreferences): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
      return true
    } catch {
      return false
    }
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
