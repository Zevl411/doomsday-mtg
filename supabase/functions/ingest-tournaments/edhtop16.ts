import type {
  ProviderListOptions,
  ProviderTournament,
  ProviderTournamentEntry,
  TournamentProvider,
} from './types.ts'

const DEFAULT_BASE_URL = 'https://edhtop16.com'

/**
 * EDHTop16 transport is isolated here because its response contract may evolve
 * independently from DoomsdayMTG's normalized database.
 */
export class EdhTop16Provider implements TournamentProvider {
  readonly source = 'edhtop16' as const
  private readonly baseUrl: string
  private readonly request: typeof fetch

  constructor(
    baseUrl = DEFAULT_BASE_URL,
    request: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl
    this.request = request
  }

  async listTournaments(
    options: ProviderListOptions,
  ): Promise<ProviderTournament[]> {
    const url = new URL('/tournaments', this.baseUrl)
    const rows = extractEmbeddedArrays(await this.getText(url), 'edges')
      .flat()
      .map((row) => isRecord(row) ? row.node : null)
    const unique = new Map<string, ProviderTournament>()

    for (const row of rows) {
      const tournament = mapTournament(row)
      if (!tournament) continue
      tournament.url ??= new URL(
        `/tournament/${encodeURIComponent(tournament.sourceTournamentId)}`,
        this.baseUrl,
      ).toString()
      if (
        options.tournamentIds?.length &&
        !options.tournamentIds.includes(tournament.sourceTournamentId)
      ) {
        continue
      }
      if (
        tournament.playerCount !== null &&
        tournament.playerCount < options.minimumPlayers
      ) {
        continue
      }
      if (
        options.startDate &&
        tournament.date &&
        tournament.date < new Date(options.startDate).toISOString()
      ) {
        continue
      }
      if (
        options.endDate &&
        tournament.date &&
        tournament.date >= endOfDay(options.endDate)
      ) {
        continue
      }
      unique.set(tournament.sourceTournamentId, tournament)
    }
    return [...unique.values()]
  }

  async listEntries(
    tournament: ProviderTournament,
  ): Promise<ProviderTournamentEntry[]> {
    const url = new URL(
      `/tournament/${encodeURIComponent(tournament.sourceTournamentId)}`,
      this.baseUrl,
    )
    const unique = new Map<string, ProviderTournamentEntry>()
    const arrays = extractEmbeddedArrays(await this.getText(url), 'entries')
    for (const row of arrays.flat()) {
      const entry = mapEntry(row)
      if (!entry) continue
      const identity = entry.sourceEntryId ??
        `${entry.playerExternalId ?? entry.playerName}|${entry.commanderName}`
      unique.set(identity, entry)
    }
    return [...unique.values()]
  }

  private async getText(url: URL): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.request(url, {
        headers: { Accept: 'text/html' },
      })
      if (response.ok) return response.text()
      if (response.status !== 429 || attempt === 2) {
        throw new Error(`EDHTop16 request failed with ${response.status}.`)
      }
      // Retry-After is preferred; bounded exponential delay is the fallback.
      const retryAfter = Number(response.headers.get('retry-after'))
      const delay = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 250 * 2 ** attempt
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    throw new Error('EDHTop16 request failed.')
  }
}

function mapTournament(value: unknown): ProviderTournament | null {
  if (!isRecord(value)) return null
  const id = readString(value, ['TID', 'tournamentId', 'id'])
  const name = readString(value, ['name', 'tournamentName'])
  if (!id || !name) return null
  return {
    sourceTournamentId: id,
    name,
    date: readDate(value, ['tournamentDate', 'date', 'eventDate', 'startDate']),
    playerCount: readNumber(value, ['size', 'playerCount', 'players']),
    url: readString(value, ['url', 'tournamentUrl']),
    sourceUpdatedAt: readDate(value, ['updatedAt', 'dateUpdated']) ?? undefined,
    raw: value,
  }
}

function mapEntry(value: unknown): ProviderTournamentEntry | null {
  if (!isRecord(value)) return null
  const commanderValue = isRecord(value.commander)
    ? value.commander.name
    : value.commander
  const commanderName =
    typeof commanderValue === 'string' && commanderValue.trim()
      ? commanderValue.trim()
      : readString(value, ['commanderName', 'deck'])
  if (!commanderName) return null
  return {
    sourceEntryId: readString(value, ['id', 'entryId']),
    playerName: readNestedString(value, 'player', 'name') ??
      readString(value, ['playerName', 'name', 'pilot']),
    playerExternalId: readNestedString(value, 'player', 'id') ??
      readString(value, ['playerId', 'profileId']),
    commanderName,
    colorIdentity: readColors(value.colorIdentity ?? value.colors),
    standing: readNumber(value, ['standing', 'place', 'rank']) ?? undefined,
    wins: readNumber(value, ['wins', 'win']) ?? 0,
    losses: readNumber(value, ['losses', 'loss']) ?? 0,
    draws: readNumber(value, ['draws', 'draw']) ?? 0,
    decklistUrl: readString(value, [
      'decklist',
      'decklistUrl',
      'deckUrl',
      'url',
    ]),
    raw: value,
  }
}

function readString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return value[key].trim()
    }
  }
  return undefined
}

function readNumber(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const number = Number(value[key])
    if (Number.isFinite(number) && number >= 0) return number
  }
  return null
}

function readDate(value: Record<string, unknown>, keys: string[]) {
  const text = readString(value, keys)
  if (!text || Number.isNaN(Date.parse(text))) return null
  return new Date(text).toISOString()
}

function readColors(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((color): color is string => typeof color === 'string')
  }
  return typeof value === 'string'
    ? value.match(/[WUBRG]/gi)?.map((color) => color.toUpperCase()) ?? []
    : []
}

function readNestedString(
  value: Record<string, unknown>,
  parent: string,
  child: string,
) {
  const nested = value[parent]
  return isRecord(nested) && typeof nested[child] === 'string'
    ? nested[child].trim()
    : undefined
}

/**
 * Next/Relay emits JSON records inside the server-rendered HTML stream.
 * This balanced scanner extracts only arrays assigned to a requested field;
 * it does not depend on visual markup or scrape rendered text.
 */
export function extractEmbeddedArrays(html: string, field: string): unknown[][] {
  const arrays: unknown[][] = []
  const marker = `"${field}":`
  let searchFrom = 0
  while (searchFrom < html.length) {
    const markerIndex = html.indexOf(marker, searchFrom)
    if (markerIndex < 0) break
    const start = html.indexOf('[', markerIndex + marker.length)
    if (start < 0) break
    const text = readBalancedArray(html, start)
    searchFrom = start + Math.max(text.length, 1)
    if (!text) continue
    try {
      const value: unknown = JSON.parse(text)
      if (Array.isArray(value)) arrays.push(value)
    } catch {
      // Query metadata and incomplete streamed chunks are intentionally ignored.
    }
  }
  return arrays
}

function readBalancedArray(text: string, start: number): string {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '[') depth += 1
    else if (character === ']') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return ''
}

function endOfDay(date: string) {
  const value = new Date(date)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export { mapEntry, mapTournament }
